import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TOURNAMENT_TYPES } from '../constants';
import { TournamentForm } from '../components/TournamentShared';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function SingleTournamentDetailPage() {
  const { gameId, tournamentId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState(null);
  const [registrations, setRegistrations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false });
  const [regSearch, setRegSearch] = React.useState('');
  const [regStatusFilter, setRegStatusFilter] = React.useState('all');

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
      .eq('type', 'single')
      .maybeSingle();
    if (tErr) { console.error(tErr); notify('Failed to load tournament.', 'error'); setLoading(false); return; }
    setTournament(tData || null);

    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`id, tournament_id, host_uid, team_name, status, created_at, razorpay_order_id, payment_id, teammate_uid_1, teammate_uid_2, teammate_uid_3, players!host_player_id ( full_name, ff_uid, phone )`)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
    if (rErr) console.error(rErr);
    setRegistrations(rData || []);
    setLoading(false);
  }, [gameId, tournamentId]);

  React.useEffect(() => { load(); }, [load]);

  const handleBack = () => navigate(`/${gameId}/single-tournaments`);

  const handleArchiveConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').update({ is_archived: true }).eq('id', tournament.id);
    if (error) { notify('Failed to archive.', 'error'); return; }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
    navigate(`/${gameId}/single-tournaments`);
  };

  const handleDeleteConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').delete().eq('id', tournament.id);
    if (error) { notify('Failed to delete.', 'error'); return; }
    notify('Tournament deleted permanently.');
    setConfirmDelete({ open: false });
    navigate(`/${gameId}/single-tournaments`);
  };

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const pending = registrations.filter((r) => r.status === 'pending');
  const totalRevenue = tournament?.entry_fee
    ? confirmed.filter((r) => r.payment_id).reduce((sum) => sum + Number(tournament.entry_fee || 0), 0)
    : 0;

  const filteredRegs = registrations.filter((r) => {
    const matchStatus = regStatusFilter === 'all' || r.status === regStatusFilter;
    const q = regSearch.toLowerCase();
    const matchSearch = !q ||
      (r.team_name || '').toLowerCase().includes(q) ||
      (r.host_uid || '').toLowerCase().includes(q) ||
      (r.players?.full_name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const typeLabel = tournament ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type : '';

  if (!tournament && !loading) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to single-match tournaments
        </button>
        <div className="card text-xs text-red-400">Tournament not found or is not a single-match tournament.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Single-match tournaments
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-sky-500" />
            <h1 className="text-xl font-semibold text-slate-50">{tournament?.title || 'Loading…'}</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] mt-1 ml-3">
            {typeLabel && <span className="badge">{typeLabel}</span>}
            {tournament?.mode && <span className="badge bg-slate-800 text-slate-200">{tournament.mode.toUpperCase()}</span>}
            <span className="badge bg-slate-900 text-slate-300">Slots: {tournament?.filled_slots || 0}/{tournament?.max_slots || 0}</span>
            <span className={'status-pill ' + (tournament?.registration_status === 'open' ? 'pending' : 'approved')}>
              Reg: {tournament?.registration_status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-stretch gap-2 text-xs min-w-[200px]">
          <button type="button" className="btn-primary" onClick={() => navigate(`/${gameId}/results?tournamentId=${tournamentId}`)}>
            Enter results
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/${gameId}/rooms?tournamentId=${tournamentId}`)}>
            Room codes
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setFormOpen(true)} disabled={loading || !tournament}>
              Edit
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmArchive({ open: true })} disabled={!tournament}>
              Archive
            </button>
          </div>
          <button type="button" className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors" onClick={() => setConfirmDelete({ open: true, title: tournament?.title })} disabled={!tournament}>
            Delete permanently
          </button>
        </div>
      </header>

      {/* ── Stats row ── */}
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total teams', value: registrations.length, color: 'text-slate-50' },
          { label: 'Confirmed', value: confirmed.length, color: 'text-emerald-400' },
          { label: 'Pending', value: pending.length, color: 'text-amber-400' },
          { label: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* ── Overview & Prize ── */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Overview</h2>
          <div className="space-y-1.5 text-slate-300">
            <p><span className="text-slate-500 w-28 inline-block">Format:</span>{tournament?.format_label || '—'}</p>
            {tournament?.mode === 'br' && <p><span className="text-slate-500 w-28 inline-block">Map:</span>{tournament.map || '—'}</p>}
            <p><span className="text-slate-500 w-28 inline-block">Entry fee:</span>{tournament?.entry_fee ? `₹${Number(tournament.entry_fee).toLocaleString()}` : 'Free'}</p>
            <p><span className="text-slate-500 w-28 inline-block">Reg closes:</span>{tournament?.entry_closing_time ? new Date(tournament.entry_closing_time).toLocaleString('en-IN') : '—'}</p>
            <p><span className="text-slate-500 w-28 inline-block">Match start:</span>{tournament?.start_time ? new Date(tournament.start_time).toLocaleString('en-IN') : '—'}</p>
          </div>
        </div>
        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Prize & points</h2>
          <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{tournament?.prize_text || 'No prize text set.'}</p>
          {tournament?.points_table && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.14em] mt-2">Points table</p>
              <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{tournament.points_table}</p>
            </>
          )}
        </div>
      </section>

      {/* ── Registered teams ── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Registered teams</h2>
          <div className="flex gap-2 text-xs">
            <input
              className="input py-1 text-xs w-40"
              placeholder="Search team / UID…"
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
            />
            <select className="input py-1 text-xs" value={regStatusFilter} onChange={(e) => setRegStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <div className="card overflow-x-auto text-xs">
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : filteredRegs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No registrations match.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Host</th>
                  <th>UID</th>
                  <th>Teammates</th>
                  <th>Status</th>
                  <th>Order ID</th>
                  <th>Payment ID</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegs.map((r, idx) => {
                  const teammates = [r.teammate_uid_1, r.teammate_uid_2, r.teammate_uid_3].filter(Boolean);
                  return (
                    <tr key={r.id}>
                      <td className="text-slate-500">{idx + 1}</td>
                      <td>{r.team_name || 'Unnamed'}</td>
                      <td>
                        <div>{r.players?.full_name || '—'}</div>
                        {r.players?.phone && <div className="text-[10px] text-slate-500">{r.players.phone}</div>}
                      </td>
                      <td className="font-mono text-[11px]">{r.host_uid}</td>
                      <td className="text-[10px] text-slate-400">{teammates.join(', ') || '—'}</td>
                      <td>
                        <span className={'status-pill ' + (r.status === 'confirmed' ? 'approved' : r.status === 'pending' ? 'pending' : '')}>
                          {r.status}
                        </span>
                      </td>
                      <td className="font-mono text-[10px] text-sky-400">{r.razorpay_order_id || '—'}</td>
                      <td className="font-mono text-[10px] text-emerald-400">{r.payment_id || '—'}</td>
                      <td className="whitespace-nowrap text-slate-400">
                        {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Edit form */}
      {tournament && (
        <TournamentForm
          open={formOpen}
          initial={tournament}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
          gameId={gameId}
        />
      )}

      <ConfirmDialog open={confirmArchive.open} title="Archive tournament?" description="Archived tournaments are hidden from lists but kept in the database." confirmLabel="Archive" onCancel={() => setConfirmArchive({ open: false })} onConfirm={handleArchiveConfirmed} />
      <ConfirmDialog open={confirmDelete.open} title={`Delete "${confirmDelete.title}"?`} description="This will permanently delete the tournament and all registrations. Cannot be undone." confirmLabel="Delete permanently" onCancel={() => setConfirmDelete({ open: false })} onConfirm={handleDeleteConfirmed} />
    </div>
  );
}
