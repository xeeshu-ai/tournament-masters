
import React from 'react';
// ✅ Fix — use named imports
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';
import { isPowerOfTwo } from '../constants';

export default function BracketManagerPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [bracket, setBracket] = React.useState(null);
  const [matchesByRound, setMatchesByRound] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  React.useEffect(() => {
    async function loadTournaments() {
      const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('id, title, type, mode, max_slots')
        .eq('type', 'long')
        .in('mode', ['cs', 'lw'])
        .eq('is_archived', false)
        .order('id', { ascending: false });
      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
      setTournaments(data || []);
    }
    loadTournaments();
  }, []);

  const loadBracket = async (tid) => {
    if (!tid) {
      setBracket(null);
      setMatchesByRound({});
      return;
    }
    setLoading(true);
    const { data: bracketRow, error: bracketErr } = await supabaseAdmin
      .from('long_brackets')
      .select('*')
      .eq('tournament_id', tid)
      .maybeSingle();
    if (bracketErr) {
      // eslint-disable-next-line no-console
      console.error(bracketErr);
    }
    setBracket(bracketRow || null);

    const { data: matches, error: matchErr } = await supabaseAdmin
      .from('long_br_matches')
      .select('*')
      .eq('tournament_id', tid)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });
    if (matchErr) {
      // eslint-disable-next-line no-console
      console.error(matchErr);
    }
    const grouped = {};
    (matches || []).forEach((m) => {
      if (!grouped[m.round_number]) grouped[m.round_number] = [];
      grouped[m.round_number].push(m);
    });
    setMatchesByRound(grouped);
    setLoading(false);
  };

  const handleSelect = (value) => {
    setSelectedId(value);
    if (value) loadBracket(value);
    else {
      setBracket(null);
      setMatchesByRound({});
    }
  };

  const generateFixtures = async () => {
    if (!selectedId) {
      notify('Select a tournament first.', 'error');
      return;
    }
    setSaving(true);

    // Load confirmed registrations
    const { data: regs, error: regErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select('id, team_name')
      .eq('tournament_id', selectedId)
      .eq('status', 'confirmed');
    if (regErr) {
      // eslint-disable-next-line no-console
      console.error(regErr);
      notify('Failed to load registrations.', 'error');
      setSaving(false);
      return;
    }
    const teams = regs || [];

    if (!teams.length || !isPowerOfTwo(teams.length) || teams.length < 4) {
      notify('You need a power-of-two number of confirmed teams (>= 4) to generate fixtures.', 'error');
      setSaving(false);
      return;
    }

    // Fisher–Yates shuffle
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Upsert bracket row
    const { data: bracketRow, error: bErr } = await supabaseAdmin
      .from('long_brackets')
      .upsert({ tournament_id: selectedId, current_round: 1 }, { onConflict: 'tournament_id' })
      .select('*')
      .maybeSingle();
    if (bErr || !bracketRow) {
      // eslint-disable-next-line no-console
      console.error(bErr);
      notify('Failed to create bracket.', 'error');
      setSaving(false);
      return;
    }

    // Clear any existing matches for safety
    await supabaseAdmin
      .from('long_br_matches')
      .delete()
      .eq('tournament_id', selectedId);

    const round1 = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      round1.push({
        tournament_id: selectedId,
        bracket_id: bracketRow.id,
        round_number: 1,
        match_number: i / 2 + 1,
        team_a_registration_id: a.id,
        team_b_registration_id: b.id,
        winner_registration_id: null,
      });
    }

    const { error: insertErr } = await supabaseAdmin.from('long_br_matches').insert(round1);
    if (insertErr) {
      // eslint-disable-next-line no-console
      console.error(insertErr);
      notify('Failed to save fixtures.', 'error');
      setSaving(false);
      return;
    }

    notify('Round 1 fixtures generated.');
    setSaving(false);
    loadBracket(selectedId);
  };

  const recomputeNextRounds = async (tid, baseMatches) => {
    // Build rounds progressively client-side and then sync to Supabase.
    const rounds = {};
    baseMatches.forEach((m) => {
      if (!rounds[m.round_number]) rounds[m.round_number] = [];
      rounds[m.round_number].push(m);
    });

    const roundNumbers = Object.keys(rounds)
      .map((n) => Number(n))
      .sort((a, b) => a - b);

    const allMatches = [...baseMatches];

    for (let rIndex = 0; rIndex < roundNumbers.length; rIndex += 1) {
      const round = roundNumbers[rIndex];
      const current = rounds[round];
      const winners = current
        .filter((m) => m.winner_registration_id)
        .map((m) => m.winner_registration_id);

      const nextRound = round + 1;
      if (winners.length >= 2) {
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          const a = winners[i];
          const b = winners[i + 1];
          if (!a || !b) break;
          nextMatches.push({
            tournament_id: tid,
            bracket_id: baseMatches[0].bracket_id,
            round_number: nextRound,
            match_number: i / 2 + 1,
            team_a_registration_id: a,
            team_b_registration_id: b,
            winner_registration_id: null,
          });
        }
        rounds[nextRound] = nextMatches;
        roundNumbers.push(nextRound);
        allMatches.push(...nextMatches);
      }
    }

    // Replace matches in Supabase for this tournament
    await supabaseAdmin.from('long_br_matches').delete().eq('tournament_id', tid);
    if (allMatches.length) {
      await supabaseAdmin.from('long_br_matches').insert(allMatches);
    }
  };

  const handleWinnerChange = async (match, winnerId) => {
    if (!winnerId) return;
    setSaving(true);

    // Update this match
    const { error } = await supabaseAdmin
      .from('long_br_matches')
      .update({ winner_registration_id: winnerId })
      .eq('id', match.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to update winner.', 'error');
      setSaving(false);
      return;
    }

    // Reload matches and regenerate downstream rounds
    const { data: matches, error: matchErr } = await supabaseAdmin
      .from('long_br_matches')
      .select('*')
      .eq('tournament_id', selectedId)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });
    if (matchErr) {
      // eslint-disable-next-line no-console
      console.error(matchErr);
      notify('Failed to reload matches.', 'error');
      setSaving(false);
      return;
    }

    await recomputeNextRounds(selectedId, matches || []);
    notify('Winner saved. Later rounds updated.');
    setSaving(false);
    loadBracket(selectedId);
  };

  const roundNumbers = Object.keys(matchesByRound)
    .map((n) => Number(n))
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Bracket manager</h1>
        <p className="text-xs text-slate-400">
          Long tournament bracket generation and winner selection for Clash Squad & Lone Wolf.
        </p>
      </header>

      <section className="card space-y-3 text-xs text-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="label" htmlFor="tournament">
              Tournament
            </label>
            <select
              id="tournament"
              className="input"
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="">Select long CS / LW tournament</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} • {t.mode}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={generateFixtures}
              disabled={!selectedId || saving}
            >
              {saving ? 'Working…' : bracket ? 'Regenerate fixtures' : 'Generate fixtures'}
            </button>
          </div>
        </div>
        <p className="text-11px text-slate-500">
          Fixtures are created from confirmed <code className="mx-1 rounded bg-slate-900 px-1 py-0.5">tournament_registrations</code>
          . Winners advance automatically when you pick them, and later rounds are rebuilt when you change an earlier winner.
        </p>
      </section>

      <section className="space-y-3">
        {loading && <p className="text-11px text-slate-400">Loading bracket…</p>}
        {!loading && !roundNumbers.length && selectedId && (
          <p className="text-11px text-slate-400">No fixtures yet. Generate Round 1 to begin.</p>
        )}
        {!loading && !selectedId && (
          <p className="text-11px text-slate-400">Select a tournament to view or generate its bracket.</p>
        )}
        {!loading &&
          roundNumbers.map((round) => (
            <div key={round} className="card space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-slate-100">Round {round}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {matchesByRound[round].map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <p className="text-11px text-slate-500">Match {m.match_number}</p>
                    <div className="mt-2 space-y-1 text-slate-100">
                      <p>A: #{m.team_a_registration_id}</p>
                      <p>B: #{m.team_b_registration_id}</p>
                    </div>
                    <div className="mt-3">
                      <label className="label" htmlFor={`winner-${m.id}`}>
                        Winner registration ID
                      </label>
                      <input
                        id={`winner-${m.id}`}
                        className="input text-11px"
                        placeholder="Paste winner registration id"
                        defaultValue={m.winner_registration_id || ''}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== String(m.winner_registration_id || '')) {
                            handleWinnerChange(m, Number(value));
                          }
                        }}
                      />
                      <p className="mt-1 text-11px text-slate-500">
                        Use the registration IDs from the <code className="mx-1 rounded bg-slate-900 px-1 py-0.5">tournament_registrations</code>
                        {' '}table.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
