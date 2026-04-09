import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusPill({ status }) {
  const map = {
    confirmed: 'bg-emerald-900/50 text-emerald-300',
    pending:   'bg-amber-900/50  text-amber-300',
    rejected:  'bg-red-900/50    text-red-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[status] || 'bg-slate-800 text-slate-400'}`}>
      {status || 'unknown'}
    </span>
  );
}

// ─── Team card ───────────────────────────────────────────────────────────────
function TeamCard({ reg, idx, onRemove }) {
  const teammates = [
    reg.teammate_uid_1,
    reg.teammate_uid_2,
    reg.teammate_uid_3,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-xs">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900/60 text-[10px] font-bold text-sky-300">
            {idx + 1}
          </span>
          <span className="font-semibold text-slate-50">{reg.team_name || 'Unnamed team'}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={reg.status} />
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[11px] bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
            onClick={() => onRemove(reg)}
            title="Remove registration"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Host row */}
      <div className="rounded-lg bg-slate-950/60 px-3 py-2 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Host</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
          <span className="text-slate-200">{reg.players?.fullname || '—'}</span>
          <span className="font-mono text-sky-300">{reg.host_uid}</span>
        </div>
      </div>

      {/* Teammates */}
      {teammates.length > 0 && (
        <div className="rounded-lg bg-slate-950/60 px-3 py-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Teammates</p>
          {teammates.map((uid, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-slate-500">{i + 1}.</span>
              <span className="font-mono text-slate-300">{uid}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary fallback if no individual UIDs stored */}
      {teammates.length === 0 && reg.team_members_summary && (
        <div className="rounded-lg bg-slate-950/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Team members (summary)</p>
          <p className="text-slate-400 whitespace-pre-line">{reg.team_members_summary}</p>
        </div>
      )}

      {/* Footer: registered at */}
      <p className="text-[11px] text-slate-600">Registered: {fmtDate(reg.created_at)}</p>
    </div>
  );
}

// ─── Tournament section ───────────────────────────────────────────────────────
function TournamentSection({ tournament, registrations, onRemove }) {
  const [open, setOpen] = React.useState(false);
  const total = registrations.length;
  const confirmed = registrations.filter(r => r.status === 'confirmed').length;

  return (
    <div className="card space-y-0">
      {/* Accordion header */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-50">{tournament.title}</span>
          <span className="text-[11px] text-slate-400">
            {tournament.mode?.toUpperCase()} · {tournament.format_label}
          </span>
          <span className="rounded-full bg-sky-900/50 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
            {confirmed}/{total} confirmed
          </span>
          {tournament.start_time && (
            <span className="text-[11px] text-slate-500">{fmtDate(tournament.start_time)}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Expanded team list */}
      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
          {total === 0 ? (
            <p className="text-[11px] text-slate-500">No registrations yet for this tournament.</p>
          ) : (
            registrations.map((reg, i) => (
              <TeamCard key={reg.id} reg={reg} idx={i} onRemove={onRemove} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Remove confirm dialog ────────────────────────────────────────────────────
function RemoveDialog({ reg, onCancel, onConfirm }) {
  if (!reg) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="card w-full max-w-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Remove registration?</h2>
        <p className="text-xs text-slate-300">
          Remove <span className="font-semibold text-slate-50">{reg.team_name || 'this team'}</span> (host UID: <span className="font-mono text-sky-300">{reg.host_uid}</span>) from the tournament?
          This will also decrement the filled slots counter.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>Cancel</button>
          <button type="button" className="text-xs rounded px-3 py-1.5 bg-red-700 text-white hover:bg-red-600 transition-colors" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function RegistrationsPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [regsByTournament, setRegsByTournament] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [filter, setFilter] = React.useState('active'); // 'active' | 'all'

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);

    // Load all non-archived tournaments
    const { data: tData, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('id, title, mode, format_label, start_time, registration_status, is_archived, filled_slots, max_slots')
      .order('start_time', { ascending: false });

    if (tErr) {
      console.error(tErr);
      setLoading(false);
      return;
    }

    // Load all registrations joined with player name
    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select('*, players!host_player_id(fullname, ffuid)')
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error(rErr);
    }

    // Group registrations by tournament_id
    const grouped = {};
    for (const reg of rData || []) {
      if (!grouped[reg.tournament_id]) grouped[reg.tournament_id] = [];
      grouped[reg.tournament_id].push(reg);
    }

    setTournaments(tData || []);
    setRegsByTournament(grouped);
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  // ── Remove a registration ──────────────────────────────────────────────────
  const handleRemoveConfirmed = async () => {
    const reg = removeTarget;
    if (!reg) return;

    const { error } = await supabaseAdmin
      .from('tournament_registrations')
      .delete()
      .eq('id', reg.id);

    if (error) {
      console.error(error);
      notify('Failed to remove registration.', 'error');
      setRemoveTarget(null);
      return;
    }

    // Decrement filled_slots
    const { data: fresh } = await supabaseAdmin
      .from('tournaments')
      .select('filled_slots')
      .eq('id', reg.tournament_id)
      .maybeSingle();
    await supabaseAdmin
      .from('tournaments')
      .update({ filled_slots: Math.max(0, (fresh?.filled_slots || 1) - 1) })
      .eq('id', reg.tournament_id);

    notify('Registration removed.');
    setRemoveTarget(null);
    load();
  };

  // ── Filter + search ────────────────────────────────────────────────────────
  const visibleTournaments = tournaments
    .filter(t => filter === 'all' ? true : !t.is_archived)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      // Match tournament title OR any UID / team name in its registrations
      if (t.title.toLowerCase().includes(q)) return true;
      const regs = regsByTournament[t.id] || [];
      return regs.some(r =>
        r.host_uid?.toLowerCase().includes(q) ||
        r.team_name?.toLowerCase().includes(q) ||
        r.players?.fullname?.toLowerCase().includes(q) ||
        r.teammate_uid_1?.toLowerCase().includes(q) ||
        r.teammate_uid_2?.toLowerCase().includes(q) ||
        r.teammate_uid_3?.toLowerCase().includes(q)
      );
    });

  // Total counts for header stats
  const totalRegs = Object.values(regsByTournament).reduce((s, a) => s + a.length, 0);
  const confirmedRegs = Object.values(regsByTournament)
    .flat()
    .filter(r => r.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Registrations</h1>
          <p className="text-xs text-slate-400">
            View all registered teams and player UIDs per tournament.
          </p>
        </div>
        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-[11px]">
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center min-w-[70px]">
            <p className="text-lg font-bold text-slate-50 tabular-nums">{totalRegs}</p>
            <p className="text-slate-500">Total teams</p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center min-w-[70px]">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{confirmedRegs}</p>
            <p className="text-slate-500">Confirmed</p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center min-w-[70px]">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{totalRegs - confirmedRegs}</p>
            <p className="text-slate-500">Pending</p>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input max-w-xs text-xs"
          placeholder="Search by UID, name, team…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['active', 'all'].map(f => (
            <button
              key={f}
              type="button"
              className={'chip-tab ' + (filter === f ? 'chip-tab--active' : 'hover:bg-slate-900/80')}
              onClick={() => setFilter(f)}
            >
              {f === 'active' ? 'Active only' : 'All incl. archived'}
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary text-xs ml-auto" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="card h-14 animate-pulse bg-slate-900/60" />
          ))}
        </div>
      ) : visibleTournaments.length === 0 ? (
        <div className="card text-xs text-slate-400">No tournaments match your search.</div>
      ) : (
        <div className="space-y-3">
          {visibleTournaments.map(t => (
            <TournamentSection
              key={t.id}
              tournament={t}
              registrations={regsByTournament[t.id] || []}
              onRemove={setRemoveTarget}
            />
          ))}
        </div>
      )}

      <RemoveDialog
        reg={removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemoveConfirmed}
      />
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
