import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

const FILTERS = ['all', 'pending', 'confirmed'];

export function PaymentsPage() {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('pending');
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('payment_requests')
      .select('*, tournaments(title), players:host_uid(full_name, ff_uid)')
      .order('created_at', { ascending: true });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setRequests(data || []);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

  const handleConfirm = async (req) => {
    const { error } = await supabaseAdmin
      .from('payment_requests')
      .update({ status: 'confirmed' })
      .eq('id', req.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to confirm payment.', 'error');
      return;
    }

    // Ensure registration is confirmed and filled_slots incremented
    await supabaseAdmin.from('tournament_registrations').upsert({
      tournament_id: req.tournament_id,
      host_player_id: req.host_player_id,
      team_name: req.team_name,
      status: 'confirmed',
    });
    await supabaseAdmin.rpc('increment_filled_slots', { tid: req.tournament_id }).catch(() => {
      // fallback: naive increment
      supabaseAdmin
        .from('tournaments')
        .update({ filled_slots: (req.tournaments?.filled_slots || 0) + 1 })
        .eq('id', req.tournament_id);
    });

    if (req.host_player_id) {
      await supabaseAdmin.from('notifications').insert({
        player_id: req.host_player_id,
        message: `Your payment for ${req.tournaments?.title || 'the tournament'} has been confirmed. You're in!`,
      });
    }

    notify('Payment confirmed and slot granted.');
    load();
  };

  const visible = requests.filter((r) => (filter === 'all' ? true : r.status === filter));

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Payment confirmations</h1>
          <p className="text-xs text-slate-400">
            Confirm manual payments and grant tournament slots.
          </p>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={
                'chip-tab ' + (filter === f ? 'chip-tab--active' : 'hover:bg-slate-900/80')
              }
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="card overflow-x-auto text-xs">
        {loading ? (
          <p className="text-xs text-slate-400">Loading payment requests…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-slate-400">No payment requests.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Host UID</th>
                <th>Player name</th>
                <th>Tournament</th>
                <th>Team name</th>
                <th>Team members</th>
                <th>Requested at</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, idx) => (
                <tr key={r.id}>
                  <td>{idx + 1}</td>
                  <td>{r.host_uid}</td>
                  <td>{r.players?.full_name || '—'}</td>
                  <td>{r.tournaments?.title || '—'}</td>
                  <td>{r.team_name}</td>
                  <td>{r.team_members_summary}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <span
                      className={
                        'status-pill ' +
                        (r.status === 'pending' ? 'pending' : 'approved')
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        className="btn-primary text-11px"
                        onClick={() => handleConfirm(r)}
                      >
                        Confirm
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
