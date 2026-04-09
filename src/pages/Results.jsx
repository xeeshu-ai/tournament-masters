import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { calculateBrPoints } from '../constants';
import { Toast } from '../components/Toast';

export function ResultsPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [teams, setTeams] = React.useState([]);
  const [brRows, setBrRows] = React.useState([]);
  const [winnerText, setWinnerText] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const [toast, setToast] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  React.useEffect(() => {
    supabaseAdmin
      .from('tournaments')
      .select('id, title, type, mode')
      .eq('is_archived', false)
      .order('start_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setTournaments(data || []);
      });
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
        host_player_id: r.host_player_id,
        kills: '',
        position: '',
        points: 0,
      })),
    );
  };

  const handleSelectTournament = async (id) => {
    const t = tournaments.find((t) => String(t.id) === String(id)) || null;
    setSelected(t);
    setWinnerText('');
    setTeams([]);
    setBrRows([]);
    if (t) await loadTeams(id);
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

  const notifyPlayers = async (playerIds, text) => {
    if (!playerIds?.length) return;
    const rows = playerIds.filter(Boolean).map((id) => ({
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
    {
      const { data: existingBracket, error: bracketFetchErr } = await supabaseAdmin
        .from('long_brackets')
        .select('id')
        .eq('tournament_id', selected.id)
        .maybeSingle();

      if (bracketFetchErr) {
        console.error(bracketFetchErr);
        notify('Failed to load bracket record.', 'error');
        setStatus('idle');
        return;
      }

      if (existingBracket) {
        bracketId = existingBracket.id;
      } else {
        const { data: newBracket, error: bracketCreateErr } = await supabaseAdmin
          .from('long_brackets')
          .insert({ tournament_id: selected.id, total_rounds: 1 })
          .select('id')
          .single();

        if (bracketCreateErr || !newBracket) {
          console.error(bracketCreateErr);
          notify('Failed to create bracket record.', 'error');
          setStatus('idle');
          return;
        }
        bracketId = newBracket.id;
      }
    }

    const { data: matchData, error: matchErr } = await supabaseAdmin
      .from('long_br_matches')
      .upsert(
        { bracket_id: bracketId, round_number: 1, match_number: 1 },
        { onConflict: 'bracket_id,match_number' },
      )
      .select('id')
      .single();

    if (matchErr || !matchData) {
      console.error(matchErr);
      notify('Failed to create match record.', 'error');
      setStatus('idle');
      return;
    }

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

    if (winnerText.trim()) {
      await supabaseAdmin
        .from('tournaments')
        .update({ winner_text: winnerText.trim() })
        .eq('id', selected.id);

      const playerIds = brRows.map((r) => r.host_player_id).filter(Boolean);
      await notifyPlayers(playerIds, `Results are out for your tournament! ${winnerText.trim()}`);
    }

    notify('Results saved. Players notified.');
    setStatus('idle');
  };

  const isSingleBR = selected && selected.type === 'single' && selected.mode === 'br';

  return (
    <div className="space-y-4">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Results entry</h1>
        <p className="text-xs text-slate-400">
          Enter match results and notify players automatically.
        </p>
      </header>

      <section className="space-y-3">
        <div className="card space-y-3 text-xs">
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
        </div>
      </section>

      {selected && isSingleBR && (
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

      {selected && !isSingleBR && (
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
