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
  const [rowBusy, setRowBusy] = React.useState({});

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = React.useCallback(async () => {
    setLoading(true);

    // Load tournament
    const { data: tData, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .eq('game_id', gameId)
      .eq('type', 'single')
      .maybeSingle();
    if (tErr) {
      console.error('Tournament fetch error:', tErr);
      notify('Failed to load tournament.', 'error');
      setLoading(false);
      return;
    }
    setTournament(tData || null);

    // Load registrations — join registration_members for teammate details
    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        tournament_id,
        host_uid,
        host_player_id,
        team_name,
        team_members_summary,
        status,
        created_at,
        razorpay_order_id,
        payment_id,
        registration_members (
          id,
          slot,
          game_uid,
          in_game_name,
          player_id,
          players ( full_name, phone )
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('Registrations fetch error:', rErr);
      notify('Failed to load registrations.', 'error');
    }

    // Also fetch host player info separately since foreign key hint may not exist
    const regs = rData || [];
    if (regs.length > 0) {
      const hostIds = [...new Set(regs.map((r) => r.host_player_id).filter(Boolean))];
      const { data: hostPlayers } = await supabaseAdmin
        .from('players')
        .select('id, full_name, phone, ff_uid')
        .in('id', hostIds);
      const hostMap = Object.fromEntries((hostPlayers || []).map((p) => [p.id, p]));
      regs.forEach((r) => { r._host = hostMap[r.host_player_id] || null; });
    }

    setRegistrations(regs);
    setLoading(false);
  }, [gameId, tournamentId]);

  React.useEffect(() => { load(); }, [load]);

  const handleBack = () => navigate(`/${gameId}/single-tournaments`);

  const handleConfirm = async (reg) => {
    setRowBusy((b) => ({ ...b, [reg.id]: 'confirming' }));
    const { error } = await supabaseAdmin
      .from('tournament_registrations')
      .update({ status: 'confirmed' })
      .eq('id', reg.id);
    if (error) {
      notify('Failed to confirm registration.', 'error');
      setRowBusy((b) => ({ ...b, [reg.id]: null }));
      return;
    }
    if (tournament?.id) {
      await supabaseAdmin.rpc('increment_filled_slots', { tournament_id: tournament.id });
    }
    notify(`${reg.team_name || 'Team'} confirmed.`);
    setRowBusy((b) => ({ ...b, [reg.id]: null }));
    load();
  };

  const handleReject = async (reg) => {
    setRowBusy((b) => ({ ...b, [reg.id]: 'rejecting' }));
    const wasConfirmed = reg.status === 'confirmed';
    const { error } = await supabaseAdmin
      .from('tournament_registrations')
      .update({ status: 'pending' })
      .eq('id', reg.id);
    if (error) {
      notify('Failed to reject registration.', 'error');
      setRowBusy((b) => ({ ...b, [reg.id]: null }));
      return;
    }
    if (wasConfirmed && tournament?.id) {
      await supabaseAdmin.rpc('decrement_filled_slots', { tournament_id: tournament.id });
    }
    notify(`${reg.team_name || 'Team'} moved back to pending.`);
    setRowBusy((b) => ({ ...b, [reg.id]: null }));
    load();
  };

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
  const pending   = registrations.filter((r) => r.status === 'pending');
  const totalRevenue = tournament?.entry_fee
    ? confirmed.filter((r) => r.payment_id).reduce((sum) => sum + Number(tournament.entry_fee || 0), 0)
    : 0;

  const filteredRegs = registrations.filter((r) => {
    const matchStatus = regStatusFilter === 'all' || r.status === regStatusFilter;
    const q = regSearch.toLowerCase();
    const matchSearch =
      !q ||
      (r.team_name || '').toLowerCase().includes(q) ||
      (r.host_uid  || '').toLowerCase().includes(q) ||
      (r._host?.full_name || '').toLowerCase().includes(q) ||
      (r.registration_members || []).some(
        (m) => (m.in_game_name || '').toLowerCase().includes(q) || (m.game_uid || '').toLowerCase().includes(q)
      );
    return matchStatus && matchSearch;
  });

  const typeLabel = tournament
    ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type
    : '';

  const isTDM = tournament?.mode === 'tdm';
  const isBR  = tournament?.mode === 'br';

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

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Single-match tournaments
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-sky-500" />
            <h1 className="text-xl font-semibold text-slate-50">{tournament?.title || 'Loading\u2026'}</h1>
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
          <button type="button" className="btn-primary" onClick={() => navigate(`/${gameId}/results?tournamentId=${tournamentId}`)}>Enter results</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/${gameId}/rooms?tournamentId=${tournamentId}`)}>Room codes</button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setFormOpen(true)} disabled={loading || !tournament}>Edit</button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmArchive({ open: true })} disabled={!tournament}>Archive</button>
          </div>
          <button
            type="button"
            className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
            onClick={() => setConfirmDelete({ open: true, title: tournament?.title })}
            disabled={!tournament}
          >
            Delete permanently
          </button>
        </div>
      </header>

      {/* Stats row */}
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total teams',  value: registrations.length,                             color: 'text-slate-50' },
          { label: 'Confirmed',    value: confirmed.length,                                 color: 'text-emerald-400' },
          { label: 'Pending',      value: pending.length,                                   color: 'text-amber-400' },
          { label: 'Revenue',      value: `\u20B9${totalRevenue.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* Overview & Prize */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="card space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Overview</h2>
          <div className="space-y-1.5 text-slate-300">
            <p><span className="text-slate-500 w-28 inline-block">Format:</span>{tournament?.format_label || '\u2014'}</p>
            {(isBR || isTDM) && <p><span className="text-slate-500 w-28 inline-block">Map:</span>{tournament.map || '\u2014'}</p>}
            {isTDM && <p><span className="text-slate-500 w-28 inline-block">Total rounds:</span>{tournament?.total_rounds || '\u2014'}</p>}
            <p><span className="text-slate-500 w-28 inline-block">Entry fee:</span>{tournament?.entry_fee ? `\u20B9${Number(tournament.entry_fee).toLocaleString()}` : 'Free'}</p>
            <p><span className="text-slate-500 w-28 inline-block">Reg closes:</span>{tournament?.entry_closing_time ? new Date(tournament.entry_closing_time).toLocaleString('en-IN') : '\u2014'}</p>
            <p><span className="text-slate-500 w-28 inline-block">Match start:</span>{tournament?.start_time ? new Date(tournament.start_time).toLocaleString('en-IN') : '\u2014'}</p>
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

      {/* Registered teams */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Registered teams
            <span className="ml-2 text-[11px] font-normal text-slate-500">{registrations.length} total</span>
          </h2>
          <div className="flex gap-2 text-xs">
            <input
              className="input py-1 text-xs w-44"
              placeholder="Search team / UID / name\u2026"
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
            <p className="text-xs text-slate-400 py-6 text-center">Loading\u2026</p>
          ) : filteredRegs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No registrations match.</p>
          ) : isTDM ? (
            /* ── TDM: show 2 teams side by side ── */
            <div className="space-y-4">
              {filteredRegs.map((r, idx) => {
                const members = (r.registration_members || []).sort((a, b) => (a.slot || 0) - (b.slot || 0));
                const busy = rowBusy[r.id];
                return (
                  <div key={r.id} className="rounded-lg border border-slate-700 overflow-hidden">
                    {/* Team header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">#{idx + 1}</span>
                        <span className="font-semibold text-slate-100">{r.team_name || 'Unnamed team'}</span>
                        {r.payment_id && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">Paid</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={'status-pill ' + (r.status === 'confirmed' ? 'approved' : 'pending')}>
                          {r.status}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {r.status !== 'confirmed' && (
                          <button disabled={!!busy} onClick={() => handleConfirm(r)}
                            className="rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-700/40 disabled:opacity-40">
                            {busy === 'confirming' ? '\u2026' : 'Confirm'}
                          </button>
                        )}
                        {r.status !== 'pending' && (
                          <button disabled={!!busy} onClick={() => handleReject(r)}
                            className="rounded px-2 py-0.5 text-[11px] font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-700/40 disabled:opacity-40">
                            {busy === 'rejecting' ? '\u2026' : 'Reject'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Members grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-700/50">
                      {members.length > 0 ? members.map((m) => (
                        <div key={m.id} className="px-3 py-2 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Slot {m.slot}</span>
                          </div>
                          <div className="font-medium text-slate-100">{m.in_game_name || '\u2014'}</div>
                          <div className="font-mono text-[10px] text-slate-400">{m.game_uid || '\u2014'}</div>
                          {m.players?.full_name && (
                            <div className="text-[10px] text-slate-500">{m.players.full_name}</div>
                          )}
                        </div>
                      )) : (
                        <div className="col-span-4 px-3 py-2 text-slate-500 text-[11px]">
                          No member details recorded.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── BR / default: flat table ── */
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Host</th>
                  <th>Members ({tournament?.team_size || 1})</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegs.map((r, idx) => {
                  const members = (r.registration_members || []).sort((a, b) => (a.slot || 0) - (b.slot || 0));
                  const busy = rowBusy[r.id];
                  return (
                    <tr key={r.id}>
                      <td className="text-slate-500">{idx + 1}</td>
                      <td className="font-medium">{r.team_name || 'Unnamed'}</td>
                      <td>
                        <div>{r._host?.full_name || '\u2014'}</div>
                        {r._host?.phone && <div className="text-[10px] text-slate-500">{r._host.phone}</div>}
                        <div className="font-mono text-[10px] text-slate-400">{r.host_uid}</div>
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          {members.length > 0 ? members.map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 w-10">Slot {m.slot}</span>
                              <span className="text-slate-200">{m.in_game_name}</span>
                              <span className="font-mono text-[10px] text-slate-400">{m.game_uid}</span>
                            </div>
                          )) : (
                            <span className="text-slate-500">\u2014</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={'status-pill ' + (r.status === 'confirmed' ? 'approved' : r.status === 'pending' ? 'pending' : '')}>
                          {r.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-slate-400">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : '\u2014'}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status !== 'confirmed' && (
                            <button
                              disabled={!!busy}
                              onClick={() => handleConfirm(r)}
                              className="rounded px-2 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-700/40 transition-colors disabled:opacity-40"
                            >
                              {busy === 'confirming' ? '\u2026' : 'Confirm'}
                            </button>
                          )}
                          {r.status !== 'pending' && (
                            <button
                              disabled={!!busy}
                              onClick={() => handleReject(r)}
                              className="rounded px-2 py-1 text-[11px] font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-700/40 transition-colors disabled:opacity-40"
                            >
                              {busy === 'rejecting' ? '\u2026' : 'Reject'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {tournament && (
        <TournamentForm
          open={formOpen}
          initial={tournament}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
          gameId={gameId}
        />
      )}

      <ConfirmDialog
        open={confirmArchive.open}
        title="Archive tournament?"
        description="Archived tournaments are hidden from lists but kept in the database."
        confirmLabel="Archive"
        onCancel={() => setConfirmArchive({ open: false })}
        onConfirm={handleArchiveConfirmed}
      />
      <ConfirmDialog
        open={confirmDelete.open}
        title={`Delete "${confirmDelete.title}"?`}
        description="This will permanently delete the tournament and all registrations. Cannot be undone."
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete({ open: false })}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
