import React from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

const FILTERS = ['all', 'pending', 'confirmed'];

export function PaymentsPage() {
  const { gameId } = useParams();

  const [registrations, setRegistrations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        host_uid,
        team_name,
        team_members_summary,
        teammate_uid_1,
        teammate_uid_2,
        teammate_uid_3,
        status,
        razorpay_order_id,
        payment_id,
        slot_reserved_at,
        created_at,
        tournaments ( id, title, entry_fee, mode, format_label, game_id ),
        players!host_player_id ( full_name, ff_uid, phone )
      `)
      .eq('tournaments.game_id', gameId)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setRegistrations(data || []);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const filtered = registrations.filter((r) => {
    const matchStatus = filter === 'all' ? true : r.status === filter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return (
      matchStatus &&
      (r.host_uid?.toLowerCase().includes(q) ||
        r.team_name?.toLowerCase().includes(q) ||
        r.players?.full_name?.toLowerCase().includes(q) ||
        r.razorpay_order_id?.toLowerCase().includes(q) ||
        r.payment_id?.toLowerCase().includes(q) ||
        r.tournaments?.title?.toLowerCase().includes(q))
    );
  });

  const totalRevenue = registrations
    .filter((r) => r.status === 'confirmed' && r.payment_id)
    .reduce((sum, r) => sum + Number(r.tournaments?.entry_fee || 0), 0);

  const pendingCount = registrations.filter(
    (r) => r.status === 'pending' && r.razorpay_order_id,
  ).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Payments</h1>
          <p className="text-xs text-slate-400">
            Automatic Razorpay payments — all registrations with payment info for this game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg bg-slate-800/60 px-3 py-1.5 ring-1 ring-slate-700">
            <span className="text-slate-400">Total confirmed revenue</span>
            <p className="font-semibold text-emerald-400">₹{totalRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 px-3 py-1.5 ring-1 ring-slate-700">
            <span className="text-slate-400">Pending payments</span>
            <p className="font-semibold text-amber-400">{pendingCount}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 px-3 py-1.5 ring-1 ring-slate-700">
            <span className="text-slate-400">Total registrations</span>
            <p className="font-semibold text-slate-100">{registrations.length}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={'chip-tab ' + (filter === f ? 'chip-tab--active' : 'hover:bg-slate-900/80')}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search UID, name, Order ID, Payment ID, tournament…"
          className="input w-72 text-[11px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto text-xs">
        {loading ? (
          <p className="text-xs text-slate-400">Loading payments…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400">No registrations match this filter.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>UID</th>
                <th>Tournament</th>
                <th>Tournament ID</th>
                <th>Amount Paid</th>
                <th>Team</th>
                <th>Teammates</th>
                <th>Order ID</th>
                <th>Payment ID</th>
                <th>Paid At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const teammates = [r.teammate_uid_1, r.teammate_uid_2, r.teammate_uid_3].filter(Boolean);
                return (
                  <tr key={r.id}>
                    <td className="text-slate-500">{idx + 1}</td>

                    <td>
                      <div>{r.players?.full_name || '—'}</div>
                      {r.players?.phone && (
                        <div className="text-[10px] text-slate-500">{r.players.phone}</div>
                      )}
                    </td>

                    <td className="font-mono">{r.host_uid}</td>

                    <td>
                      <div>{r.tournaments?.title || '—'}</div>
                      <div className="text-[10px] text-slate-500 uppercase">
                        {r.tournaments?.mode} · {r.tournaments?.format_label}
                      </div>
                    </td>

                    <td>
                      <span
                        className="font-mono text-[10px] text-slate-400 cursor-pointer hover:text-slate-200"
                        title={r.tournaments?.id}
                        onClick={() => navigator.clipboard?.writeText(r.tournaments?.id || '')}
                      >
                        {r.tournaments?.id ? `${r.tournaments.id.slice(0, 8)}…` : '—'}
                      </span>
                    </td>

                    <td>
                      {r.tournaments?.entry_fee != null ? (
                        <span className="font-semibold text-emerald-400">
                          ₹{Number(r.tournaments.entry_fee).toLocaleString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>{r.team_name || '—'}</td>

                    <td>
                      {teammates.length > 0 ? (
                        <div className="space-y-0.5">
                          {teammates.map((uid, i) => (
                            <div key={uid || i} className="font-mono text-[10px] text-slate-400">
                              {uid}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">Solo</span>
                      )}
                    </td>

                    <td>
                      {r.razorpay_order_id ? (
                        <span className="font-mono text-[10px] text-sky-400">
                          {r.razorpay_order_id}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">No order</span>
                      )}
                    </td>

                    <td>
                      {r.payment_id ? (
                        <span className="font-mono text-[10px] text-emerald-400">
                          {r.payment_id}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">Not paid</span>
                      )}
                    </td>

                    <td className="text-slate-400 whitespace-nowrap">
                      {r.slot_reserved_at
                        ? new Date(r.slot_reserved_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>

                    <td>
                      <span
                        className={
                          'status-pill ' +
                          (r.status === 'confirmed'
                            ? 'approved'
                            : r.status === 'pending'
                            ? 'pending'
                            : '')
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
