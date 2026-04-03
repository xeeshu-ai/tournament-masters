import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

const STATUS_FILTERS = ['all', 'approved', 'pending', 'rejected', 'banned'];

export function PlayersPage() {
  const [pending, setPending] = React.useState([]);
  const [players, setPlayers] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [loadingPending, setLoadingPending] = React.useState(true);
  const [loadingAll, setLoadingAll] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const [confirm, setConfirm] = React.useState({ open: false });
  const [rejectionReason, setRejectionReason] = React.useState({});

  const loadPending = async () => {
    setLoadingPending(true);
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setPending(data || []);
    setLoadingPending(false);
  };

  const loadPlayers = async () => {
    setLoadingAll(true);
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setPlayers(data || []);
    setLoadingAll(false);
  };

  React.useEffect(() => {
    loadPending();
    loadPlayers();
  }, []);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const upsertNotification = async (playerId, message) => {
    await supabaseAdmin.from('notifications').insert({ player_id: playerId, message });
  };

  const handleApprove = async (player) => {
    const { error } = await supabaseAdmin
      .from('players')
      .update({ status: 'approved', rejection_reason: null })
      .eq('id', player.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to approve player.', 'error');
      return;
    }
    await upsertNotification(
      player.id,
      'Your Tournvia account has been approved. Welcome aboard!',
    );
    notify('Player approved.');
    loadPending();
    loadPlayers();
  };

  const handleRejectConfirmed = async () => {
    const { player } = confirm;
    const reason = rejectionReason[player.id] || '';
    if (!reason.trim()) {
      notify('Please enter a rejection reason.', 'error');
      return;
    }
    const { error } = await supabaseAdmin
      .from('players')
      .update({ status: 'rejected', rejection_reason: reason.trim() })
      .eq('id', player.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to reject player.', 'error');
      return;
    }
    await upsertNotification(
      player.id,
      `Your account was rejected. Reason: ${reason}. You can edit your details and resubmit.`,
    );
    notify('Player rejected.');
    setConfirm({ open: false });
    loadPending();
    loadPlayers();
  };

  const filteredPlayers = players.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.ff_uid?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-50">Player management</h1>
          <p className="text-xs text-slate-400">Approve new players and manage the full roster.</p>
        </header>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Pending approvals</h2>
            <p className="text-11px text-slate-500">
              {pending.length} waiting | Oldest requests are shown first.
            </p>
          </div>
          <div className="card overflow-x-auto">
            {loadingPending ? (
              <p className="text-xs text-slate-400">Loading pending players…</p>
            ) : pending.length === 0 ? (
              <p className="text-xs text-slate-400">No pending approvals. Nice and clean.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Requested</th>
                    <th>Rejection reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id}>
                      <td>{p.ff_uid}</td>
                      <td>{p.full_name}</td>
                      <td>{p.email}</td>
                      <td>{p.phone || '—'}</td>
                      <td>{new Date(p.created_at).toLocaleString()}</td>
                      <td>
                        <input
                          type="text"
                          placeholder="Reason for rejection"
                          className="input text-[11px]"
                          value={rejectionReason[p.id] || ''}
                          onChange={(e) =>
                            setRejectionReason((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="space-x-2 text-right">
                        <button
                          type="button"
                          className="btn-primary text-[11px]"
                          onClick={() => handleApprove(p)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-[11px]"
                          onClick={() => setConfirm({ open: true, player: p })}
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">All players</h2>
            <p className="text-11px text-slate-500">
              Search across UID, name, or email and filter by status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search UID, name, email…"
              className="input w-56 text-[11px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={
                    'chip-tab ' + (statusFilter === f ? 'chip-tab--active' : 'hover:bg-slate-900/80')
                  }
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
            <p className="text-xs text-slate-400">Loading players…</p>
          ) : filteredPlayers.length === 0 ? (
            <p className="text-xs text-slate-400">No players match this filter.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.ff_uid}</td>
                    <td>{p.full_name}</td>
                    <td>{p.email}</td>
                    <td>
                      <span className={`status-pill ${p.status}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
      <ConfirmDialog
        open={confirm.open}
        title="Reject player?"
        description="This will move the player to the rejected state and notify them with your reason."
        confirmLabel="Reject player"
        onCancel={() => setConfirm({ open: false })}
        onConfirm={handleRejectConfirmed}
      />
    </div>
  );
}
