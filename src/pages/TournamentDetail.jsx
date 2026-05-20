import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TOURNAMENT_TYPES } from '../constants';
import { Toast } from '../components/Toast';

export function TournamentDetailPage() {
  const { gameId, tournamentId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState(null);
  const [registrations, setRegistrations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = React.useCallback(async () => {
    setLoading(true);

    const { data: tData, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .eq('game_id', gameId)
      .maybeSingle();

    if (tErr) {
      console.error('tournament fetch error:', tErr);
      notify('Failed to load tournament.', 'error');
      setLoading(false);
      return;
    }

    setTournament(tData || null);

    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        tournament_id,
        host_uid,
        team_name,
        status,
        created_at,
        razorpay_order_id,
        payment_id,
        slot_reserved_at,
        teammate_uid_1,
        teammate_uid_2,
        teammate_uid_3,
        players!host_player_id ( full_name, ff_uid, phone )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('registrations fetch error:', rErr);
    }

    setRegistrations(rData || []);
    setLoading(false);
  }, [gameId, tournamentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleBack = () => {
    navigate(`/${gameId}/tournaments`);
  };

  const openResults = () => {
    navigate(`/${gameId}/results?tournamentId=${tournamentId}`);
  };

  const openBrackets = () => {
    navigate(`/${gameId}/brackets?tournamentId=${tournamentId}`);
  };

  const typeLabel = tournament
    ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type
    : '';

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const pending = registrations.filter((r) => r.status === 'pending');
  const totalRevenue =
    tournament && tournament.entry_fee
      ? confirmed.filter((r) => r.payment_id).reduce((sum) => sum + Number(tournament.entry_fee || 0), 0)
      : 0;

  if (!tournament && !loading) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to tournaments
        </button>
        <div className="card text-xs text-red-400">Tournament not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleBack}
            className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to tournaments
          </button>
          <h1 className="text-xl font-semibold text-slate-50">{tournament?.title || 'Tournament'}</h1>
          <p className="text-xs text-slate-400">
            Manage everything for this tournament — overview, registrations, revenue, and deep links
            into results and bracket manager.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] mt-1">
            {typeLabel && <span className="badge">{typeLabel}</span>}
            {tournament?.mode && (
              <span className="badge bg-slate-800 text-slate-200">
                {tournament.mode.toUpperCase()}
              </span>
            )}
            <span className="badge bg-slate-900 text-slate-300">
              Slots: {tournament?.filled_slots || 0}/{tournament?.max_slots || 0}
            </span>
            <span
              className={
                'status-pill ' +
                (tournament?.registration_status === 'open' ? 'pending' : 'approved')
              }
            >
              Reg: {tournament?.registration_status}
            </span>
            {tournament?.status && (
              <span className="status-pill approved">Status: {tournament.status}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 text-xs min-w-[180px]">
          <button type="button" className="btn-primary" onClick={openResults}>
            Open results entry
          </button>
          {tournament?.type === 'long' && (tournament.mode === 'cs' || tournament.mode === 'lw') && (
            <button type="button" className="btn-secondary" onClick={openBrackets}>
              Open bracket manager
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Overview</h2>
          <div className="space-y-1 text-slate-300">
            <p>
              <span className="text-slate-500">Format:</span> {tournament?.format_label || '—'}
            </p>
            {tournament?.mode === 'br' && (
              <p>
                <span className="text-slate-500">Map:</span> {tournament.map || '—'}
              </p>
            )}
            <p>
              <span className="text-slate-500">Entry fee:</span>{' '}
              {tournament?.entry_fee ? `₹${Number(tournament.entry_fee).toLocaleString()}` : 'Free'}
            </p>
            <p>
              <span className="text-slate-500">Entry closing:</span>{' '}
              {tournament?.entry_closing_time
                ? new Date(tournament.entry_closing_time).toLocaleString('en-IN')
                : '—'}
            </p>
            <p>
              <span className="text-slate-500">Match start:</span>{' '}
              {tournament?.start_time
                ? new Date(tournament.start_time).toLocaleString('en-IN')
                : '—'}
            </p>
          </div>
        </div>

        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Registrations & revenue</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500">Total teams</p>
              <p className="text-lg font-bold text-slate-50 tabular-nums">
                {registrations.length}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500">Confirmed</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">
                {confirmed.length}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500">Pending</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">
                {pending.length}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500">Revenue (confirmed)</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Prize & points</h2>
          <p className="text-[11px] text-slate-300 whitespace-pre-wrap">
            {tournament?.prize_text || 'No prize distribution text set.'}
          </p>
          {tournament?.points_table && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.14em] mt-2">
                Points table
              </p>
              <p className="text-[11px] text-slate-300 whitespace-pre-wrap">
                {tournament.points_table}
              </p>
            </>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-100">Teams registered</h2>
        <div className="card overflow-x-auto text-xs">
          {loading ? (
            <p className="text-xs text-slate-400">Loading registrations…</p>
          ) : registrations.length === 0 ? (
            <p className="text-xs text-slate-400">
              No registrations yet for this tournament.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Host</th>
                  <th>UID</th>
                  <th>Status</th>
                  <th>Order ID</th>
                  <th>Payment ID</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r, idx) => {
                  const teammates = [
                    r.teammate_uid_1,
                    r.teammate_uid_2,
                    r.teammate_uid_3,
                  ].filter(Boolean);
                  return (
                    <tr key={r.id}>
                      <td className="text-slate-500">{idx + 1}</td>
                      <td>
                        <div>{r.team_name || 'Unnamed team'}</div>
                        {teammates.length > 0 && (
                          <div className="text-[10px] text-slate-500">
                            {teammates.length} teammate{teammates.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{r.players?.full_name || '—'}</div>
                        {r.players?.phone && (
                          <div className="text-[10px] text-slate-500">{r.players.phone}</div>
                        )}
                      </td>
                      <td className="font-mono text-[11px]">{r.host_uid}</td>
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
                      <td className="font-mono text-[10px] text-sky-400">
                        {r.razorpay_order_id || '—'}
                      </td>
                      <td className="font-mono text-[10px] text-emerald-400">
                        {r.payment_id || '—'}
                      </td>
                      <td className="whitespace-nowrap text-slate-400">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
