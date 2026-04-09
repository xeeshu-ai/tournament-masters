import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

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
    expired:   'bg-slate-800     text-slate-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
      map[status] || 'bg-slate-800 text-slate-400'
    }`}>
      {status || 'unknown'}
    </span>
  );
}

// ─── Team Card (collapsible) ──────────────────────────────────────────────────
function TeamCard({ reg, idx, onRemove }) {
  const [open, setOpen] = React.useState(false);

  // Use the correct column names: teammate_uid_1, teammate_uid_2, teammate_uid_3
  const teammates = [
    reg.teammate_uid_1 ? { uid: reg.teammate_uid_1 } : null,
    reg.teammate_uid_2 ? { uid: reg.teammate_uid_2 } : null,
    reg.teammate_uid_3 ? { uid: reg.teammate_uid_3 } : null,
  ].filter(Boolean);

  const totalMembers = 1 + teammates.length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 text-xs overflow-hidden">
      {/* ─ Accordion header ─ */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-sky-900/60 text-[10px] font-bold text-sky-300">
            {idx + 1}
          </span>
          <span className="font-semibold text-slate-50 truncate">{reg.team_name || 'Unnamed team'}</span>
          <span className="text-slate-500 flex-shrink-0">{totalMembers} member{totalMembers !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusPill status={reg.status} />
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[11px] bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
            onClick={(e) => { e.stopPropagation(); onRemove(reg); }}
            title="Remove registration"
          >
            Remove
          </button>
          <svg
            className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* ─ Expanded details ─ */}
      {open && (
        <div className="border-t border-slate-800 px-3 py-2.5 space-y-2.5">

          {/* Host */}
          <div className="rounded-lg bg-slate-950/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1">Host (Member 1)</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {reg.host_name
                ? <span className="text-slate-100 font-medium">{reg.host_name}</span>
                : <span className="text-slate-500 italic">Name not linked</span>
              }
              <span className="font-mono text-sky-300 select-all">{reg.host_uid}</span>
            </div>
          </div>

          {/* Teammates */}
          {teammates.length > 0 ? (
            <div className="rounded-lg bg-slate-950/70 px-3 py-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Teammates ({teammates.length})
              </p>
              {teammates.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="text-slate-500 w-16 flex-shrink-0">Member {i + 2}:</span>
                  <span className="font-mono text-slate-300 select-all">{m.uid}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-600 italic">Solo registration — no teammates.</p>
          )}

          {/* Payment */}
          {(reg.razorpay_order_id || reg.payment_id) && (
            <div className="rounded-lg bg-slate-950/70 px-3 py-2 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1">Payment</p>
              {reg.razorpay_order_id && <p className="font-mono text-[11px] text-slate-400">Order: {reg.razorpay_order_id}</p>}
              {reg.payment_id        && <p className="font-mono text-[11px] text-slate-400">Payment ID: {reg.payment_id}</p>}
            </div>
          )}

          <p className="text-[11px] text-slate-600">Registered: {fmtDate(reg.created_at)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tournament Section (collapsible) ────────────────────────────────────────
function TournamentSection({ tournament, registrations, onRemove }) {
  const [open, setOpen] = React.useState(true);
  const total     = registrations.length;
  const confirmed = registrations.filter((r) => r.status === 'confirmed').length;

  return (
    <div className="card space-y-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
        onClick={() => setOpen((o) => !o)}
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
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

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

// ─── Remove dialog ────────────────────────────────────────────────────────────
function RemoveDialog({ reg, onCancel, onConfirm }) {
  if (!reg) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="card w-full max-w-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Remove registration?</h2>
        <p className="text-xs text-slate-300">
          Remove <span className="font-semibold text-slate-50">{reg.team_name || 'this team'}</span>{' '}
          (host UID: <span className="font-mono text-sky-300">{reg.host_uid}</span>) from the tournament?
          The filled slots counter will update automatically.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="text-xs rounded px-3 py-1.5 bg-red-700 text-white hover:bg-red-600 transition-colors"
            onClick={onConfirm}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function RegistrationsPage() {
  const [tournaments,      setTournaments]      = React.useState([]);
  const [regsByTournament, setRegsByTournament] = React.useState({});
  const [loading,          setLoading]          = React.useState(true);
  const [search,           setSearch]           = React.useState('');
  const [removeTarget,     setRemoveTarget]     = React.useState(null);
  const [toast,            setToast]            = React.useState(null);
  const [filter,           setFilter]           = React.useState('active');

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);

    // 1. Tournaments
    const { data: tData, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('id, title, mode, format_label, start_time, registration_status, is_archived, filled_slots, max_slots')
      .order('start_time', { ascending: false });

    if (tErr) {
      console.error('tournaments fetch error:', tErr);
      notify('Failed to load tournaments.', 'error');
      setLoading(false);
      return;
    }

    // 2. Registrations — correct column names: teammate_uid_1/2/3
    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(
        'id, tournament_id, host_uid, team_name, status, created_at, teammate_uid_1, teammate_uid_2, teammate_uid_3, razorpay_order_id, payment_id'
      )
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('registrations fetch error:', rErr);
      notify('Failed to load registrations.', 'error');
      setTournaments(tData || []);
      setRegsByTournament({});
      setLoading(false);
      return;
    }

    // 3. Resolve host names via ff_uid → full_name
    const hostUids = [...new Set((rData || []).map((r) => r.host_uid).filter(Boolean))];
    let nameMap = {};

    if (hostUids.length > 0) {
      const { data: pData, error: pErr } = await supabaseAdmin
        .from('players')
        .select('ff_uid, full_name')
        .in('ff_uid', hostUids);

      if (pErr) {
        console.error('players name fetch error:', pErr);
      } else {
        nameMap = Object.fromEntries((pData || []).map((p) => [p.ff_uid, p.full_name]));
      }
    }

    // 4. Group by tournament, attach host_name
    const grouped = {};
    for (const reg of rData || []) {
      const row = { ...reg, host_name: nameMap[reg.host_uid] || null };
      if (!grouped[reg.tournament_id]) grouped[reg.tournament_id] = [];
      grouped[reg.tournament_id].push(row);
    }

    setTournaments(tData || []);
    setRegsByTournament(grouped);
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  // Remove registration — trigger handles filled_slots decrement automatically
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

    notify('Registration removed.');
    setRemoveTarget(null);
    load();
  };

  // Filter + search
  const visibleTournaments = tournaments
    .filter((t) => (filter === 'all' ? true : !t.is_archived))
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      if (t.title.toLowerCase().includes(q)) return true;
      const regs = regsByTournament[t.id] || [];
      return regs.some(
        (r) =>
          r.host_uid?.toLowerCase().includes(q) ||
          r.team_name?.toLowerCase().includes(q) ||
          r.host_name?.toLowerCase().includes(q) ||
          r.teammate_uid_1?.toLowerCase().includes(q) ||
          r.teammate_uid_2?.toLowerCase().includes(q) ||
          r.teammate_uid_3?.toLowerCase().includes(q)
      );
    });

  const totalRegs     = Object.values(regsByTournament).reduce((s, a) => s + a.length, 0);
  const confirmedRegs = Object.values(regsByTournament).flat().filter((r) => r.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Registrations</h1>
          <p className="text-xs text-slate-400">View all registered teams and player UIDs per tournament.</p>
        </div>
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
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['active', 'all'].map((f) => (
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

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="card h-14 animate-pulse bg-slate-900/60" />)}
        </div>
      ) : visibleTournaments.length === 0 ? (
        <div className="card text-xs text-slate-400">No tournaments match your search.</div>
      ) : (
        <div className="space-y-3">
          {visibleTournaments.map((t) => (
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
