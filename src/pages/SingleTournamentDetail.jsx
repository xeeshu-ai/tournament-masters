import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TOURNAMENT_TYPES, calculateBrPoints } from '../constants';
import { TournamentForm } from '../components/TournamentShared';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

// In-memory draft state hook for results (not persisted to Supabase until published)
function useResultsDraft(initialRows) {
  const [rows, setRows] = React.useState(initialRows || []);
  const [lastSavedAt, setLastSavedAt] = React.useState(null);

  // Auto-save to memory every 30s (effectively just stamping lastSavedAt)
  React.useEffect(() => {
    if (!rows.length) return;
    const id = setInterval(() => {
      setLastSavedAt(new Date());
    }, 30000);
    return () => clearInterval(id);
  }, [rows]);

  const updateRow = (index, field, value, gameId) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === 'kills' || field === 'position') {
        const kills = Number(row.kills || 0);
        const position = Number(row.position || 0);
        row.points = calculateBrPoints(kills, position, gameId);
      }
      next[index] = row;
      return next;
    });
  };

  return { rows, setRows, updateRow, lastSavedAt };
}

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
  const [rowBusy, setRowBusy] = React.useState({});
  const [activeTab, setActiveTab] = React.useState('registrations');
  const [hasUnsavedResults, setHasUnsavedResults] = React.useState(false);

  const [brDraft, setBrDraft] = React.useState({ rows: [], lastSavedAt: null });

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

    // Load registrations (non-rejected)
    const { data: rData, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId)
      .neq('status', 'rejected')
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('Registrations fetch error:', rErr);
      notify('Failed to load registrations.', 'error');
    }

    const regs = rData || [];
    setRegistrations(regs);

    // Initialize BR draft rows for BGMI BR tournaments
    if (tData?.mode === 'br') {
      const initialRows = regs.map((r) => ({
        registration_id: r.id,
        team_name: r.team_name,
        host_player_id: r.host_player_id,
        kills: '',
        position: '',
        points: 0,
      }));
      setBrDraft({ rows: initialRows, lastSavedAt: null });
    } else {
      setBrDraft({ rows: [], lastSavedAt: null });
    }

    setLoading(false);
  }, [gameId, tournamentId]);

  React.useEffect(() => { load(); }, [load]);

  // Warn on browser/tab close if there are unsaved results
  React.useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedResults) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedResults]);

  const handleBack = () => {
    if (hasUnsavedResults) {
      const leave = window.confirm('You have unsaved results. Leave anyway?');
      if (!leave) return;
    }
    navigate(`/${gameId}/single-tournaments`);
  };

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

  const typeLabel = tournament
    ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type
    : '';

  const isTDM = tournament?.mode === 'tdm';
  const isBR  = tournament?.mode === 'br';

  const handleChangeBrRow = (index, field, value) => {
    setBrDraft((prev) => {
      const nextRows = [...prev.rows];
      const row = { ...nextRows[index], [field]: value };
      row.points = calculateBrPoints(Number(row.kills || 0), Number(row.position || 0), gameId);
      nextRows[index] = row;
      return { ...prev, rows: nextRows };
    });
    setHasUnsavedResults(true);
  };

  const handlePublishBrResults = async () => {
    if (!tournament || !isBR) return;
    const sorted = [...brDraft.rows].map((r) => ({
      team_name: r.team_name,
      kills: Number(r.kills || 0),
      position: Number(r.position || 0),
      points: r.points,
    })).sort((a, b) => b.points - a.points);

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ single_br_results: sorted })
      .eq('id', tournament.id);

    if (error) {
      notify(`Failed to save results: ${error.message}`, 'error');
      return;
    }
    notify('Results posted to players.');
    setHasUnsavedResults(false);
  };

  const handleEndTournament = async () => {
    if (!tournament) return;
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'ended', registration_status: 'closed' })
      .eq('id', tournament.id);
    if (error) {
      notify(`Failed to end tournament: ${error.message}`, 'error');
      return;
    }
    notify('Tournament ended. Players will now see results.');
    load();
  };

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

      {/* Breadcrumb + title */}
      <header className="space-y-2">
        <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          {gameId.toUpperCase()} / Single tournaments
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
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
          <div className="flex flex-col items-stretch gap-2 text-xs min-w-[200px]">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(true)} disabled={loading || !tournament}>Edit</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmArchive({ open: true })} disabled={!tournament}>Archive</button>
            <button
              type="button"
              className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
              onClick={() => setConfirmDelete({ open: true, title: tournament?.title })}
              disabled={!tournament}
            >
              Delete permanently
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 text-xs">
        {['registrations', 'room', 'results', 'end'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 -mb-px border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'registrations' && 'Registrations'}
            {tab === 'room' && 'Room'}
            {tab === 'results' && 'Results'}
            {tab === 'end' && 'End'}
          </button>
        ))}
      </div>

      {/* Registrations tab */}
      {activeTab === 'registrations' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <h2 className="text-sm font-semibold text-slate-100">
              Registered teams
              <span className="ml-2 text-[11px] font-normal text-slate-500">{registrations.length} total</span>
            </h2>
          </div>
          <div className="card overflow-x-auto text-xs">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>
            ) : registrations.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No registrations yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Host UID</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, idx) => {
                    const busy = rowBusy[r.id];
                    return (
                      <tr key={r.id}>
                        <td className="text-slate-500">{idx + 1}</td>
                        <td className="font-medium">{r.team_name || 'Unnamed'}</td>
                        <td className="font-mono text-[10px] text-slate-400">{r.host_uid}</td>
                        <td>
                          <span className={'status-pill ' + (r.status === 'confirmed' ? 'approved' : 'pending')}>
                            {r.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-slate-400">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td>
                          <div className="flex gap-1.5">
                            {r.status !== 'confirmed' && (
                              <button
                                disabled={!!busy}
                                onClick={() => handleConfirm(r)}
                                className="rounded px-2 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-700/40 transition-colors disabled:opacity-40"
                              >
                                {busy === 'confirming' ? '…' : 'Confirm'}
                              </button>
                            )}
                            {r.status !== 'pending' && (
                              <button
                                disabled={!!busy}
                                onClick={() => handleReject(r)}
                                className="rounded px-2 py-1 text-[11px] font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-700/40 transition-colors disabled:opacity-40"
                              >
                                {busy === 'rejecting' ? '…' : 'Reject'}
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
      )}

      {/* Room tab */}
      {activeTab === 'room' && (
        <section className="space-y-3">
          <div className="card space-y-2 text-xs">
            <h2 className="text-sm font-semibold text-slate-100">Room details</h2>
            <p className="text-[11px] text-slate-400">
              Room ID and password are visible only to host players of confirmed/paid teams in the public app.
            </p>
            {/* NOTE: room fields should already exist on tournaments table; reuse them here */}
            {/* For now, keep this as a placeholder wired to future fields to avoid schema changes */}
            <p className="text-[11px] text-slate-500">Room configuration is still handled by the legacy view. This tab is reserved for the new flow.</p>
          </div>
        </section>
      )}

      {/* Results tab */}
      {activeTab === 'results' && (
        <section className="space-y-3">
          {isBR ? (
            <>
              <h2 className="text-sm font-semibold text-slate-100">Battle Royale · Result Draft</h2>
              <div className="card overflow-x-auto text-xs">
                {brDraft.rows.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No teams to score yet. Confirm registrations first.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Kills</th>
                        <th>Position</th>
                        <th>Points (auto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brDraft.rows.map((row, idx) => (
                        <tr key={row.registration_id}>
                          <td className="font-semibold">{row.team_name}</td>
                          <td>
                            <input
                              type="number"
                              className="input w-20 text-xs"
                              value={row.kills}
                              onChange={(e) => handleChangeBrRow(idx, 'kills', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input w-20 text-xs"
                              value={row.position}
                              onChange={(e) => handleChangeBrRow(idx, 'position', e.target.value)}
                            />
                          </td>
                          <td className="font-semibold text-sky-300">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {hasUnsavedResults
                    ? 'Draft has unsaved changes. Publishing writes to Supabase.'
                    : 'Draft is in sync. You can safely leave this tab.'}
                </span>
                <button type="button" className="btn-primary text-xs" onClick={handlePublishBrResults} disabled={!brDraft.rows.length}>
                  Post Results
                </button>
              </div>
            </>
          ) : (
            <div className="card text-xs text-slate-400">
              Results entry for this mode is handled via the long tournaments/results flow.
            </div>
          )}
        </section>
      )}

      {/* End tab */}
      {activeTab === 'end' && (
        <section className="space-y-3">
          <div className="card space-y-3 border border-red-900/40 bg-red-500/5">
            <p className="text-sm font-semibold text-red-400">End Tournament</p>
            <p className="text-[11px] text-slate-400">
              Once ended, players will see this tournament as completed in the public app and view final results.
            </p>
            <button
              type="button"
              className="rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 transition-colors flex-shrink-0"
              onClick={handleEndTournament}
            >
              End Tournament
            </button>
          </div>
        </section>
      )}

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
