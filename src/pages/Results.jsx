import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { calculateBrPoints } from '../constants';
import { Toast } from '../components/Toast';

function teammateCount(teamSize) {
  const n = Number(teamSize);
  if (!n || n <= 1) return 0;
  if (n === 2) return 1;
  return 3;
}

function buildPlayerEntries(reg, uidToName) {
  const all = [
    reg.host_uid,
    reg.teammate_uid_1,
    reg.teammate_uid_2,
    reg.teammate_uid_3,
  ].filter(Boolean);
  return all.map((uid) => ({
    uid,
    name: uidToName[uid] || uid,
  }));
}

function CsLwResultEntry({ tournament, teams, uidToName, onSaved }) {
  const totalRounds = Number(tournament.total_rounds) || 13;
  const objectiveRounds = Math.ceil(totalRounds / 2) + 1;

  const pairs = React.useMemo(() => {
    const p = [];
    for (let i = 0; i + 1 < teams.length; i += 2) {
      p.push({ a: teams[i], b: teams[i + 1] });
    }
    return p;
  }, [teams]);

  const [matchData, setMatchData] = React.useState([]);

  React.useEffect(() => {
    setMatchData(pairs.map(() => ({ roundsA: '', roundsB: '', winner: '', players: {} })));
  }, [pairs]);

  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  function setRounds(pairIdx, side, val) {
    setMatchData((prev) => {
      const next = [...prev];
      next[pairIdx] = { ...next[pairIdx], [side === 'a' ? 'roundsA' : 'roundsB']: val };
      return next;
    });
  }

  function setWinner(pairIdx, val) {
    setMatchData((prev) => {
      const next = [...prev];
      next[pairIdx] = { ...next[pairIdx], winner: val };
      return next;
    });
  }

  function setPlayerStat(pairIdx, uid, field, val) {
    setMatchData((prev) => {
      const next = [...prev];
      const players = {
        ...next[pairIdx].players,
        [uid]: { ...(next[pairIdx].players[uid] || {}), [field]: val },
      };
      next[pairIdx] = { ...next[pairIdx], players };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const matches = pairs.map((pair, i) => {
      const md = matchData[i];
      const entriesA = buildPlayerEntries(pair.a, uidToName);
      const entriesB = buildPlayerEntries(pair.b, uidToName);
      const playersA = entriesA.map(({ uid, name }) => ({
        name,
        uid,
        kills: Number(md.players[uid]?.kills || 0),
        deaths: Number(md.players[uid]?.deaths || 0),
      }));
      const playersB = entriesB.map(({ uid, name }) => ({
        name,
        uid,
        kills: Number(md.players[uid]?.kills || 0),
        deaths: Number(md.players[uid]?.deaths || 0),
      }));
      return {
        teamA: { name: pair.a.team_name, rounds_won: Number(md.roundsA || 0), players: playersA },
        teamB: { name: pair.b.team_name, rounds_won: Number(md.roundsB || 0), players: playersB },
        winner_team: md.winner === 'a' ? pair.a.team_name : md.winner === 'b' ? pair.b.team_name : null,
      };
    });

    const winnerTeam = matches.find((m) => m.winner_team)?.winner_team || null;

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({
        cs_lw_results: { total_rounds: totalRounds, objective_rounds: objectiveRounds, matches },
        winner_text: winnerTeam ? `Winner: ${winnerTeam}` : '',
      })
      .eq('id', tournament.id);

    setSaving(false);
    if (error) {
      notify(`Failed to save: ${error.message}`, 'error');
      return;
    }
    notify('Results saved!');
    if (onSaved) onSaved();
  }

  if (teams.length === 0) {
    return (
      <div className="card text-xs text-slate-400">
        No confirmed teams found for this tournament. Make sure registrations are approved/confirmed.
      </div>
    );
  }

  if (teams.length < 2) {
    return (
      <div className="card text-xs text-amber-400">
        ⚠️ Only 1 confirmed team found. Need at least 2 teams to enter CS/LW results.
      </div>
    );
  }

  if (matchData.length !== pairs.length) {
    return (
      <div className="card flex items-center gap-3 py-6 text-xs text-slate-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
        <p>Loading match data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            toast.type === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="rounded-lg bg-sky-500/10 border border-sky-700 px-4 py-2 text-xs text-sky-300 flex gap-6">
        <span>
          Total rounds: <strong className="text-slate-100">{totalRounds}</strong>
        </span>
        <span>
          Objective (rounds to win):{' '}
          <strong className="text-amber-300">{objectiveRounds}</strong>
        </span>
      </div>

      {pairs.map((pair, pairIdx) => {
        const md = matchData[pairIdx];
        if (!md) return null;
        const entriesA = buildPlayerEntries(pair.a, uidToName);
        const entriesB = buildPlayerEntries(pair.b, uidToName);

        return (
          <div key={pairIdx} className="card space-y-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Match {pairIdx + 1}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <TeamPanel
                team={pair.a}
                playerEntries={entriesA}
                rounds={md.roundsA}
                onRoundsChange={(v) => setRounds(pairIdx, 'a', v)}
                playerStats={md.players}
                onStatChange={(uid, field, val) => setPlayerStat(pairIdx, uid, field, val)}
                isWinner={md.winner === 'a'}
              />

              <div className="flex flex-col items-center gap-3 pt-8">
                <span className="text-slate-500 font-bold text-sm">VS</span>
                <div className="space-y-1 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Winner</p>
                  <button
                    onClick={() => setWinner(pairIdx, md.winner === 'a' ? '' : 'a')}
                    className={`block w-full rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                      md.winner === 'a'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {pair.a.team_name.substring(0, 10)}
                  </button>
                  <button
                    onClick={() => setWinner(pairIdx, md.winner === 'b' ? '' : 'b')}
                    className={`block w-full rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                      md.winner === 'b'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {pair.b.team_name.substring(0, 10)}
                  </button>
                </div>
              </div>

              <TeamPanel
                team={pair.b}
                playerEntries={entriesB}
                rounds={md.roundsB}
                onRoundsChange={(v) => setRounds(pairIdx, 'b', v)}
                playerStats={md.players}
                onStatChange={(uid, field, val) => setPlayerStat(pairIdx, uid, field, val)}
                isWinner={md.winner === 'b'}
              />
            </div>
          </div>
        );
      })}

      <button className="btn-primary w-full" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save CS/LW Results'}
      </button>
    </div>
  );
}

function TeamPanel({ team, playerEntries, rounds, onRoundsChange, playerStats, onStatChange, isWinner }) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-3 transition-colors ${
        isWinner ? 'border-emerald-600 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-slate-700 border border-slate-600 flex-shrink-0" />
        <span className="font-bold text-sm text-slate-100 truncate">
          {team.team_name.toUpperCase()}
        </span>
        {isWinner && (
          <span className="ml-auto text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full">
            Winner
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 whitespace-nowrap">Rounds:</span>
        <input
          type="number"
          min="0"
          value={rounds}
          onChange={(e) => onRoundsChange(e.target.value)}
          className="input w-16 text-xs text-center"
          placeholder="0"
        />
      </div>

      <div>
        <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">
          <span>Player</span>
          <span className="text-center">Kills</span>
          <span className="text-center">Deaths</span>
        </div>
        <div className="space-y-1">
          {playerEntries.map(({ uid, name }) => (
            <div key={uid} className="grid grid-cols-3 gap-1 items-center">
              <span className="text-[11px] text-slate-200 truncate" title={uid}>
                {name}
              </span>
              <input
                type="number"
                min="0"
                value={playerStats[uid]?.kills ?? ''}
                onChange={(e) => onStatChange(uid, 'kills', e.target.value)}
                placeholder="K"
                className="input w-full text-xs text-center py-1"
              />
              <input
                type="number"
                min="0"
                value={playerStats[uid]?.deaths ?? ''}
                onChange={(e) => onStatChange(uid, 'deaths', e.target.value)}
                placeholder="D"
                className="input w-full text-xs text-center py-1"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrResultEntry({
  tournament,
  teams,
  uidToName,
  brRows,
  onChangeBrRow,
  onSaveBr,
  saving,
  winnerText,
  setWinnerText,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-100">Single Match · Battle Royale</h2>
      <div className="card overflow-x-auto text-xs">
        {teams.length === 0 ? (
          <p className="text-xs text-slate-400">No confirmed teams registered.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Players</th>
                <th>Kills</th>
                <th>Position</th>
                <th>Points (auto)</th>
              </tr>
            </thead>
            <tbody>
              {brRows.map((row, idx) => {
                const reg = teams[idx];
                const entries = reg ? buildPlayerEntries(reg, uidToName) : [];
                return (
                  <tr key={row.team_name}>
                    <td className="font-semibold">{row.team_name}</td>
                    <td>
                      <div className="space-y-0.5">
                        {entries.map(({ uid, name }) => (
                          <div key={uid} className="text-[11px] text-slate-300">
                            {name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input w-20 text-xs"
                        value={row.kills}
                        onChange={(e) => onChangeBrRow(idx, 'kills', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input w-20 text-xs"
                        value={row.position}
                        onChange={(e) => onChangeBrRow(idx, 'position', e.target.value)}
                      />
                    </td>
                    <td className="font-semibold text-sky-300">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="card space-y-2 text-xs">
        <label className="label">Winner announcement</label>
        <textarea
          rows={3}
          className="input resize-none"
          value={winnerText}
          onChange={(e) => setWinnerText(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving} onClick={onSaveBr}>
            {saving ? 'Saving…' : 'Save BR Results'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndTournamentSection({ tournament, onEnded }) {
  const [confirm, setConfirm] = React.useState(false);
  const [ending, setEnding] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isEnded = tournament.status === 'ended';

  async function handleEnd() {
    setEnding(true);
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'ended', registration_status: 'closed' })
      .eq('id', tournament.id);
    setEnding(false);
    if (error) {
      notify(`Error: ${error.message}`, 'error');
      return;
    }
    notify('Tournament ended! Players will now see results.');
    setConfirm(false);
    if (onEnded) onEnded();
  }

  return (
    <div className="card space-y-3 border border-red-900/40 bg-red-500/5">
      {toast && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            toast.type === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-red-400">End Tournament</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isEnded
              ? '✅ This tournament has ended. Players can see results.'
              : 'Once ended, players will see the tournament as concluded and view final results.'}
          </p>
        </div>
        {!isEnded && !confirm && (
          <button
            onClick={() => setConfirm(true)}
            className="rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 transition-colors flex-shrink-0"
          >
            End Tournament
          </button>
        )}
        {isEnded && (
          <span className="text-xs text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 rounded-full">
            Ended
          </span>
        )}
      </div>

      {confirm && !isEnded && (
        <div className="rounded-lg bg-red-500/10 border border-red-700 p-3 space-y-2">
          <p className="text-xs text-red-300 font-semibold">
            ⚠️ Are you sure? This will close registrations and show results to all players.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnd}
              disabled={ending}
              className="btn-primary bg-red-600 hover:bg-red-500 text-xs"
            >
              {ending ? 'Ending…' : 'Yes, End Tournament'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultsPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();

  const [tournaments, setTournaments] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [teams, setTeams] = React.useState([]);
  const [uidToName, setUidToName] = React.useState({});
  const [brRows, setBrRows] = React.useState([]);
  const [winnerText, setWinnerText] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const [toast, setToast] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadTournaments() {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select('id, title, type, mode, total_rounds, status, team_size')
      .eq('is_archived', false)
      .eq('game_id', gameId)
      .order('start_time', { ascending: false });
    if (error) console.error(error);
    setTournaments(data || []);

    const tid = searchParams.get('tournamentId');
    if (tid && (data || []).some((t) => String(t.id) === String(tid))) {
      handleSelectTournament(tid, data || []);
    }
  }

  React.useEffect(() => {
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const loadTeams = async (tid) => {
    const { data: regsData } = await supabaseAdmin
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tid)
      .eq('status', 'confirmed');

    const regs = regsData || [];
    setTeams(regs);

    const allUids = [];
    regs.forEach((r) => {
      if (r.host_uid) allUids.push(r.host_uid);
      if (r.teammate_uid_1) allUids.push(r.teammate_uid_1);
      if (r.teammate_uid_2) allUids.push(r.teammate_uid_2);
      if (r.teammate_uid_3) allUids.push(r.teammate_uid_3);
    });

    if (allUids.length > 0) {
      const uniqueUids = [...new Set(allUids)];
      const { data: playersData } = await supabaseAdmin
        .from('players')
        .select('ff_uid, full_name')
        .in('ff_uid', uniqueUids);

      const map = {};
      (playersData || []).forEach((p) => {
        map[p.ff_uid] = p.full_name || p.ff_uid;
      });
      setUidToName(map);
    } else {
      setUidToName({});
    }

    setBrRows(
      regs.map((r) => ({
        team_name: r.team_name,
        host_player_id: r.host_player_id,
        kills: '',
        position: '',
        points: 0,
      })),
    );
  };

  const handleSelectTournament = async (id, preloadedList) => {
    const source = preloadedList && preloadedList.length ? preloadedList : tournaments;
    const t = source.find((tt) => String(tt.id) === String(id)) || null;
    setSelected(t);
    setWinnerText('');
    setTeams([]);
    setUidToName({});
    setBrRows([]);
    if (t) await loadTeams(id);
  };

  const handleChangeBrRow = (index, field, value) => {
    setBrRows((rows) => {
      const next = [...rows];
      const row = { ...next[index], [field]: value };
      row.points = calculateBrPoints(row.kills, row.position);
      next[index] = row;
      return next;
    });
  };

  const notifyPlayers = async (playerIds, text) => {
    if (!playerIds?.length) return;
    const rows = playerIds
      .filter(Boolean)
      .map((id) => ({
        player_id: id,
        title: 'Tournament Result',
        body: text,
        type: 'tournament',
      }));
    if (rows.length) await supabaseAdmin.from('notifications').insert(rows);
  };

  const handleSaveBr = async () => {
    if (!selected) return;
    setStatus('saving');

    let bracketId;
    const { data: existingBracket } = await supabaseAdmin
      .from('long_brackets')
      .select('id')
      .eq('tournament_id', selected.id)
      .maybeSingle();

    if (existingBracket) {
      bracketId = existingBracket.id;
    } else {
      const { data: newBracket, error } = await supabaseAdmin
        .from('long_brackets')
        .insert({ tournament_id: selected.id, total_rounds: 1 })
        .select('id')
        .single();
      if (error || !newBracket) {
        notify('Failed to create bracket.', 'error');
        setStatus('idle');
        return;
      }
      bracketId = newBracket.id;
    }

    const { data: matchData, error: matchErr } = await supabaseAdmin
      .from('long_br_matches')
      .upsert({ bracket_id: bracketId, round_number: 1, match_number: 1 }, { onConflict: 'bracket_id,match_number' })
      .select('id')
      .single();

    if (matchErr || !matchData) {
      notify('Failed to create match.', 'error');
      setStatus('idle');
      return;
    }

    const payload = brRows.map((r, idx) => {
      const reg = teams[idx];
      const entries = reg ? buildPlayerEntries(reg, uidToName) : [];
      return {
        match_id: matchData.id,
        team_name: r.team_name,
        kills: Number(r.kills || 0),
        position: Number(r.position || 0),
        points: r.points,
        player_names: entries.map((e) => e.name),
      };
    });

    const { error: scoresErr } = await supabaseAdmin
      .from('long_br_match_scores')
      .upsert(payload, { onConflict: 'match_id,team_name' });

    if (scoresErr) {
      notify(`Failed to save scores: ${scoresErr.message}`, 'error');
      setStatus('idle');
      return;
    }

    if (winnerText.trim()) {
      await supabaseAdmin
        .from('tournaments')
        .update({ winner_text: winnerText.trim() })
        .eq('id', selected.id);
      const playerIds = brRows.map((r) => r.host_player_id).filter(Boolean);
      await notifyPlayers(playerIds, `Results are out for your tournament! ${winnerText.trim()}`);
    }

    notify('BR Results saved!');
    setStatus('idle');
  };

  const isSingleBR = selected && selected.type === 'single' && selected.mode === 'br';
  const isCSorLW = selected && selected.mode !== 'br';

  return (
    <div className="space-y-4">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Results Entry</h1>
        <p className="text-xs text-slate-400">Enter match results and end the tournament for players.</p>
      </header>

      <div className="card space-y-3 text-xs">
        <label className="label">Tournament</label>
        <select
          className="input"
          value={selected?.id || ''}
          onChange={(e) => handleSelectTournament(e.target.value)}
        >
          <option value="">Select tournament…</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {t.type} · {t.mode?.toUpperCase()}
              {t.status === 'ended' ? ' [ENDED]' : ''}
            </option>
          ))}
        </select>
      </div>

      {selected && isCSorLW && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            {selected.mode === 'cs' ? '⚔️ Clash Squad' : '🐺 Lone Wolf'} · Result Entry
          </h2>
          <CsLwResultEntry
            tournament={selected}
            teams={teams}
            uidToName={uidToName}
            onSaved={() => {
              notify('CS/LW results saved!');
              loadTeams(selected.id);
            }}
          />
        </section>
      )}

      {selected && isSingleBR && (
        <section>
          <BrResultEntry
            tournament={selected}
            teams={teams}
            uidToName={uidToName}
            brRows={brRows}
            onChangeBrRow={handleChangeBrRow}
            onSaveBr={handleSaveBr}
            saving={status === 'saving'}
            winnerText={winnerText}
            setWinnerText={setWinnerText}
          />
        </section>
      )}

      {selected && (
        <EndTournamentSection
          tournament={selected}
          onEnded={() => {
            loadTournaments();
            handleSelectTournament(selected.id);
          }}
        />
      )}
    </div>
  );
}
