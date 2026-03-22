/**
 * Movie Finder Chatbot - Backend Server
 * Uses Playwright to scrape movie showtimes, with a robust mock-data fallback.
 */
const express = require('express');
const cors    = require('cors');
const { chromium } = require('playwright');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// â”€â”€â”€ Mock Movie Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MOCK_MOVIES = [
  {
    title: 'Dune: Part Three',
    genre: 'Sci-Fi / Adventure',
    rating: 'PG-13',
    score: '8.4/10 â­',
    description: 'Paul Atreides leads the Fremen in a final battle against Harkonnen forces to secure the future of Arrakis.',
    showtimes: ['10:00 AM', '1:30 PM', '4:45 PM', '8:00 PM'],
    icon: 'ðŸœï¸',
  },
  {
    title: 'The Batman: Shadow of Gotham',
    genre: 'Action / Crime Drama',
    rating: 'PG-13',
    score: '8.1/10 â­',
    description: "Bruce Wayne confronts a new villain who weaponises Gotham's darkest secrets against its own citizens.",
    showtimes: ['11:00 AM', '2:15 PM', '5:30 PM', '9:00 PM'],
    icon: 'ðŸ¦‡',
  },
  {
    title: 'Interstellar: Beyond',
    genre: 'Sci-Fi / Drama',
    rating: 'PG',
    score: '8.7/10 â­',
    description: 'A new crew ventures through a wormhole searching for a second chance for humanity.',
    showtimes: ['9:30 AM', '12:45 PM', '4:00 PM', '7:30 PM'],
    icon: 'ðŸš€',
  },
  {
    title: 'Avengers: New Legacy',
    genre: 'Action / Superhero',
    rating: 'PG-13',
    score: '7.9/10 â­',
    description: 'A new generation of Avengers assembles to face an inter-dimensional threat that the original team could not foresee.',
    showtimes: ['10:30 AM', '1:00 PM', '3:30 PM', '6:00 PM', '9:15 PM'],
    icon: 'ðŸ¦¸',
  },
  {
    title: 'The Grand Budapest Heist',
    genre: 'Comedy / Crime',
    rating: 'PG-13',
    score: '8.0/10 â­',
    description: 'A quirky concierge and his protÃ©gÃ© execute an elaborate art heist inside a legendary European hotel.',
    showtimes: ['11:30 AM', '2:00 PM', '5:00 PM', '8:30 PM'],
    icon: 'ðŸˆ',
  },
  {
    title: 'Echoes of Tomorrow',
    genre: 'Thriller / Mystery',
    rating: 'R',
    score: '7.6/10 â­',
    description: 'A detective discovers she can receive messages from her future self â€” the only clues to prevent a catastrophe.',
    showtimes: ['12:00 PM', '3:15 PM', '6:45 PM', '10:00 PM'],
    icon: 'ðŸ”',
  },
  {
    title: 'Wildfire',
    genre: 'Action / Disaster',
    rating: 'PG-13',
    score: '7.3/10 â­',
    description: 'A seasoned firefighter races against an unstoppable wildfire threatening to engulf an entire California valley.',
    showtimes: ['10:15 AM', '1:45 PM', '5:15 PM', '8:45 PM'],
    icon: 'ðŸ”¥',
  },
  {
    title: 'Laughter in Lahore',
    genre: 'Comedy / Romance',
    rating: 'PG',
    score: '7.8/10 â­',
    description: 'Two rival stand-up comedians accidentally fall in love while competing for the same prime-time TV slot.',
    showtimes: ['11:00 AM', '2:30 PM', '6:00 PM', '9:30 PM'],
    icon: 'ðŸ˜‚',
  },
];

// â”€â”€â”€ Playwright Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function scrapeMovies(city) {
  let browser;
  try {
    console.log('[Scraper] Launching browser for city:', city);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    console.log('[Scraper] Navigating to Rotten Tomatoes...');
    await page.goto('https://www.rottentomatoes.com/browse/movies_in_theaters/', {
      timeout: 20000,
      waitUntil: 'domcontentloaded',
    });

    await page.waitForSelector('[data-qa="discovery-media-list-item"]', { timeout: 10000 });

    const scrapedMovies = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-qa="discovery-media-list-item"]');
      const results = [];
      items.forEach((item) => {
        const title = item.querySelector('[data-qa="discovery-media-list-item-title"]')?.textContent?.trim() || '';
        const score = item.querySelector('[data-qa="tomatometer"]')?.textContent?.trim() || 'N/A';
        if (title) {
          results.push({
            title,
            genre: 'Now in Theaters',
            rating: 'N/A',
            score: score + ' ðŸ…',
            description: 'Now playing in theaters near you.',
            showtimes: ['Check local theater for showtimes'],
            icon: 'ðŸŽ¬',
          });
        }
      });
      return results.slice(0, 8);
    });

    if (scrapedMovies.length > 0) {
      console.log('[Scraper] âœ… Scraped', scrapedMovies.length, 'movies.');
      return { source: 'live', city, movies: scrapedMovies };
    }
    throw new Error('No movie tiles found in scraped page.');
  } catch (err) {
    console.warn('[Scraper] âš ï¸  Scraping failed (' + err.message + '). Using mock data.');
    return { source: 'mock', city, movies: buildMockResponse() };
  } finally {
    if (browser) await browser.close();
  }
}

function buildMockResponse() {
  return [...MOCK_MOVIES].sort(() => Math.random() - 0.5).slice(0, 6);
}

// â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/movies', async (req, res) => {
  const { city } = req.body;
  if (!city || typeof city !== 'string' || !city.trim()) {
    return res.status(400).json({ error: 'Please provide a valid city name.' });
  }
  const sanitised = city.trim().replace(/[<>"'&]/g, '');
  if (sanitised.length > 100) {
    return res.status(400).json({ error: 'City name is too long.' });
  }
  try {
    const result = await scrapeMovies(sanitised);
    return res.json(result);
  } catch (err) {
    console.error('[API] Error:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log('Movie Finder backend running at http://localhost:' + PORT));