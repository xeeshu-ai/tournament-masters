import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

export function NameChangesPage() {
  const [pending, setPending] = React.useState([]);
  const [reviewed, setReviewed] = React.useState([]);
  const [loadingPending, setLoadingPending] = React.useState(true);
  const [loadingReviewed, setLoadingReviewed] = React.useState(false);
  const [showReviewed, setShowReviewed] = React.useState(false);
  const [rejectionReasons, setRejectionReasons] = React.useState({});
  const [confirmApprove, setConfirmApprove] = React.useState({ open: false, req: null });
  const [confirmReject, setConfirmReject] = React.useState({ open: false, req: null });
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPending = async () => {
    setLoadingPending(true);
    const { data, error } = await supabaseAdmin
      .from('name_change_requests')
      .select('*, player:player_id(full_name, ff_uid, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }); // oldest first
    if (error) console.error(error);
    setPending(data || []);
    setLoadingPending(false);
  };

  const loadReviewed = async () => {
    setLoadingReviewed(true);
    const { data, error } = await supabaseAdmin
      .from('name_change_requests')
      .select('*, player:player_id(full_name, ff_uid, email)')
      .in('status', ['approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error(error);
    setReviewed(data || []);
    setLoadingReviewed(false);
  };

  React.useEffect(() => {
    loadPending();
  }, []);

  React.useEffect(() => {
    if (showReviewed) loadReviewed();
  }, [showReviewed]);

  // ── APPROVE ──────────────────────────────────────────────────────────────
  const handleApproveConfirmed = async () => {
    const { req } = confirmApprove;

    // 1. Update the player's actual display name
    const { error: playerErr } = await supabaseAdmin
      .from('players')
      .update({ full_name: req.requested_name })
      .eq('id', req.player_id);
    if (playerErr) {
      console.error(playerErr);
      notify('Failed to update player name.', 'error');
      setConfirmApprove({ open: false, req: null });
      return;
    }

    // 2. Mark the request as approved
    const { error: reqErr } = await supabaseAdmin
      .from('name_change_requests')
      .update({ status: 'approved' })
      .eq('id', req.id);
    if (reqErr) {
      console.error(reqErr);
      notify('Name updated but request status failed to save.', 'error');
      setConfirmApprove({ open: false, req: null });
      return;
    }

    // 3. Notify the player
    await supabaseAdmin.from('notifications').insert({
      player_id: req.player_id,
      message: `Your name change request to "${req.requested_name}" has been approved. Your profile now shows the new name.`,
    });

    notify(`Name changed to "${req.requested_name}" and player notified.`);
    setConfirmApprove({ open: false, req: null });
    loadPending();
    if (showReviewed) loadReviewed();
  };

  // ── REJECT ───────────────────────────────────────────────────────────────
  const handleRejectConfirmed = async () => {
    const { req } = confirmReject;
    const reason = rejectionReasons[req.id]?.trim();
    if (!reason) {
      notify('Please enter a rejection reason.', 'error');
      return;
    }

    // 1. Mark the request as rejected with reason
    const { error } = await supabaseAdmin
      .from('name_change_requests')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', req.id);
    if (error) {
      console.error(error);
      notify('Failed to reject request.', 'error');
      setConfirmReject({ open: false, req: null });
      return;
    }

    // 2. Notify the player
    await supabaseAdmin.from('notifications').insert({
      player_id: req.player_id,
      message: `Your name change request to "${req.requested_name}" was rejected. Reason: ${reason}. You may submit a new request with a different name.`,
    });

    notify('Request rejected and player notified.');
    setConfirmReject({ open: false, req: null });
    setRejectionReasons((prev) => {
      const next = { ...prev };
      delete next[req.id];
      return next;
    });
    loadPending();
    if (showReviewed) loadReviewed();
  };

  // ── STATUS PILL ──────────────────────────────────────────────────────────
  const StatusPill = ({ status }) => (
    <span
      className={
        'status-pill ' +
        (status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending')
      }
    >
      {status}
    </span>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Name change requests</h1>
        <p className="text-xs text-slate-400">
          Approve or reject player display name changes. Player is notified either way.
        </p>
      </header>

      {/* ── PENDING ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Pending requests
          </h2>
          <p className="text-11px text-slate-500">
            {pending.length} waiting · Oldest shown first
          </p>
        </div>

        <div className="card overflow-x-auto">
          {loadingPending ? (
            <p className="text-xs text-slate-400">Loading requests…</p>
          ) : pending.length === 0 ? (
            <p className="text-xs text-slate-400">No pending name change requests. All clear.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>FF UID</th>
                  <th>Player</th>
                  <th>Current name</th>
                  <th>→</th>
                  <th>Requested name</th>
                  <th>Submitted</th>
                  <th>Rejection reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((req) => (
                  <tr key={req.id}>
                    <td className="font-mono text-11px">{req.player?.ff_uid || '—'}</td>
                    <td>{req.player?.full_name || req.current_name}</td>
                    <td className="text-slate-400">{req.current_name}</td>
                    <td className="text-slate-600">→</td>
                    <td className="font-semibold text-sky-300">{req.requested_name}</td>
                    <td className="whitespace-nowrap text-slate-400">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Reason required to reject"
                        className="input w-44 text-[11px]"
                        value={rejectionReasons[req.id] || ''}
                        onChange={(e) =>
                          setRejectionReasons((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="btn-primary text-[11px]"
                        onClick={() => setConfirmApprove({ open: true, req })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-[11px]"
                        onClick={() => {
                          if (!rejectionReasons[req.id]?.trim()) {
                            notify('Enter a rejection reason first.', 'error');
                            return;
                          }
                          setConfirmReject({ open: true, req });
                        }}
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
      </section>

      {/* ── REVIEWED HISTORY ── */}
      <section>
        <details
          onToggle={(e) => setShowReviewed(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Reviewed history (last 50)
          </summary>
          <div className="mt-3 card overflow-x-auto">
            {!showReviewed ? null : loadingReviewed ? (
              <p className="text-xs text-slate-400">Loading history…</p>
            ) : reviewed.length === 0 ? (
              <p className="text-xs text-slate-400">No reviewed requests yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>FF UID</th>
                    <th>Player</th>
                    <th>From</th>
                    <th>→</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Rejection reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewed.map((req) => (
                    <tr key={req.id} className="opacity-75">
                      <td className="font-mono text-11px">{req.player?.ff_uid || '—'}</td>
                      <td>{req.player?.full_name || '—'}</td>
                      <td className="text-slate-400">{req.current_name}</td>
                      <td className="text-slate-600">→</td>
                      <td>{req.requested_name}</td>
                      <td>
                        <StatusPill status={req.status} />
                      </td>
                      <td className="text-11px text-slate-500">
                        {req.rejection_reason || '—'}
                      </td>
                      <td className="whitespace-nowrap text-slate-400">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </section>

      {/* ── DIALOGS ── */}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <ConfirmDialog
        open={confirmApprove.open}
        title="Approve name change?"
        description={`"${confirmApprove.req?.current_name}" → "${confirmApprove.req?.requested_name}". This updates the player's profile immediately and notifies them.`}
        confirmLabel="Yes, approve"
        onCancel={() => setConfirmApprove({ open: false, req: null })}
        onConfirm={handleApproveConfirmed}
      />

      <ConfirmDialog
        open={confirmReject.open}
        title="Reject name change?"
        description={`Request for "${confirmReject.req?.requested_name}" will be rejected with reason: "${rejectionReasons[confirmReject.req?.id] || ''}". Player will be notified.`}
        confirmLabel="Yes, reject"
        onCancel={() => setConfirmReject({ open: false, req: null })}
        onConfirm={handleRejectConfirmed}
      />
    </div>
  );
}
