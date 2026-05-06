import React from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

// game_profiles.status values coming from the DB
const STATUS_FILTERS = ['all', 'pending', 'verified', 'rejected'];

const STATUS_PILL = {
  pending:  'status-pill pending',
  verified: 'status-pill approved',
  rejected: 'status-pill rejected',
};

export function PlayersPage() {
  const { gameId } = useParams();

  const [pending, setPending]   = React.useState([]);
  const [profiles, setProfiles] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch]     = React.useState('');
  const [loadingPending, setLoadingPending] = React.useState(true);
  const [loadingAll, setLoadingAll]         = React.useState(true);
  const [toast, setToast]       = React.useState(null);
  const [confirm, setConfirm]   = React.useState({ open: false });
  const [rejectionReason, setRejectionReason] = React.useState({});

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const loadPending = async () => {
    setLoadingPending(true);
    const { data, error } = await supabaseAdmin
      .from('game_profiles')
      .select('id, game_uid, in_game_name, status, rejection_reason, created_at, players(id, full_name, email, phone)')
      .eq('game_id', gameId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) console.error(error);
    setPending(data || []);
    setLoadingPending(false);
  };

  const loadAll = async () => {
    setLoadingAll(true);
    const { data, error } = await supabaseAdmin
      .from('game_profiles')
      .select('id, game_uid, in_game_name, status, rejection_reason, created_at, players(id, full_name, email, phone)')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setProfiles(data || []);
    setLoadingAll(false);
  };

  React.useEffect(() => {
    loadPending();
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ── Notification helper ────────────────────────────────────────────────────

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sendNotification = async (playerId, title, body) => {
    await supabaseAdmin.from('notifications').insert({
      player_id: playerId,
      title,
      body,
      type: 'account',
    });
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleVerify = async (gp) => {
    const { error } = await supabaseAdmin
      .from('game_profiles')
      .update({ status: 'verified', rejection_reason: null })
      .eq('id', gp.id);
    if (error) { notify('Failed to verify profile.', 'error'); return; }
    await sendNotification(
      gp.players.id,
      'Game Profile Verified',
      `Your ${gameId.replace('_', ' ')} profile (${gp.in_game_name}) has been verified. You can now join tournaments!`,
    );
    notify(`${gp.in_game_name} verified.`);
    loadPending();
    loadAll();
  };

  const handleRejectConfirmed = async () => {
    const { gp } = confirm;
    const reason = (rejectionReason[gp.id] || '').trim();
    if (!reason) { notify('Enter a rejection reason first.', 'error'); return; }
    const { error } = await supabaseAdmin
      .from('game_profiles')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', gp.id);
    if (error) { notify('Failed to reject profile.', 'error'); return; }
    await sendNotification(
      gp.players.id,
      'Game Profile Rejected',
      `Your ${gameId.replace('_', ' ')} profile (${gp.in_game_name}) was rejected. Reason: ${reason}. Please update your details and resubmit.`,
    );
    notify(`${gp.in_game_name} rejected.`);
    setConfirm({ open: false });
    loadPending();
    loadAll();
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = profiles.filter((gp) => {
    if (statusFilter !== 'all' && gp.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      gp.in_game_name?.toLowerCase().includes(q) ||
      gp.game_uid?.toLowerCase().includes(q) ||
      gp.players?.full_name?.toLowerCase().includes(q) ||
      gp.players?.email?.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  const gameLabel = gameId
    ?.split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="space-y-6">

      {/* ── Pending verifications ── */}
      <section className="space-y-3">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-50">{gameLabel} — Player Profiles</h1>
          <p className="text-xs text-slate-400">
            Verify or reject {gameLabel} game profiles. Only verified players can register for tournaments.
          </p>
        </header>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Pending verifications</h2>
            <p className="text-[11px] text-slate-500">
              {pending.length} waiting · oldest first
            </p>
          </div>

          <div className="card overflow-x-auto">
            {loadingPending ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="text-xs text-slate-400">No pending profiles. All clear.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>IGN</th>
                    <th>UID</th>
                    <th>Tournvia Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Submitted</th>
                    <th>Rejection reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((gp) => (
                    <tr key={gp.id}>
                      <td className="font-medium text-slate-100">{gp.in_game_name}</td>
                      <td className="font-mono text-slate-300">{gp.game_uid}</td>
                      <td>{gp.players?.full_name || <span className="italic text-slate-500">—</span>}</td>
                      <td>{gp.players?.email || '—'}</td>
                      <td>{gp.players?.phone || <span className="text-slate-500">—</span>}</td>
                      <td className="text-slate-400">{new Date(gp.created_at).toLocaleString()}</td>
                      <td>
                        <input
                          type="text"
                          placeholder="Reason (required to reject)"
                          className="input text-[11px]"
                          value={rejectionReason[gp.id] || ''}
                          onChange={(e) =>
                            setRejectionReason((prev) => ({ ...prev, [gp.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="space-x-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="btn-primary text-[11px]"
                          onClick={() => handleVerify(gp)}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-[11px]"
                          onClick={() => setConfirm({ open: true, gp })}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ── All game profiles ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">All {gameLabel} profiles</h2>
            <p className="text-[11px] text-slate-500">Search by IGN, UID, name, or email.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search IGN, UID, name, email…"
              className="input w-60 text-[11px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={'chip-tab ' + (statusFilter === f ? 'chip-tab--active' : 'hover:bg-slate-900/80')}
                  onClick={() => setStatusFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card overflow-x-auto">
          {loadingAll ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400">No profiles match this filter.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>IGN</th>
                  <th>UID</th>
                  <th>Tournvia Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Rejection reason</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((gp) => (
                  <tr key={gp.id}>
                    <td className="font-medium text-slate-100">{gp.in_game_name}</td>
                    <td className="font-mono text-slate-300">{gp.game_uid}</td>
                    <td>{gp.players?.full_name || <span className="italic text-slate-500">—</span>}</td>
                    <td>{gp.players?.email || '—'}</td>
                    <td>{gp.players?.phone || <span className="text-slate-500">—</span>}</td>
                    <td>
                      <span className={STATUS_PILL[gp.status] ?? 'status-pill'}>
                        {gp.status.charAt(0).toUpperCase() + gp.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-slate-400 text-[11px]">
                      {gp.rejection_reason || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="text-slate-400">{new Date(gp.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm.open}
        title="Reject game profile?"
        description="The player will be notified with your reason and asked to resubmit."
        confirmLabel="Reject profile"
        onCancel={() => setConfirm({ open: false })}
        onConfirm={handleRejectConfirmed}
      />
    </div>
  );
}
