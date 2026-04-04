import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { calculateBrPoints } from '../constants';

export function ResultsPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [password, setPassword] = React.useState('');
  const [unlockedIds, setUnlockedIds] = React.useState([]);
  const [teams, setTeams] = React.useState([]);
  const [brRows, setBrRows] = React.useState([]);
  const [winnerText, setWinnerText] = React.useState('');
  const [status, setStatus] = React.useState('idle');

  React.useEffect(() => {
    supabaseAdmin
      .from('tournaments')
      .select('id,title,type,mode')
      .eq('is_archived', false)
      .order('match_start_time', { ascending: true })
      .then(({ data }) => setTournaments(data || []));
  }, []);

  const loadTeams = async (tid) => {
    const { data } = await supabaseAdmin
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tid)
      .eq('status', 'confirmed');
    setTeams(data || []);
    setBrRows(
      (data || []).map((r) => ({
        team_name: r.team_name,
        kills: '',
        position: '',
        points: 0,
      })),
    );
  };

  const handleSelectTournament = async (id) => {
    setSelected(tournaments.find((t) => t.id === Number(id)) || null);
    setPassword('');
    if (!unlockedIds.includes(id)) {
      setTeams([]);
      setBrRows([]);
    } else {
      await loadTeams(id);
    }
  };

  const handleUnlock = async () => {
    if (!selected) return;
    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('tournament_password')
      .eq('id', selected.id)
      .maybeSingle();
    if (!data || data.tournament_password !== password) {
      setStatus('error');
      return;
    }
    setStatus('idle');
    setUnlockedIds((prev) => [...prev, selected.id]);
    await loadTeams(selected.id);
  };

  const handleChangeBrRow = (index, field, value) => {
    setBrRows((rows) => {
      const next = [...rows];
      const row = { ...next[index], [field]: value };
      const pts = calculateBrPoints(row.kills, row.position);
      row.points = pts;
      next[index] = row;
      return next;
    });
  };

  const handleSaveBr = async () => {
  if (!selected) return;
  setStatus('saving');

  // Step 1: Get or create the match row for this tournament
  const { data: matchData, error: matchErr } = await supabaseAdmin
    .from('long_br_matches')
    .upsert(
      { tournament_id: selected.id, match_number: 1 },
      { onConflict: 'tournament_id,match_number' },
    )
    .select('id')
    .single();

  if (matchErr || !matchData) {
    console.error(matchErr);
    notify('Failed to create match record.', 'error');
    setStatus('idle');
    return;
  }

  // Step 2: Upsert scores linked to that match
  const payload = brRows.map((r) => ({
    match_id: matchData.id,
    team_name: r.team_name,
    kills: Number(r.kills || 0),
    position: Number(r.position || 0),
    points: r.points,
  }));

  const { error: scoresErr } = await supabaseAdmin
    .from('long_br_match_scores')
    .upsert(payload, { onConflict: 'match_id,team_name' });

  if (scoresErr) {
    console.error(scoresErr);
    notify('Failed to save scores.', 'error');
    setStatus('idle');
    return;
  }

  // Step 3: Save winner announcement + notify players
  if (winnerText.trim()) {
    await supabaseAdmin
      .from('tournaments')
      .update({ winner_text: winnerText.trim() })
      .eq('id', selected.id);

    const playerIds = brRows.map((r) => r.host_player_id);
    await notifyPlayers(playerIds, winnerText.trim());
  }

  notify('Results saved. Players notified.');
  setStatus('idle');
};

  const unlocked = selected && unlockedIds.includes(selected.id);
  const isSingleBR = selected && selected.type === 'single' && selected.mode === 'br';

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Results entry</h1>
        <p className="text-xs text-slate-400">
          Secure entry for match results. Passwords are per tournament.
        </p>
      </header>

      <section className="space-y-3">
        <div className="card space-y-3 text-xs">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end">
            <div>
              <label className="label" htmlFor="tournament">
                Tournament
              </label>
              <select
                id="tournament"
                className="input"
                value={selected?.id || ''}
                onChange={(e) => handleSelectTournament(e.target.value)}
              >
                <option value="">Select tournament</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.type} · {t.mode}
                  </option>
                ))}
              </select>
            </div>
            {selected && !unlocked && (
              <div>
                <label className="label" htmlFor="password">
                  Tournament password
                </label>
                <div className="flex gap-2">
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="btn-primary" onClick={handleUnlock}>
                    Unlock
                  </button>
                </div>
                {status === 'error' && (
                  <p className="mt-1 text-11px text-red-400">Incorrect password.</p>
                )}
              </div>
            )}
            {selected && unlocked && (
              <p className="text-11px text-emerald-300">
                Password verified for this session. You can enter results safely.
              </p>
            )}
          </div>
        </div>
      </section>

      {selected && unlocked && isSingleBR && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Single match · Battle Royale
          </h2>
          <div className="card overflow-x-auto text-xs">
            {teams.length === 0 ? (
              <p className="text-xs text-slate-400">No confirmed teams registered.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Kills</th>
                    <th>Position</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {brRows.map((row, idx) => (
                    <tr key={row.team_name}>
                      <td>{row.team_name}</td>
                      <td>
                        <input
                          type="number"
                          className="input w-20 text-11px"
                          value={row.kills}
                          onChange={(e) =>
                            handleChangeBrRow(idx, 'kills', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input w-20 text-11px"
                          value={row.position}
                          onChange={(e) =>
                            handleChangeBrRow(idx, 'position', e.target.value)
                          }
                        />
                      </td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card space-y-2 text-xs">
            <label className="label" htmlFor="winnerText">
              Winner announcement
            </label>
            <textarea
              id="winnerText"
              rows={3}
              className="input resize-none"
              value={winnerText}
              onChange={(e) => setWinnerText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={status === 'saving'}
                onClick={handleSaveBr}
              >
                {status === 'saving' ? 'Saving…' : 'Save results'}
              </button>
            </div>
          </div>
        </section>
      )}

      {selected && unlocked && !isSingleBR && (
        <section className="card text-xs text-slate-300">
          <p>
            This tournament mode uses long BR standings or bracket winners. You can extend this
            component to support CS/LW result text and screenshot uploads based on your final
            schema.
          </p>
        </section>
      )}
    </div>
  );
}
