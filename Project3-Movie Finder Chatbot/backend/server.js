/**
 * Agentic Movie & Weather Planner � Backend Server
 *
 * Architecture (agent loop):
 *   1. Receive user message + conversation history from the frontend.
 *   2. Build a messages array and send it to the NVIDIA Llama 3.1 API
 *      together with the tool definitions.
 *   3. If the model responds with finish_reason === "tool_calls":
 *        a. Append the assistant message (with tool_calls) to `messages`.
 *        b. Execute every requested JavaScript tool locally.
 *        c. Append a "tool" role message for each result.
 *        d. Go back to step 2.
 *   4. Once the model responds with finish_reason === "stop", return the
 *      final text reply (plus any structured movie data collected during
 *      tool execution) to the frontend.
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'] }));
app.use(express.json());

// --- NVIDIA API Config -------------------------------------------------------
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL    = 'meta/llama-3.1-70b-instruct';

// --- Mock Movie Database -----------------------------------------------------
const MOCK_MOVIES = [
  {
    title: 'Dune: Part Three',
    genre: 'Sci-Fi / Adventure',
    rating: 'PG-13',
    score: '8.4/10 ?',
    description: 'Paul Atreides leads the Fremen in a final battle to secure the future of Arrakis.',
    showtimes: ['10:00 AM', '1:30 PM', '4:45 PM', '8:00 PM'],
    icon: '???',
  },
  {
    title: 'The Batman: Shadow of Gotham',
    genre: 'Action / Crime Drama',
    rating: 'PG-13',
    score: '8.1/10 ?',
    description: "Bruce Wayne confronts a villain who weaponises Gotham's darkest secrets.",
    showtimes: ['11:00 AM', '2:15 PM', '5:30 PM', '9:00 PM'],
    icon: '??',
  },
  {
    title: 'Interstellar: Beyond',
    genre: 'Sci-Fi / Drama',
    rating: 'PG',
    score: '8.7/10 ?',
    description: 'A new crew ventures through a wormhole searching for a second chance for humanity.',
    showtimes: ['9:30 AM', '12:45 PM', '4:00 PM', '7:30 PM'],
    icon: '??',
  },
  {
    title: 'Avengers: New Legacy',
    genre: 'Action / Superhero',
    rating: 'PG-13',
    score: '7.9/10 ?',
    description: 'A new generation of Avengers assembles to face an inter-dimensional threat.',
    showtimes: ['10:30 AM', '1:00 PM', '3:30 PM', '6:00 PM', '9:15 PM'],
    icon: '??',
  },
  {
    title: 'The Grand Budapest Heist',
    genre: 'Comedy / Crime',
    rating: 'PG-13',
    score: '8.0/10 ?',
    description: 'A quirky concierge executes an elaborate art heist inside a legendary European hotel.',
    showtimes: ['11:30 AM', '2:00 PM', '5:00 PM', '8:30 PM'],
    icon: '??',
  },
  {
    title: 'Echoes of Tomorrow',
    genre: 'Thriller / Mystery',
    rating: 'R',
    score: '7.6/10 ?',
    description: 'A detective discovers she can receive messages from her future self.',
    showtimes: ['12:00 PM', '3:15 PM', '6:45 PM', '10:00 PM'],
    icon: '??',
  },
  {
    title: 'Wildfire',
    genre: 'Action / Disaster',
    rating: 'PG-13',
    score: '7.3/10 ?',
    description: 'A seasoned firefighter races an unstoppable wildfire threatening a California valley.',
    showtimes: ['10:15 AM', '1:45 PM', '5:15 PM', '8:45 PM'],
    icon: '??',
  },
  {
    title: 'Laughter in Lahore',
    genre: 'Comedy / Romance',
    rating: 'PG',
    score: '7.8/10 ?',
    description: 'Two rival comedians accidentally fall in love competing for the same TV slot.',
    showtimes: ['11:00 AM', '2:30 PM', '6:00 PM', '9:30 PM'],
    icon: '??',
  },
];

// --- Tool Definitions (OpenAI function-calling schema) -----------------------
//
// The LLM uses this schema to decide WHEN to call a tool and WHAT arguments
// to supply.  The definitions are sent with every API request.
//
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description:
        'Returns the current weather condition for a given city. ' +
        'Use this to tailor movie recommendations based on the weather.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The city to get weather for (e.g. "New York", "London").',
          },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_movies',
      description:
        'Returns a list of movies currently playing in theaters in a given city.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The city to find current movies for.',
          },
        },
        required: ['city'],
      },
    },
  },
];

// --- Tool Implementations ----------------------------------------------------
//
// These are the LOCAL JavaScript functions that run when the LLM requests a
// tool call.  In production you would hit real APIs here.
//

/**
 * Returns a random weather condition for the requested city.
 * @param {string} city
 */
function get_weather(city) {
  const condition = Math.random() < 0.5 ? 'Sunny' : 'Rain';
  const recommendation =
    condition === 'Sunny'
      ? 'Great day for an outdoor screening or a light-hearted film!'
      : 'Perfect weather to stay inside with a thriller or a cosy drama.';
  console.log(`[Tool] get_weather("${city}") ? ${condition}`);
  return { city, condition, recommendation };
}

/**
 * Returns a shuffled slice of the mock movie database for the requested city.
 * @param {string} city
 */
function get_movies(city) {
  const movies = [...MOCK_MOVIES].sort(() => Math.random() - 0.5).slice(0, 5);
  console.log(`[Tool] get_movies("${city}") ? ${movies.length} movies`);
  return { city, movies };
}

// --- Tool Dispatcher ---------------------------------------------------------
//
// Parses the LLM-supplied arguments and routes to the correct JS function.
//
function executeToolCall(toolCall) {
  const { name, arguments: argsStr } = toolCall.function;

  let args;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return { error: `Could not parse arguments for tool "${name}".` };
  }

  // Sanitise the city string before using it
  const city = typeof args.city === 'string' ? args.city.trim().slice(0, 100) : '';
  if (!city) {
    return { error: `Tool "${name}" requires a non-empty city argument.` };
  }

  switch (name) {
    case 'get_weather': return get_weather(city);
    case 'get_movies':  return get_movies(city);
    default:            return { error: `Unknown tool: "${name}".` };
  }
}

// --- NVIDIA API � single round-trip ------------------------------------------
async function callNvidiaAPI(messages, tools) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      'NVIDIA_API_KEY is not set. Create a .env file with NVIDIA_API_KEY=nvapi-...'
    );
  }

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      tools,
      tool_choice: 'auto',   // Let the model decide when to call a tool
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API responded with ${response.status}: ${errText}`);
  }

  return response.json();
}

// --- Agent Loop --------------------------------------------------------------
//
// This is the heart of the agentic planner.
//
// Flowchart:
//
//   User message
//       ?
//   callNvidiaAPI(messages, tools)
//       ?
//   finish_reason === "tool_calls"?
//       +- YES ? append assistant msg
//       �        execute tools locally
//       �        append tool-result msgs
//       �        ? loop back to callNvidiaAPI
//       +- NO  ? return final text reply
//
async function runAgentLoop(userMessage, conversationHistory = []) {
  const messages = [
    {
      role: 'system',
      content:
        'You are an Agentic Movie & Weather Planner. ' +
        'When a user asks about movies in a city, ALWAYS: ' +
        '1) Call get_weather to check conditions first. ' +
        '2) Call get_movies to fetch current listings. ' +
        '3) Return a friendly summary that connects the weather to the movie recommendations. ' +
        'Never make up movie titles � only use data returned by the get_movies tool.',
    },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const MAX_ITERATIONS = 8; // Safety guard � prevents runaway loops
  let iteration = 0;
  let collectedMovies = null; // Structured data forwarded to the frontend
  const toolsUsed = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n[Agent] -- Iteration ${iteration} ------------------------------`);
    console.log(`[Agent] Sending ${messages.length} messages to ${NVIDIA_MODEL}`);

    const apiResponse = await callNvidiaAPI(messages, TOOL_DEFINITIONS);
    const choice = apiResponse.choices[0];

    console.log(`[Agent] finish_reason: "${choice.finish_reason}"`);

    // Branch 1: model wants to call one or more tools
    if (choice.finish_reason === 'tool_calls') {
      const assistantMsg = choice.message;

      // Llama prompt template crashes if content is null — normalise to empty string.
      if (assistantMsg.content === null || assistantMsg.content === undefined) {
        assistantMsg.content = '';
      }

      // Append the assistant's tool-call request so the model can reference
      // it in subsequent turns.
      messages.push(assistantMsg);

      // Execute EVERY tool call the model requested in this single turn.
      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);
        console.log(`[Agent] ? Executing: ${toolName}(${toolCall.function.arguments})`);

        const result = executeToolCall(toolCall);
        console.log(`[Agent] ? Result:`, JSON.stringify(result));

        // Cache movie data so we can send structured cards to the frontend.
        if (toolName === 'get_movies' && result.movies) {
          collectedMovies = result.movies;
        }

        // Append the tool result so the model can read it in the next turn.
        // NOTE: content MUST be a string � JSON.stringify is intentional.
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result),
        });
      }

      // Loop back ? the model will now read the tool results and either
      // make more tool calls or produce a final text response.
      continue;
    }

    // Branch 2: model produced a final text answer
    if (choice.finish_reason === 'stop') {
      console.log('[Agent] Final response received.\n');
      return {
        reply: choice.message.content,
        movies: collectedMovies,
        toolsUsed,
      };
    }

    // Unexpected finish reason
    throw new Error(`Unexpected finish_reason from API: "${choice.finish_reason}"`);
  }

  throw new Error(
    `Agent loop hit the ${MAX_ITERATIONS}-iteration safety limit without a final response.`
  );
}

// --- Routes ------------------------------------------------------------------

/**
 * POST /api/chat
 * Body:  { message: string, history?: Array<{role, content}> }
 * Reply: { reply: string, movies: object[]|null, toolsUsed: string[] }
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Please provide a non-empty message.' });
  }

  const sanitisedMessage = message.trim().slice(0, 500);

  // Accept at most the last 10 turns to keep the context window manageable.
  const safeHistory = Array.isArray(history)
    ? history
        .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
        .slice(-10)
    : [];

  try {
    const result = await runAgentLoop(sanitisedMessage, safeHistory);
    return res.json(result);
  } catch (err) {
    console.error('[/api/chat] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', mode: 'agentic', model: NVIDIA_MODEL })
);

app.listen(PORT, () =>
  console.log(`Agentic Planner backend running at http://localhost:${PORT}`)
);
