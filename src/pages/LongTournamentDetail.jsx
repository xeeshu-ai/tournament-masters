import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TOURNAMENT_TYPES } from '../constants';
import { TournamentForm } from '../components/TournamentShared';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isPowerOfTwo } from '../constants';

export function LongTournamentDetailPage() {
  const { gameId, tournamentId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState(null);
  const [registrations, setRegistrations] = React.useState([]);
  const [bracket, setBracket] = React.useState(null);
  const [matchesByRound, setMatchesByRound] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [bracketLoading, setBracketLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false });
  const [confirmRegenerate, setConfirmRegenerate] = React.useState({ open: false });
  const [regSearch, setRegSearch] = React.useState('');
  const [regStatusFilter, setRegStatusFilter] = React.useState('all');

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data: tData, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .eq('game_id', gameId)
      .eq('type', 'long')
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

  const loadBracket = React.useCallback(async () => {
    setBracketLoading(true);
    const { data: bracketRow, error: bErr } = await supabaseAdmin
      .from('long_brackets')
      .select('*')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (bErr) console.error(bErr);
    setBracket(bracketRow || null);

    if (bracketRow) {
      const { data: matches, error: mErr } = await supabaseAdmin
        .from('long_br_matches')
        .select('*')
        .eq('bracket_id', bracketRow.id)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true });
      if (mErr) console.error(mErr);
      const grouped = {};
      (matches || []).forEach((m) => {
        if (!grouped[m.round_number]) grouped[m.round_number] = [];
        grouped[m.round_number].push(m);
      });
      setMatchesByRound(grouped);
    } else {
      setMatchesByRound({});
    }
    setBracketLoading(false);
  }, [tournamentId]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { loadBracket(); }, [loadBracket]);

  const handleBack = () => navigate(`/${gameId}/long-tournaments`);

  const handleArchiveConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').update({ is_archived: true }).eq('id', tournament.id);
    if (error) { notify('Failed to archive.', 'error'); return; }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
    navigate(`/${gameId}/long-tournaments`);
  };

  const handleDeleteConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').delete().eq('id', tournament.id);
    if (error) { notify('Failed to delete.', 'error'); return; }
    notify('Tournament deleted permanently.');
    setConfirmDelete({ open: false });
    navigate(`/${gameId}/long-tournaments`);
  };

  // ── Bracket helpers ──
  const recomputeNextRounds = async (bracketId, baseMatches) => {
    const rounds = {};
    baseMatches.forEach((m) => {
      if (!rounds[m.round_number]) rounds[m.round_number] = [];
      rounds[m.round_number].push(m);
    });
    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    const allMatches = [...baseMatches];
    for (let rIndex = 0; rIndex < roundNumbers.length; rIndex++) {
      const round = roundNumbers[rIndex];
      const winners = rounds[round].filter((m) => m.winner_registration_id).map((m) => m.winner_registration_id);
      const nextRound = round + 1;
      if (winners.length >= 2) {
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (!winners[i] || !winners[i + 1]) break;
          nextMatches.push({ bracket_id: bracketId, round_number: nextRound, match_number: i / 2 + 1, team_a_registration_id: winners[i], team_b_registration_id: winners[i + 1], winner_registration_id: null });
        }
        rounds[nextRound] = nextMatches;
        roundNumbers.push(nextRound);
        allMatches.push(...nextMatches);
      }
    }
    await supabaseAdmin.from('long_br_matches').delete().eq('bracket_id', bracketId);
    if (allMatches.length) await supabaseAdmin.from('long_br_matches').insert(allMatches);
  };

  const generateFixtures = async () => {
    setSaving(true);
    const teams = registrations.filter((r) => r.status === 'confirmed');
    if (!teams.length || !isPowerOfTwo(teams.length) || teams.length < 4) {
      notify('Need a power-of-two number of confirmed teams (≥ 4) to generate fixtures.', 'error');
      setSaving(false);
      return;
    }
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const { data: bracketRow, error: bErr } = await supabaseAdmin
      .from('long_brackets')
      .upsert({ tournament_id: tournamentId, current_round: 1 }, { onConflict: 'tournament_id' })
      .select('*').maybeSingle();
    if (bErr || !bracketRow) { notify('Failed to create bracket.', 'error'); setSaving(false); return; }
    await supabaseAdmin.from('long_br_matches').delete().eq('bracket_id', bracketRow.id);
    const round1 = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      round1.push({ bracket_id: bracketRow.id, round_number: 1, match_number: i / 2 + 1, team_a_registration_id: shuffled[i].id, team_b_registration_id: shuffled[i + 1].id, winner_registration_id: null });
    }
    const { error: insertErr } = await supabaseAdmin.from('long_br_matches').insert(round1);
    if (insertErr) { notify('Failed to save fixtures.', 'error'); setSaving(false); return; }
    notify('Round 1 fixtures generated.');
    setSaving(false);
    loadBracket();
  };

  const handleWinnerChange = async (match, winnerId) => {
    if (!winnerId) return;
    setSaving(true);
    const { error } = await supabaseAdmin.from('long_br_matches').update({ winner_registration_id: winnerId }).eq('id', match.id);
    if (error) { notify('Failed to update winner.', 'error'); setSaving(false); return; }
    const { data: matches } = await supabaseAdmin.from('long_br_matches').select('*').eq('bracket_id', match.bracket_id).order('round_number', { ascending: true }).order('match_number', { ascending: true });
    await recomputeNextRounds(match.bracket_id, matches || []);
    notify('Winner saved. Later rounds updated.');
    setSaving(false);
    loadBracket();
  };

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const pending = registrations.filter((r) => r.status === 'pending');
  const totalRevenue = tournament?.entry_fee
    ? confirmed.filter((r) => r.payment_id).reduce((sum) => sum + Number(tournament.entry_fee || 0), 0)
    : 0;

  const filteredRegs = registrations.filter((r) => {
    const matchStatus = regStatusFilter === 'all' || r.status === regStatusFilter;
    const q = regSearch.toLowerCase();
    const matchSearch = !q || (r.team_name || '').toLowerCase().includes(q) || (r.host_uid || '').toLowerCase().includes(q) || (r.players?.full_name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);
  const typeLabel = tournament ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type : '';
  const showBracket = tournament && (tournament.mode === 'cs' || tournament.mode === 'lw');

  if (!tournament && !loading) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={handleBack} className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to long tournaments
        </button>
        <div className="card text-xs text-red-400">Tournament not found or is not a long tournament.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <button type="button" onClick={handleBack} className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Long tournaments
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-violet-500" />
            <h1 className="text-xl font-semibold text-slate-50">{tournament?.title || 'Loading…'}</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] mt-1 ml-3">
            {typeLabel && <span className="badge">{typeLabel}</span>}
            {tournament?.mode && <span className="badge bg-violet-900/50 text-violet-200 border border-violet-700/40">{tournament.mode.toUpperCase()}</span>}
            <span className="badge bg-slate-900 text-slate-300">Slots: {tournament?.filled_slots || 0}/{tournament?.max_slots || 0}</span>
            <span className={'status-pill ' + (tournament?.registration_status === 'open' ? 'pending' : 'approved')}>
              Reg: {tournament?.registration_status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-stretch gap-2 text-xs min-w-[200px]">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/${gameId}/results?tournamentId=${tournamentId}`)}>
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
            <input className="input py-1 text-xs w-40" placeholder="Search team / UID…" value={regSearch} onChange={(e) => setRegSearch(e.target.value)} />
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
                  <th>#</th><th>Team</th><th>Host</th><th>UID</th><th>Teammates</th><th>Status</th><th>Order ID</th><th>Payment ID</th><th>Registered</th>
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
                        <span className={'status-pill ' + (r.status === 'confirmed' ? 'approved' : r.status === 'pending' ? 'pending' : '')}>{r.status}</span>
                      </td>
                      <td className="font-mono text-[10px] text-sky-400">{r.razorpay_order_id || '—'}</td>
                      <td className="font-mono text-[10px] text-emerald-400">{r.payment_id || '—'}</td>
                      <td className="whitespace-nowrap text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Bracket Manager (CS / LW only) ── */}
      {showBracket && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Bracket manager</h2>
              <p className="text-[11px] text-slate-400">Generate fixtures from confirmed teams and set round winners.</p>
            </div>
            <button
              type="button"
              className="text-xs rounded-lg px-3 py-1.5 bg-violet-900/40 text-violet-300 border border-violet-700/50 hover:bg-violet-800/40 transition-colors"
              onClick={() => {
                if (bracket) setConfirmRegenerate({ open: true });
                else generateFixtures();
              }}
              disabled={saving || bracketLoading}
            >
              {saving ? 'Working…' : bracket ? 'Regenerate fixtures' : 'Generate fixtures'}
            </button>
          </div>

          {bracketLoading && <p className="text-xs text-slate-400">Loading bracket…</p>}

          {!bracketLoading && !roundNumbers.length && (
            <div className="card py-8 text-center">
              <p className="text-xs text-slate-500">No fixtures yet. Confirm teams then generate fixtures to begin.</p>
              <p className="text-[11px] text-slate-600 mt-1">Needs a power-of-two count of confirmed teams (4, 8, 16…).</p>
            </div>
          )}

          {!bracketLoading && roundNumbers.map((round) => (
            <div key={round} className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Round {round}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {matchesByRound[round].map((m) => {
                  const teamA = registrations.find((r) => r.id === m.team_a_registration_id);
                  const teamB = registrations.find((r) => r.id === m.team_b_registration_id);
                  return (
                    <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2 text-xs">
                      <p className="text-[10px] text-slate-500">Match {m.match_number}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${m.winner_registration_id === m.team_a_registration_id ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {teamA?.team_name || m.team_a_registration_id}
                        </span>
                        <span className="text-slate-600 text-[10px]">vs</span>
                        <span className={`font-medium text-right ${m.winner_registration_id === m.team_b_registration_id ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {teamB?.team_name || m.team_b_registration_id}
                        </span>
                      </div>
                      <div>
                        <label className="label" htmlFor={`winner-${m.id}`}>Winner</label>
                        <select
                          id={`winner-${m.id}`}
                          className="input text-xs"
                          value={m.winner_registration_id || ''}
                          onChange={(e) => handleWinnerChange(m, e.target.value)}
                          disabled={saving}
                        >
                          <option value="">Select winner…</option>
                          {teamA && <option value={m.team_a_registration_id}>{teamA.team_name}</option>}
                          {teamB && <option value={m.team_b_registration_id}>{teamB.team_name}</option>}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Edit form */}
      {tournament && (
        <TournamentForm open={formOpen} initial={tournament} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} gameId={gameId} />
      )}

      <ConfirmDialog open={confirmArchive.open} title="Archive tournament?" description="Archived tournaments are hidden from lists but kept in the database." confirmLabel="Archive" onCancel={() => setConfirmArchive({ open: false })} onConfirm={handleArchiveConfirmed} />
      <ConfirmDialog open={confirmDelete.open} title={`Delete "${confirmDelete.title}"?`} description="This will permanently delete the tournament and all registrations. Cannot be undone." confirmLabel="Delete permanently" onCancel={() => setConfirmDelete({ open: false })} onConfirm={handleDeleteConfirmed} />
      <ConfirmDialog open={confirmRegenerate.open} title="Regenerate fixtures?" description="This will delete all existing bracket matches and create fresh Round 1 fixtures from current confirmed teams. This cannot be undone." confirmLabel="Regenerate" onCancel={() => setConfirmRegenerate({ open: false })} onConfirm={() => { setConfirmRegenerate({ open: false }); generateFixtures(); }} />
    </div>
  );
}
