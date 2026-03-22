import { useState, useCallback, useRef } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  DollarSign,
  Layers,
  Mail,
  RefreshCw,
  Server,
  Star,
  TrendingUp,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const TIMELINE_START = new Date('2026-04-01');
const TIMELINE_END   = new Date('2026-07-05');

// Derived constants used in multiple places
const COMM_DATE        = new Date('2026-06-15'); // 15 days before maintenance window
const MAINTENANCE_DATE = new Date('2026-06-30');

const PHASES = [
  {
    id: 1,
    phase: 'Phase 1',
    label: 'Project Execution',
    task: 'Project Kick-off & Core Execution',
    start: new Date('2026-04-01'),
    end: new Date('2026-05-30'),
    owner: 'Global Project Team',
    ownerShort: 'GPT',
    color: '#6366f1',        // indigo
    colorLight: '#818cf8',
    bgClass: 'bg-indigo-500',
    icon: <Zap size={14} />,
    isMilestone: false,
    status: 'active',
    description: 'Orchestrates overall execution: stakeholder alignment, risk tracking, sprint ceremonies, and cross-functional dependencies.',
  },
  {
    id: 2,
    phase: 'Phase 2',
    label: 'Infrastructure & Data Plane',
    task: 'Vendor (AWS) Engagement & Migration Initiation',
    start: new Date('2026-04-01'),
    end: new Date('2026-05-30'),
    owner: 'Arjun',
    ownerShort: 'AR',
    color: '#0ea5e9',        // sky blue
    colorLight: '#38bdf8',
    bgClass: 'bg-sky-500',
    icon: <Server size={14} />,
    isMilestone: false,
    status: 'active',
    description: 'AWS account provisioning, VPC setup, Direct Connect, S3 bucket policies, IAM roles, DMS job configuration, and cutover validation.',
  },
  {
    id: 3,
    phase: 'Phase 3',
    label: 'Client / App Integration',
    task: 'Frontend New Interface → Backend Integration',
    start: new Date('2026-05-31'),
    end: new Date('2026-05-31'),
    owner: 'Bala',
    ownerShort: 'BA',
    color: '#f59e0b',        // amber — milestone
    colorLight: '#fbbf24',
    bgClass: 'bg-amber-500',
    icon: <Star size={14} />,
    isMilestone: true,
    status: 'upcoming',
    description: 'Go-live milestone: new React frontend wired to migrated AWS backend APIs. Smoke tests, UAT sign-off, and production cutover.',
  },
  {
    id: 4,
    phase: 'Phase 4',
    label: 'Financial Operations (FinOps)',
    task: 'Validate Migrated Data Cost, COGS Impact & ROI',
    start: new Date('2026-05-25'),
    end: new Date('2026-06-07'),
    owner: 'Cheran',
    ownerShort: 'CH',
    color: '#10b981',        // emerald
    colorLight: '#34d399',
    bgClass: 'bg-emerald-500',
    icon: <DollarSign size={14} />,
    isMilestone: false,
    status: 'upcoming',
    description: 'Cost Explorer analysis, COGS baseline comparison, tag-based allocation reports, ROI modeling, and FinOps dashboard handoff.',
  },
  {
    id: 5,
    phase: 'Phase 5',
    label: 'Customer Communication',
    task: 'Proactive Maintenance Window Notification to Customers',
    start: new Date('2026-06-15'),
    end: new Date('2026-06-15'),
    owner: 'Divya',
    ownerShort: 'DV',
    color: '#ec4899',        // pink
    colorLight: '#f472b6',
    bgClass: 'bg-pink-500',
    icon: <Mail size={14} />,
    isMilestone: true,
    status: 'upcoming',
    description:
      'Product Manager sends proactive outbound communication to all customers notifying them of the scheduled maintenance window on June 30, 2026 (10:30 PM – 12:30 PM). Communication dispatched exactly 15 days in advance to ensure adequate customer preparation time.',
    maintenanceWindow: 'June 30, 2026 · 10:30 PM – 12:30 PM',
    communicationDate: 'June 15, 2026',
  },
  {
    id: 6,
    phase: 'Phase 6',
    label: 'Scheduled Maintenance Window',
    task: 'Production Maintenance Window — System Downtime',
    start: new Date('2026-06-30'),
    end: new Date('2026-06-30'),
    owner: 'Divya',
    ownerShort: 'DV',
    color: '#f43f5e',        // rose — critical window
    colorLight: '#fb7185',
    bgClass: 'bg-rose-500',
    icon: <Wrench size={14} />,
    isMilestone: true,
    status: 'upcoming',
    description:
      'Scheduled production maintenance window. Customers have been notified 15 days in advance (June 15). Window: 10:30 PM – 12:30 PM (2 hours). All services may be temporarily unavailable during this period.',
    maintenanceWindow: 'June 30, 2026 · 10:30 PM – 12:30 PM',
    communicationDate: 'June 15, 2026',
  },
];

const OWNER_COLORS = {
  'Global Project Team': { dot: '#6366f1', text: 'text-indigo-400',  bg: 'bg-indigo-900/40',  border: 'border-indigo-700' },
  'Arjun':               { dot: '#0ea5e9', text: 'text-sky-400',     bg: 'bg-sky-900/40',     border: 'border-sky-700'    },
  'Bala':                { dot: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-900/40',   border: 'border-amber-700'  },
  'Cheran':              { dot: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-700'},
  'Divya':               { dot: '#ec4899', text: 'text-pink-400',    bg: 'bg-pink-900/40',    border: 'border-pink-700'   },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_DAYS = Math.ceil(
  (TIMELINE_END - TIMELINE_START) / (1000 * 60 * 60 * 24)
);

function dayOffset(date) {
  return Math.max(0, Math.ceil((date - TIMELINE_START) / (1000 * 60 * 60 * 24)));
}

function pct(date) {
  return (dayOffset(date) / TOTAL_DAYS) * 100;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateLong(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function durationDays(start, end) {
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function todayPct() {
  const t = new Date();
  if (t < TIMELINE_START) return 0;
  if (t > TIMELINE_END)   return 100;
  return pct(t);
}

// Generate monthly tick labels for the ruler
function buildRulerTicks() {
  const ticks = [];
  const cursor = new Date(TIMELINE_START);
  while (cursor <= TIMELINE_END) {
    ticks.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pct: pct(new Date(cursor)),
    });
    cursor.setDate(cursor.getDate() + 7); // weekly ticks
  }
  return ticks;
}

const RULER_TICKS = buildRulerTicks();

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Active
      </span>
    );
  if (status === 'milestone')
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-700">
        <Star size={10} />
        Milestone
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
      <Clock size={10} />
      Upcoming
    </span>
  );
}

function MetricCard({ icon, label, value, sub, accent }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/70 p-5 flex flex-col gap-3
                 hover:border-slate-600 transition-colors duration-200"
    >
      {/* accent glow strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <ChevronRight size={14} className="text-slate-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// Tooltip component — rendered as a portal-style absolute element
function Tooltip({ phase, x, y, visible }) {
  if (!visible || !phase) return null;
  const oc = OWNER_COLORS[phase.owner];
  return (
    <div
      className="tooltip fixed z-50 w-72 rounded-xl border border-slate-600 bg-slate-900 shadow-2xl p-4 pointer-events-none"
      style={{ left: Math.min(x + 12, window.innerWidth - 300), top: y - 10 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-mono text-slate-500 mb-0.5">{phase.phase}</p>
          <p className="text-sm font-semibold text-white leading-snug">{phase.task}</p>
        </div>
        <StatusBadge status={phase.isMilestone ? 'milestone' : phase.status} />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-500 mb-0.5">Start</p>
          <p className="text-xs font-mono text-slate-200">{fmtDateLong(phase.start)}</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-500 mb-0.5">{phase.isMilestone ? 'Milestone' : 'End'}</p>
          <p className="text-xs font-mono text-slate-200">{fmtDateLong(phase.end)}</p>
        </div>
      </div>

      {!phase.isMilestone && (
        <div className="mb-3 rounded-lg bg-slate-800 p-2 flex items-center gap-2">
          <span className="text-slate-400"><Clock size={12} /></span>
          <p className="text-xs text-slate-300">
            <span className="font-semibold text-white">{durationDays(phase.start, phase.end)}</span> days duration
          </p>
        </div>
      )}

      {/* Owner */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${oc.bg} ${oc.border}`}>
        <User size={12} style={{ color: oc.dot }} />
        <span className={`text-xs font-medium ${oc.text}`}>{phase.owner}</span>
      </div>

      {/* Description */}
      <p className="mt-3 text-xs text-slate-400 leading-relaxed border-t border-slate-700 pt-3">
        {phase.description}
      </p>
    </div>
  );
}

// Gantt chart
function GanttChart() {
  const [tooltip, setTooltip] = useState({ visible: false, phase: null, x: 0, y: 0 });
  const chartRef = useRef(null);
  const today = new Date();
  const tp = todayPct();

  const handleMouseEnter = useCallback((e, phase) => {
    setTooltip({ visible: true, phase, x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (tooltip.visible) {
      setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    }
  }, [tooltip.visible]);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, phase: null, x: 0, y: 0 });
  }, []);

  const milestonePct     = pct(new Date('2026-05-31'));
  const commPct          = pct(COMM_DATE);
  const maintenancePct   = pct(MAINTENANCE_DATE);

  return (
    <div className="w-full" ref={chartRef} onMouseMove={handleMouseMove}>
      {/* Ruler */}
      <div className="relative h-8 mb-1 ml-48 mr-4">
        {RULER_TICKS.map((t, i) => (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{ left: `${t.pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-xs font-mono text-slate-600 whitespace-nowrap">{t.label}</span>
            <div className="w-px h-2 bg-slate-700 mt-0.5" />
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-3">
        {PHASES.map(phase => {
          const leftPct  = pct(phase.start);
          const widthPct = phase.isMilestone ? 0 : (pct(phase.end) - leftPct);
          const oc       = OWNER_COLORS[phase.owner];

          return (
            <div key={phase.id} className="flex items-center gap-4">
              {/* Left label */}
              <div className="w-48 flex-shrink-0 text-right pr-4">
                <p className="text-xs font-mono text-slate-500">{phase.phase}</p>
                <p className="text-xs font-medium text-slate-300 leading-snug">{phase.label}</p>
                <div className={`mt-1 inline-flex items-center gap-1 text-xs ${oc.text}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: oc.dot, display: 'inline-block', flexShrink: 0 }} />
                  {phase.owner}
                </div>
              </div>

              {/* Bar track */}
              <div className="relative flex-1 h-10 mr-4">
                {/* Grid lines */}
                {RULER_TICKS.map((t, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-slate-800"
                    style={{ left: `${t.pct}%` }}
                  />
                ))}

                {/* Milestone vertical lines */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-10 milestone-marker"
                  style={{ left: `${milestonePct}%`, background: '#f59e0b66' }}
                />
                {/* Communication send date line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-10 milestone-marker"
                  style={{ left: `${commPct}%`, background: '#ec489966' }}
                />
                {/* Maintenance window line */}
                <div
                  className="absolute top-0 bottom-0 w-px z-10"
                  style={{ left: `${maintenancePct}%`, background: '#f43f5e99', boxShadow: '0 0 6px #f43f5e66' }}
                />

                {/* Today's line */}
                {today >= TIMELINE_START && today <= TIMELINE_END && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 z-20"
                    style={{ left: `${tp}%`, background: '#ef4444', boxShadow: '0 0 6px #ef444480' }}
                  >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-red-300 shadow" />
                  </div>
                )}

                {phase.isMilestone ? (
                  /* Milestone diamond */
                  <div
                    className="absolute top-1/2 z-30 cursor-pointer gantt-bar"
                    style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseEnter={e => handleMouseEnter(e, phase)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className="w-6 h-6 rotate-45 rounded-sm border-2 milestone-marker"
                      style={{
                        background: phase.color,
                        borderColor: phase.colorLight,
                        boxShadow: `0 0 12px ${phase.color}80`,
                      }}
                    />
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-mono font-semibold"
                      style={{ color: phase.colorLight, textShadow: `0 0 8px ${phase.color}` }}
                    >
                      {phase.id === 3 && '⭐ May 31 Go-Live'}
                      {phase.id === 5 && '📣 Jun 15 Comm Send'}
                      {phase.id === 6 && '🔧 Jun 30 Maintenance'}
                    </div>
                  </div>
                ) : (
                  /* Regular bar */
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md gantt-bar flex items-center px-2 gap-1 overflow-hidden"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 2)}%`,
                      background: `linear-gradient(90deg, ${phase.color}cc, ${phase.colorLight}dd)`,
                      border: `1px solid ${phase.colorLight}55`,
                      boxShadow: `0 0 12px ${phase.color}33`,
                    }}
                    onMouseEnter={e => handleMouseEnter(e, phase)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <span style={{ color: '#fff', opacity: 0.9, flexShrink: 0 }}>{phase.icon}</span>
                    <span className="text-xs font-medium text-white/90 truncate">
                      {fmtDate(phase.start)} – {fmtDate(phase.end)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 ml-52 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-red-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 bg-amber-500 rounded-sm" />
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-amber-500/40" />
          <span>Milestone window</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 bg-pink-500 rounded-sm" />
          <span>📣 Comm send</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rotate-45 bg-rose-500 rounded-sm" />
          <span>🔧 Maintenance</span>
        </div>
      </div>

      {/* Floating tooltip */}
      <Tooltip {...tooltip} />
    </div>
  );
}

// Phase detail list
function PhaseList() {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="flex flex-col gap-3">
      {PHASES.map(phase => {
        const oc      = OWNER_COLORS[phase.owner];
        const isOpen  = expanded === phase.id;
        const dur     = phase.isMilestone ? '1 day (Milestone)' : `${durationDays(phase.start, phase.end)} days`;
        return (
          <div
            key={phase.id}
            className={`rounded-xl border transition-colors duration-200 cursor-pointer
              ${isOpen ? `${oc.border} bg-slate-900` : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-600'}`}
            onClick={() => setExpanded(isOpen ? null : phase.id)}
          >
            <div className="flex items-center gap-4 p-4">
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: phase.color }}
              />
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${phase.color}22`, border: `1px solid ${phase.color}44` }}
              >
                <span style={{ color: phase.colorLight }}>{phase.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-500">{phase.phase}</span>
                  <StatusBadge status={phase.isMilestone ? 'milestone' : phase.status} />
                </div>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{phase.task}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtDate(phase.start)}
                  {!phase.isMilestone && ` → ${fmtDate(phase.end)}`}
                  {' · '}{dur}
                </p>
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full ${oc.bg} ${oc.text} ${oc.border} border hidden md:block`}>
                {phase.owner}
              </div>
              <ChevronRight
                size={16}
                className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
              />
            </div>
            {isOpen && (
              <div className="px-4 pb-4 ml-14 border-t border-slate-800/80 pt-3">
                <p className="text-sm text-slate-400 leading-relaxed">{phase.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-slate-500 mb-0.5">Start</p>
                    <p className="font-mono text-slate-200">{fmtDateLong(phase.start)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-slate-500 mb-0.5">{phase.isMilestone ? 'Date' : 'End'}</p>
                    <p className="font-mono text-slate-200">{fmtDateLong(phase.end)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-slate-500 mb-0.5">Duration</p>
                    <p className="font-mono text-slate-200">{dur}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2">
                    <p className="text-slate-500 mb-0.5">Owner</p>
                    <p className={`font-mono ${oc.text}`}>{phase.owner}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });

  const activePhases = PHASES.filter(p => p.status === 'active');
  const nextMilestone = PHASES.find(p => p.isMilestone);
  const daysUntilMilestone = Math.ceil(
    (nextMilestone.start - now) / (1000 * 60 * 60 * 24)
  );
  const totalProjectDays = durationDays(TIMELINE_START, TIMELINE_END);
  const elapsedDays = Math.max(
    0,
    Math.min(totalProjectDays, Math.ceil((now - TIMELINE_START) / (1000 * 60 * 60 * 24)))
  );
  const progressPct = Math.round((elapsedDays / totalProjectDays) * 100);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 font-sans">

      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0a0f1e]/90 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900">
              <Cloud size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                Data Migration Command Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">AWS Cloud Modernisation · Q2 2026</p>
            </div>
          </div>

          {/* Right: date + health */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar size={12} />
              <span className="font-mono">{todayStr}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-700 bg-green-900/30">
              <CheckCircle2 size={13} className="text-green-400" />
              <span className="text-xs font-semibold text-green-400">On Track</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Activity size={12} className="text-indigo-400" />
              <span className="font-mono text-indigo-400">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

        {/* ── Summary Cards ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={14} className="text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Project Metrics</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Clock size={18} />}
              label="Total Days Active"
              value={`${totalProjectDays} days`}
              sub={`${elapsedDays} elapsed · ${progressPct}% complete`}
              accent="#6366f1"
            />
            <MetricCard
              icon={<Star size={18} />}
              label="Next Milestone"
              value="May 31, 2026"
              sub={daysUntilMilestone > 0
                ? `${daysUntilMilestone} days away`
                : daysUntilMilestone === 0 ? 'TODAY 🎯' : `${Math.abs(daysUntilMilestone)}d ago`}
              accent="#f59e0b"
            />
            <MetricCard
              icon={<User size={18} />}
              label="Active Owners"
              value={`${activePhases.length} Phases`}
              sub={activePhases.map(p => p.owner).join(' · ')}
              accent="#0ea5e9"
            />
            <MetricCard
              icon={<TrendingUp size={18} />}
              label="FinOps Status"
              value="Scheduled"
              sub="May 25 – Jun 7 · Owner: Cheran"
              accent="#10b981"
            />
          </div>
          {/* Communication alert banner */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-pink-800/60 bg-pink-950/30 px-4 py-3">
            <Bell size={16} className="text-pink-400 mt-0.5 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-xs font-semibold text-pink-300">Upcoming: Customer Communication (Owner: Divya · Product Manager)</p>
              <p className="text-xs text-pink-400/70 mt-0.5">
                Proactive notification to be sent on <span className="font-mono font-semibold text-pink-300">June 15, 2026</span> — 15 days before the scheduled maintenance window of{' '}
                <span className="font-mono font-semibold text-rose-300">June 30, 2026 · 10:30 PM – 12:30 PM</span>.
              </p>
            </div>
          </div>
        </section>

        {/* ── Overall Progress ── */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-slate-500" />
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Overall Timeline Progress</h2>
            </div>
            <span className="text-sm font-bold text-white font-mono">{progressPct}%</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                boxShadow: '0 0 10px #6366f155',
              }}
            />
            {/* Milestone marker on progress bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
              style={{ left: `${(durationDays(TIMELINE_START, new Date('2026-05-31')) / totalProjectDays) * 100}%` }}
            />
          </div>
          {/* Maintenance window marker on progress bar */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500/70"
            style={{ left: `${(durationDays(TIMELINE_START, MAINTENANCE_DATE) / totalProjectDays) * 100}%` }}
          />
          <div className="flex justify-between mt-2 text-xs font-mono text-slate-600">
            <span>{fmtDate(TIMELINE_START)}</span>
            <span className="text-amber-500/80">⭐ May 31</span>
            <span className="text-pink-500/80">📣 Jun 15</span>
            <span className="text-rose-500/80">🔧 Jun 30</span>
            <span>{fmtDate(TIMELINE_END)}</span>
          </div>
        </section>

        {/* ── Gantt Timeline ── */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle size={14} className="text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Interactive Gantt Timeline</h2>
            <span className="ml-auto text-xs text-slate-600 font-mono hidden sm:block">
              Hover bars for details
            </span>
          </div>
          <GanttChart />
        </section>

        {/* ── Phase Details ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Server size={14} className="text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Phase Details</h2>
            <span className="ml-1 text-xs text-slate-600">— click to expand</span>
          </div>
          <PhaseList />
        </section>

        {/* ── Owner Map ── */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Ownership Map</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PHASES.map(phase => {
              const oc = OWNER_COLORS[phase.owner];
              return (
                <div key={phase.id} className={`rounded-xl border p-4 ${oc.bg} ${oc.border}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: phase.color }}
                    >
                      {phase.ownerShort}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${oc.text}`}>{phase.owner}</p>
                      <p className="text-xs text-slate-500">{phase.phase}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{phase.label}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-mono text-slate-500">
                    <Clock size={10} />
                    {fmtDate(phase.start)}
                    {!phase.isMilestone && ` – ${fmtDate(phase.end)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-700 font-mono pb-4">
          Data Migration Command Center · AWS Cloud Modernisation · Q2 2026 · Built with React + Tailwind
        </footer>
      </main>
    </div>
  );
}
