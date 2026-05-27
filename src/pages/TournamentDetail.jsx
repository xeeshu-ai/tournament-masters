import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TOURNAMENT_TYPES, calculateBrPoints, isPowerOfTwo } from '../constants';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ─── Inline BR Results ──────────────────────────────────────────────────────
function BrResultsPanel({ tournament, registrations, onSaved }) {
  // All non-rejected registrations are treated as joined (payment = confirmed)
  const joinedTeams = registrations.filter((r) => r.status !== 'rejected');
  const teamCount = joinedTeams.length;
  const [rows, setRows] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState(null);
  const notify = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3000); };

  React.useEffect(() => {
    const existing = tournament.cs_lw_results?.br_rows || [];
    setRows(
      joinedTeams.map((t, i) => ({
        registrationId: t.id,
        teamName: t.team_name || 'Unnamed',
        position: existing[i]?.position ?? '',
        kills: existing[i]?.kills ?? '',
        points: existing[i]?.points ?? '',
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id]);

  const update = (idx, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      const p = Number(field === 'position' ? val : next[idx].position);
      const k = Number(field === 'kills' ? val : next[idx].kills);
      const pts = calculateBrPoints ? calculateBrPoints(p, k) : 0;
      next[idx].points = pts;
      return next;
    });
  };

  const sorted = [...rows].sort((a, b) => Number(b.points) - Number(a.points));

  const save = async () => {
    setSaving(true);
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ cs_lw_results: { br_rows: rows } })
      .eq('id', tournament.id);
    setSaving(false);
    if (error) { notify('Failed to save: ' + error.message, 'error'); return; }
    notify('BR results saved!');
    if (onSaved) onSaved();
  };

  if (teamCount === 0) return <div className="text-xs text-slate-400">No teams registered yet.</div>;

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${toastMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {toastMsg.msg}
        </div>
      )}
      <div className="text-[11px] text-slate-400">Enter position and kills for each team. Points are auto-calculated.</div>
      <div className="card overflow-x-auto">
        <table className="table text-xs">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Position</th>
              <th>Kills</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.registrationId}>
                <td className="text-slate-500">{i + 1}</td>
                <td>{row.teamName}</td>
                <td>
                  <input
                    type="number"
                    className="input w-20 text-xs"
                    min={1}
                    value={row.position}
                    onChange={(e) => update(i, 'position', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input w-20 text-xs"
                    min={0}
                    value={row.kills}
                    onChange={(e) => update(i, 'kills', e.target.value)}
                  />
                </td>
                <td className="font-bold text-sky-300 tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.position !== '') && (
        <div className="card space-y-2">
          <h3 className="text-xs font-semibold text-slate-200">Leaderboard preview</h3>
          <table className="table text-xs">
            <thead><tr><th>Rank</th><th>Team</th><th>Pos</th><th>Kills</th><th>Points</th></tr></thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.registrationId}>
                  <td className="font-bold text-amber-400">{i + 1}</td>
                  <td>{row.teamName}</td>
                  <td>{row.position || '—'}</td>
                  <td>{row.kills || '—'}</td>
                  <td className="font-bold text-sky-300 tabular-nums">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-primary text-xs" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save results'}
        </button>
      </div>
    </div>
  );
}

// ─── Inline CS/LW Results ───────────────────────────────────────────────────
function CsLwResultsPanel({ tournament, registrations, onSaved }) {
  const joinedTeams = registrations.filter((r) => r.status !== 'rejected');
  const totalRounds = Number(tournament.total_rounds) || 13;
  const objectiveRounds = Math.ceil(totalRounds / 2) + 1;

  const pairs = React.useMemo(() => {
    const p = [];
    for (let i = 0; i + 1 < joinedTeams.length; i += 2) p.push({ a: joinedTeams[i], b: joinedTeams[i + 1] });
    return p;
  }, [joinedTeams.length]);

  const [matchData, setMatchData] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState(null);
  const notify = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3000); };

  React.useEffect(() => {
    setMatchData(pairs.map(() => ({ roundsA: '', roundsB: '', winner: '' })));
  }, [pairs.length]);

  const setRounds = (i, side, val) => setMatchData((prev) => { const n = [...prev]; n[i] = { ...n[i], [side === 'a' ? 'roundsA' : 'roundsB']: val }; return n; });
  const setWinner = (i, val) => setMatchData((prev) => { const n = [...prev]; n[i] = { ...n[i], winner: val }; return n; });

  const save = async () => {
    setSaving(true);
    const matches = pairs.map((pair, i) => {
      const md = matchData[i];
      return {
        teamA: { name: pair.a.team_name, rounds_won: Number(md?.roundsA || 0) },
        teamB: { name: pair.b.team_name, rounds_won: Number(md?.roundsB || 0) },
        winner_team: md?.winner === 'a' ? pair.a.team_name : md?.winner === 'b' ? pair.b.team_name : null,
      };
    });
    const winnerTeam = matches.find((m) => m.winner_team)?.winner_team || null;
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ cs_lw_results: { total_rounds: totalRounds, objective_rounds: objectiveRounds, matches }, winner_text: winnerTeam ? `Winner: ${winnerTeam}` : '' })
      .eq('id', tournament.id);
    setSaving(false);
    if (error) { notify('Failed to save: ' + error.message, 'error'); return; }
    notify('Results saved!');
    if (onSaved) onSaved();
  };

  if (joinedTeams.length === 0) return <div className="text-xs text-slate-400">No teams registered yet.</div>;
  if (joinedTeams.length < 2) return <div className="text-xs text-amber-400">⚠️ Need at least 2 teams.</div>;
  if (matchData.length !== pairs.length) return <div className="text-xs text-slate-400">Loading…</div>;

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${toastMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {toastMsg.msg}
        </div>
      )}
      <div className="rounded-lg bg-sky-500/10 border border-sky-700 px-4 py-2 text-xs text-sky-300 flex gap-6">
        <span>Total rounds: <strong className="text-slate-100">{totalRounds}</strong></span>
        <span>Objective: <strong className="text-amber-300">{objectiveRounds}</strong></span>
      </div>
      {pairs.map((pair, pairIdx) => {
        const md = matchData[pairIdx];
        if (!md) return null;
        return (
          <div key={pairIdx} className="card space-y-3">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Match {pairIdx + 1}</div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-200">{pair.a.team_name}</p>
                <div>
                  <label className="label">Rounds won</label>
                  <input type="number" className="input w-24 text-xs" value={md.roundsA} onChange={(e) => setRounds(pairIdx, 'a', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 pt-6">
                <span className="text-slate-500 font-bold text-xs">VS</span>
                <div className="space-y-1 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Winner</p>
                  <button onClick={() => setWinner(pairIdx, md.winner === 'a' ? '' : 'a')} className={`block w-full rounded px-2 py-1 text-[11px] font-semibold transition-colors ${md.winner === 'a' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    {pair.a.team_name.substring(0, 10)}
                  </button>
                  <button onClick={() => setWinner(pairIdx, md.winner === 'b' ? '' : 'b')} className={`block w-full rounded px-2 py-1 text-[11px] font-semibold transition-colors ${md.winner === 'b' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    {pair.b.team_name.substring(0, 10)}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-200">{pair.b.team_name}</p>
                <div>
                  <label className="label">Rounds won</label>
                  <input type="number" className="input w-24 text-xs" value={md.roundsB} onChange={(e) => setRounds(pairIdx, 'b', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-end">
        <button className="btn-primary text-xs" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save results'}</button>
      </div>
    </div>
  );
}

// ─── Inline Bracket Manager ─────────────────────────────────────────────────
function BracketPanel({ tournamentId }) {
  const [bracket, setBracket] = React.useState(null);
  const [matchesByRound, setMatchesByRound] = React.useState({});
  const [regMap, setRegMap] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState(null);
  const notify = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3500); };

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data: bracketRow } = await supabaseAdmin.from('long_brackets').select('*').eq('tournament_id', tournamentId).maybeSingle();
    setBracket(bracketRow || null);
    if (bracketRow) {
      const { data: matches } = await supabaseAdmin.from('long_br_matches').select('*').eq('bracket_id', bracketRow.id).order('round_number').order('match_number');
      const grouped = {};
      (matches || []).forEach((m) => { if (!grouped[m.round_number]) grouped[m.round_number] = []; grouped[m.round_number].push(m); });
      setMatchesByRound(grouped);
    } else {
      setMatchesByRound({});
    }
    const { data: regs } = await supabaseAdmin.from('tournament_registrations').select('id, team_name').eq('tournament_id', tournamentId);
    const map = {};
    (regs || []).forEach((r) => { map[r.id] = r.team_name; });
    setRegMap(map);
    setLoading(false);
  }, [tournamentId]);

  React.useEffect(() => { load(); }, [load]);

  const generateFixtures = async () => {
    setSaving(true);
    // Use all non-rejected teams (payment = joined, no manual confirmation needed)
    const { data: regs } = await supabaseAdmin
      .from('tournament_registrations')
      .select('id, team_name')
      .eq('tournament_id', tournamentId)
      .neq('status', 'rejected');
    const teams = regs || [];
    if (!teams.length || !isPowerOfTwo(teams.length) || teams.length < 4) {
      notify('Need a power-of-two number of teams (≥ 4). Remove some teams to balance.', 'error');
      setSaving(false);
      return;
    }
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const { data: bracketRow, error: bErr } = await supabaseAdmin.from('long_brackets').upsert({ tournament_id: tournamentId, current_round: 1 }, { onConflict: 'tournament_id' }).select('*').maybeSingle();
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
    load();
  };

  const recomputeNextRounds = async (bracketId, baseMatches) => {
    const rounds = {};
    baseMatches.forEach((m) => { if (!rounds[m.round_number]) rounds[m.round_number] = []; rounds[m.round_number].push(m); });
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

  const handleWinnerChange = async (match, winnerId) => {
    if (!winnerId) return;
    setSaving(true);
    const { error } = await supabaseAdmin.from('long_br_matches').update({ winner_registration_id: winnerId }).eq('id', match.id);
    if (error) { notify('Failed to update winner.', 'error'); setSaving(false); return; }
    const { data: matches } = await supabaseAdmin.from('long_br_matches').select('*').eq('bracket_id', match.bracket_id).order('round_number').order('match_number');
    await recomputeNextRounds(match.bracket_id, matches || []);
    notify('Winner saved. Later rounds updated.');
    setSaving(false);
    load();
  };

  const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${toastMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{toastMsg.msg}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={generateFixtures}
          disabled={saving || loading}
        >
          {saving ? 'Working…' : bracket ? 'Regenerate fixtures' : 'Generate Round 1 fixtures'}
        </button>
        <span className="text-[11px] text-slate-500">Needs a power-of-2 number of teams (≥ 4). Remove teams to balance if needed.</span>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading bracket…</p>}
      {!loading && !roundNumbers.length && <p className="text-xs text-slate-400">No fixtures yet. Click Generate to begin.</p>}

      {roundNumbers.map((round) => (
        <div key={round} className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Round {round}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {matchesByRound[round].map((m) => {
              const teamA = regMap[m.team_a_registration_id] || m.team_a_registration_id?.slice(0, 8) + '…';
              const teamB = regMap[m.team_b_registration_id] || m.team_b_registration_id?.slice(0, 8) + '…';
              const winner = regMap[m.winner_registration_id];
              return (
                <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <p className="text-[11px] text-slate-500">Match {m.match_number}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleWinnerChange(m, m.team_a_registration_id)}
                      className={`flex-1 rounded px-3 py-2 text-xs font-semibold transition-colors ${m.winner_registration_id === m.team_a_registration_id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {teamA}
                    </button>
                    <span className="text-slate-600 font-bold text-xs">VS</span>
                    <button
                      onClick={() => handleWinnerChange(m, m.team_b_registration_id)}
                      className={`flex-1 rounded px-3 py-2 text-xs font-semibold transition-colors ${m.winner_registration_id === m.team_b_registration_id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {teamB}
                    </button>
                  </div>
                  {winner && <p className="text-[11px] text-emerald-400">✓ Winner: {winner}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Room Code Manager ──────────────────────────────────────────────────────
function RoomCodePanel({ tournamentId }) {
  const [roomId, setRoomId] = React.useState('');
  const [roomPass, setRoomPass] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [existing, setExisting] = React.useState(null);
  const [toastMsg, setToastMsg] = React.useState(null);
  const notify = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3000); };

  React.useEffect(() => {
    supabaseAdmin.from('room_codes').select('*').eq('tournament_id', tournamentId).maybeSingle()
      .then(({ data }) => {
        if (data) { setExisting(data); setRoomId(data.room_id || ''); setRoomPass(data.room_password || ''); }
      });
  }, [tournamentId]);

  const save = async () => {
    setSaving(true);
    const payload = { tournament_id: tournamentId, room_id: roomId, room_password: roomPass };
    const { error } = existing
      ? await supabaseAdmin.from('room_codes').update(payload).eq('id', existing.id)
      : await supabaseAdmin.from('room_codes').insert(payload);
    setSaving(false);
    if (error) { notify('Failed: ' + error.message, 'error'); return; }
    notify('Room code saved!');
  };

  return (
    <div className="card space-y-3 text-xs max-w-md">
      {toastMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${toastMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{toastMsg.msg}</div>
      )}
      <h3 className="text-sm font-semibold text-slate-100">Room code</h3>
      <div>
        <label className="label">Room ID</label>
        <input className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
      </div>
      <div>
        <label className="label">Room password</label>
        <input className="input" value={roomPass} onChange={(e) => setRoomPass(e.target.value)} placeholder="Password" />
      </div>
      <button className="btn-primary text-xs" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save room code'}</button>
    </div>
  );
}

// ─── Main TournamentDetail page ──────────────────────────────────────────────
export function TournamentDetailPage() {
  const { gameId, tournamentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tournament, setTournament] = React.useState(null);
  const [registrations, setRegistrations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false });

  const [tab, setTab] = React.useState(() => searchParams.get('tab') || 'overview');

  const notify = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data: tData, error: tErr } = await supabaseAdmin.from('tournaments').select('*').eq('id', tournamentId).eq('game_id', gameId).maybeSingle();
    if (tErr) { notify('Failed to load tournament.', 'error'); setLoading(false); return; }
    setTournament(tData || null);

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
        slot_reserved_at,
        registration_members ( slot, game_uid, in_game_name, player_id )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (rErr) console.error('Registrations fetch error:', rErr);

    const regs = rData || [];

    const hostPlayerIds = [...new Set(regs.map((r) => r.host_player_id).filter(Boolean))];
    let hostMap = {};
    if (hostPlayerIds.length > 0) {
      const { data: playerRows } = await supabaseAdmin
        .from('players')
        .select('id, full_name, phone')
        .in('id', hostPlayerIds);
      (playerRows || []).forEach((p) => { hostMap[p.id] = p; });
    }

    const enriched = regs.map((r) => ({
      ...r,
      hostPlayer: hostMap[r.host_player_id] || null,
      teammates: (r.registration_members || [])
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
        .filter((m) => (m.slot ?? 0) > 0),
    }));

    setRegistrations(enriched);
    setLoading(false);
  }, [gameId, tournamentId]);

  React.useEffect(() => { load(); }, [load]);

  const handleBack = () => navigate(`/${gameId}/tournaments`);

  const handleArchiveConfirmed = async () => {
    if (!tournament) return;
    const { error } = await supabaseAdmin.from('tournaments').update({ is_archived: true }).eq('id', tournament.id);
    if (error) { notify('Failed to archive tournament.', 'error'); return; }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
    navigate(`/${gameId}/tournaments`);
  };

  const handleDeleteConfirmed = async () => {
    if (!tournament) return;
    const { error } = await supabaseAdmin.from('tournaments').delete().eq('id', tournament.id);
    if (error) { notify('Failed to delete tournament.', 'error'); return; }
    notify('Tournament deleted permanently.');
    setConfirmDelete({ open: false });
    navigate(`/${gameId}/tournaments`);
  };

  // Remove a single registration (admin action)
  const handleRemoveRegistration = async (reg) => {
    const { error } = await supabaseAdmin
      .from('tournament_registrations')
      .update({ status: 'rejected' })
      .eq('id', reg.id);
    if (error) { notify('Failed to remove.', 'error'); return; }
    notify('Registration removed.');
    load();
  };

  const typeLabel = tournament ? TOURNAMENT_TYPES.find((t) => t.id === tournament.type)?.label || tournament.type : '';

  // All registrations = joined (payment done). Only rejected = removed.
  const joined   = registrations.filter((r) => r.status !== 'rejected');
  const rejected = registrations.filter((r) => r.status === 'rejected');

  // Revenue = joined teams × entry fee (regardless of payment_id for now, since payment = confirmed)
  const totalRevenue = tournament?.entry_fee
    ? joined.length * Number(tournament.entry_fee || 0)
    : 0;

  const isLong = tournament?.type === 'long';
  const hasBracket = isLong && (tournament?.mode === 'cs' || tournament?.mode === 'lw');
  const isBR = tournament?.mode === 'br';

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'registrations', label: `Registrations (${registrations.length})` },
    { id: 'results', label: 'Results' },
    ...(hasBracket ? [{ id: 'bracket', label: 'Bracket' }] : []),
    { id: 'room', label: 'Room code' },
  ];

  if (!tournament && !loading) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
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
          <button type="button" onClick={handleBack} className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Back to tournaments
          </button>
          {loading ? (
            <div className="h-6 w-48 rounded bg-slate-800 animate-pulse" />
          ) : (
            <h1 className="text-xl font-semibold text-slate-50">{tournament?.title || 'Tournament'}</h1>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] mt-1">
            {typeLabel && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isLong ? 'bg-violet-900/60 text-violet-300 border border-violet-700/50' : 'bg-sky-900/60 text-sky-300 border border-sky-700/50'}`}>{typeLabel}</span>
            )}
            {tournament?.mode && <span className="badge bg-slate-800 text-slate-200">{tournament.mode.toUpperCase()}</span>}
            <span className="badge bg-slate-900 text-slate-300">Slots: {tournament?.filled_slots || 0}/{tournament?.max_slots || 0}</span>
            <span className={'status-pill ' + (tournament?.registration_status === 'open' ? 'pending' : 'approved')}>
              Reg: {tournament?.registration_status}
            </span>
            {tournament?.status && <span className="status-pill approved">Status: {tournament.status}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/${gameId}/tournaments?editId=${tournamentId}`)}>Edit</button>
          <button type="button" className="btn-secondary" onClick={() => setConfirmArchive({ open: true })}>Archive</button>
          <button type="button" className="rounded px-3 py-1.5 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors text-xs" onClick={() => setConfirmDelete({ open: true, title: tournament?.title })}>Delete</button>
        </div>
      </header>

      {/* Stats bar — payment based, no manual confirmation */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: 'Total teams', value: registrations.length, color: 'text-slate-50' },
          { label: 'Joined (paid)', value: joined.length, color: 'text-emerald-400' },
          { label: 'Removed', value: rejected.length, color: 'text-red-400' },
          { label: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-center">
            <p className="text-[10px] text-slate-500">{stat.label}</p>
            <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id ? 'border-sky-500 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[200px]">
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="card space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-slate-100">Details</h2>
              <div className="space-y-1 text-slate-300">
                <p><span className="text-slate-500">Format:</span> {tournament?.format_label || '—'}</p>
                {tournament?.mode === 'br' && <p><span className="text-slate-500">Map:</span> {tournament.map || '—'}</p>}
                {(tournament?.mode === 'cs' || tournament?.mode === 'lw') && (
                  <>
                    <p><span className="text-slate-500">Total rounds:</span> {tournament.total_rounds || '—'}</p>
                    <p><span className="text-slate-500">Skills on:</span> {tournament.skills_on ? 'Yes' : 'No'}</p>
                    <p><span className="text-slate-500">Limited ammo:</span> {tournament.limited_ammo ? 'Yes' : 'No'}</p>
                  </>
                )}
                {tournament?.mode === 'tdm' && (
                  <p><span className="text-slate-500">Kill target:</span> 40 kills per side</p>
                )}
                <p><span className="text-slate-500">Entry fee:</span> {tournament?.entry_fee ? `₹${Number(tournament.entry_fee).toLocaleString()}` : 'Free'}</p>
                <p><span className="text-slate-500">Entry closing:</span> {tournament?.entry_closing_time ? new Date(tournament.entry_closing_time).toLocaleString('en-IN') : '—'}</p>
                <p><span className="text-slate-500">Match start:</span> {tournament?.start_time ? new Date(tournament.start_time).toLocaleString('en-IN') : '—'}</p>
                {tournament?.youtube_live_url && (
                  <p><span className="text-slate-500">YouTube:</span>{' '}
                    <a href={tournament.youtube_live_url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline truncate">Watch</a>
                  </p>
                )}
              </div>
            </div>
            <div className="card space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-slate-100">Prize & points</h2>
              <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{tournament?.prize_text || 'No prize distribution text set.'}</p>
              {tournament?.points_table && (
                <>
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.14em] mt-2">Points table</p>
                  <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{tournament.points_table}</p>
                </>
              )}
              {tournament?.winner_text && (
                <div className="mt-2 rounded-lg bg-emerald-900/20 border border-emerald-800/40 px-3 py-2">
                  <p className="text-[11px] text-emerald-300 font-semibold">{tournament.winner_text}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REGISTRATIONS */}
        {tab === 'registrations' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-sky-500/10 border border-sky-700/50 px-4 py-2 text-xs text-sky-300">
              💳 Payment = Joined. All registered teams are active. Use Remove to kick a team.
            </div>
            <div className="card overflow-x-auto text-xs">
              {loading ? (
                <p className="text-xs text-slate-400">Loading registrations…</p>
              ) : registrations.length === 0 ? (
                <p className="text-xs text-slate-400">No registrations yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>Members</th>
                      <th>Host</th>
                      <th>Host UID</th>
                      <th>Order ID</th>
                      <th>Payment ID</th>
                      <th>Registered</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r, idx) => {
                      const allMembers = (r.registration_members || []).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
                      const isRemoved = r.status === 'rejected';
                      return (
                        <tr key={r.id} className={isRemoved ? 'opacity-40' : ''}>
                          <td className="text-slate-500">{idx + 1}</td>
                          <td>
                            <div className="font-medium">{r.team_name || 'Unnamed team'}</div>
                            {isRemoved && <div className="text-[10px] text-red-400">Removed</div>}
                          </td>
                          <td>
                            {allMembers.length > 0 ? (
                              <div className="space-y-0.5">
                                {allMembers.map((m) => (
                                  <div key={m.slot} className="text-[10px] text-slate-300">
                                    <span className="text-slate-500">#{m.slot}</span> {m.in_game_name || m.game_uid}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[10px]">{r.team_members_summary || '—'}</span>
                            )}
                          </td>
                          <td>
                            <div>{r.hostPlayer?.full_name || '—'}</div>
                            {r.hostPlayer?.phone && <div className="text-[10px] text-slate-500">{r.hostPlayer.phone}</div>}
                          </td>
                          <td className="font-mono text-[11px]">{r.host_uid}</td>
                          <td className="font-mono text-[10px] text-sky-400">{r.razorpay_order_id || '—'}</td>
                          <td className="font-mono text-[10px] text-emerald-400">{r.payment_id || '—'}</td>
                          <td className="whitespace-nowrap text-slate-400">
                            {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td>
                            {!isRemoved ? (
                              <button
                                onClick={() => handleRemoveRegistration(r)}
                                className="text-[10px] rounded px-2 py-0.5 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  await supabaseAdmin.from('tournament_registrations').update({ status: 'confirmed' }).eq('id', r.id);
                                  load();
                                }}
                                className="text-[10px] rounded px-2 py-0.5 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800/60 transition-colors"
                              >
                                Restore
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {tab === 'results' && tournament && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-400">
              Mode: <span className="text-slate-200 uppercase font-medium">{tournament.mode}</span>
              {' · '}{joined.length} team{joined.length !== 1 ? 's' : ''} joined
            </div>
            {isBR ? (
              <BrResultsPanel tournament={tournament} registrations={registrations} onSaved={load} />
            ) : (
              <CsLwResultsPanel tournament={tournament} registrations={registrations} onSaved={load} />
            )}
          </div>
        )}

        {/* BRACKET */}
        {tab === 'bracket' && hasBracket && (
          <BracketPanel tournamentId={tournamentId} />
        )}

        {/* ROOM CODE */}
        {tab === 'room' && (
          <RoomCodePanel tournamentId={tournamentId} />
        )}
      </div>

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
        description="This will permanently delete the tournament and all its registrations. This cannot be undone."
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete({ open: false })}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
