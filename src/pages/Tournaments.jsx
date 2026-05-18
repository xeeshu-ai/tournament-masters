import React from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import {
  BR_SLOT_OPTIONS,
  TDM_ROUNDS,
  TOURNAMENT_TYPES,
  getMapsForGame,
  getModesForGame,
} from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

const BR_TEAM_SIZES = [
  { value: 1, label: 'Solo (1 player)' },
  { value: 2, label: 'Duo (2 players)' },
  { value: 4, label: 'Squad (4 players)' },
];

const BR_PLAYERS_PER_MATCH = [20, 32, 48];
const CS_ROUNDS = [5, 7, 11, 13];
const LW_ROUNDS = [9, 11, 13];

function calcMaxSlots(playersPerMatch, teamSize) {
  const p = Number(playersPerMatch);
  const t = Number(teamSize);
  if (!p || !t) return '';
  return Math.floor(p / t);
}

const emptyForm = {
  id: null,
  title: '',
  type: 'single',
  mode: 'br',
  format_label: '',
  map: '',
  skills_on: false,
  limited_ammo: false,
  lw_format: '',
  entry_fee: '',
  max_slots: '',
  prize_text: '',
  points_table: '',
  entry_closing_time: '',
  match_start_time: '',
  youtube_live_url: '',
  registration_status: 'open',
  team_size: 1,
  players_per_match: '',
  total_rounds: '',
};

function TournamentForm({ open, onClose, initial, onSaved, gameId }) {
  const MAPS = getMapsForGame(gameId);
  const MODES = getModesForGame(gameId);

  const [form, setForm] = React.useState(initial || emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setForm(initial || emptyForm);
    setError('');
  }, [initial, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: type === 'checkbox' ? checked : value };

      if (updated.mode === 'br' && (name === 'team_size' || name === 'players_per_match')) {
        updated.max_slots = calcMaxSlots(
          name === 'players_per_match' ? value : f.players_per_match,
          name === 'team_size' ? value : f.team_size
        );
      }

      if (updated.mode === 'br' && name === 'team_size') {
        const size = Number(value);
        updated.format_label = size === 1 ? 'Solo' : size === 2 ? 'Duo' : 'Squad';
      }

      if (name === 'mode') {
        if (value === 'cs') {
          updated.format_label = '4v4';
          updated.max_slots = 2;
          updated.team_size = 4;
        } else if (value === 'lw') {
          updated.max_slots = 2;
        } else if (value === 'tdm') {
          updated.format_label = '4v4';
          updated.max_slots = 2;
          updated.team_size = 4;
        } else if (value === 'br') {
          updated.max_slots = calcMaxSlots(updated.players_per_match, updated.team_size);
        }
      }

      if (updated.mode === 'lw' && name === 'team_size') {
        const size = Number(value);
        updated.format_label = size === 1 ? '1v1' : '2v2';
        updated.lw_format = size === 1 ? '1v1' : '2v2';
        updated.max_slots = 2;
      }

      return updated;
    });
  };

  const validate = () => {
    if (!form.entry_closing_time || !form.match_start_time) {
      return 'Both entry closing time and match start time are required.';
    }
    const closing = new Date(form.entry_closing_time);
    const start = new Date(form.match_start_time);
    if (closing >= start) return 'Entry closing time must be before match start time.';
    if (form.mode === 'br') {
      if (!form.players_per_match) return 'Select players per match for BR.';
      if (!form.team_size) return 'Select team size for BR.';
      const maxSlots = Number(form.max_slots || 0);
      const teamKey = Number(form.team_size) === 1 ? 'solo' : Number(form.team_size) === 2 ? 'duo' : 'squad';
      if (!BR_SLOT_OPTIONS[teamKey].includes(maxSlots)) {
        return `BR ${teamKey} max slots must be ${BR_SLOT_OPTIONS[teamKey].join(', ')}.`;
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError('');

    const isBR = form.mode === 'br';
    const isCS = form.mode === 'cs';
    const isLW = form.mode === 'lw';
    const isTDM = form.mode === 'tdm';

    const payload = {
      title: form.title,
      type: form.type,
      mode: form.mode,
      format_label: form.format_label,
      map: isBR ? form.map : null,
      skills_on: (isCS || isLW) ? form.skills_on : false,
      limited_ammo: (isCS || isLW) ? form.limited_ammo : false,
      lw_format: isLW ? form.lw_format : null,
      entry_fee: Number(form.entry_fee) || 0,
      max_slots: Number(form.max_slots) || 0,
      prize_text: form.prize_text,
      points_table: form.points_table,
      entry_closing_time: form.entry_closing_time || null,
      start_time: form.match_start_time || null,
      youtube_live_url: form.youtube_live_url || null,
      registration_status: form.registration_status,
      is_archived: false,
      team_size: Number(form.team_size) || 1,
      players_per_match: isBR ? (Number(form.players_per_match) || null) : null,
      total_rounds: (isCS || isLW || isTDM) ? (Number(form.total_rounds) || null) : null,
    };

    let result;
    if (form.id) {
      result = await supabaseAdmin.from('tournaments').update(payload).eq('id', form.id).select().single();
    } else {
      result = await supabaseAdmin.from('tournaments').insert({ ...payload, game_id: gameId }).select().single();
    }

    if (result.error) {
      console.error(result.error);
      setError('Failed to save tournament.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  const isBR = form.mode === 'br';
  const isCS = form.mode === 'cs';
  const isLW = form.mode === 'lw';
  const isTDM = form.mode === 'tdm';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto text-xs text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              {form.id ? 'Edit tournament' : 'Create tournament'}
            </h2>
            <p className="text-11px text-slate-500">Configure mode, slots, and timings.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="input" value={form.title} onChange={handleChange} required />
          </div>

          {/* Type */}
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" className="input" value={form.type} onChange={handleChange}>
              {TOURNAMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Mode — game-aware */}
          <div>
            <label className="label" htmlFor="mode">Mode</label>
            <select id="mode" name="mode" className="input" value={form.mode} onChange={handleChange}>
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* BR: Team size + Players per match */}
          {isBR && (
            <>
              <div>
                <label className="label" htmlFor="team_size">Team size</label>
                <select id="team_size" name="team_size" className="input" value={form.team_size} onChange={handleChange}>
                  {BR_TEAM_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="players_per_match">Players per match</label>
                <select id="players_per_match" name="players_per_match" className="input" value={form.players_per_match} onChange={handleChange}>
                  <option value="">Select</option>
                  {BR_PLAYERS_PER_MATCH.map((n) => <option key={n} value={n}>{n} players</option>)}
                </select>
              </div>
            </>
          )}

          {/* CS rounds */}
          {isCS && (
            <div>
              <label className="label" htmlFor="total_rounds">Total rounds</label>
              <select id="total_rounds" name="total_rounds" className="input" value={form.total_rounds} onChange={handleChange}>
                <option value="">Select</option>
                {CS_ROUNDS.map((r) => <option key={r} value={r}>{r} rounds</option>)}
              </select>
            </div>
          )}

          {/* LW: Team size + rounds */}
          {isLW && (
            <>
              <div>
                <label className="label" htmlFor="team_size">Team size</label>
                <select id="team_size" name="team_size" className="input" value={form.team_size} onChange={handleChange}>
                  <option value={1}>Solo (1v1)</option>
                  <option value={2}>Duo (2v2)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="total_rounds">Total rounds</label>
                <select id="total_rounds" name="total_rounds" className="input" value={form.total_rounds} onChange={handleChange}>
                  <option value="">Select</option>
                  {LW_ROUNDS.map((r) => <option key={r} value={r}>{r} rounds</option>)}
                </select>
              </div>
            </>
          )}

          {/* TDM (BGMI): fixed 4v4, rounds */}
          {isTDM && (
            <>
              <div>
                <label className="label">Team size</label>
                <input className="input" value="4v4 (fixed)" disabled />
              </div>
              <div>
                <label className="label" htmlFor="total_rounds">Total rounds</label>
                <select id="total_rounds" name="total_rounds" className="input" value={form.total_rounds} onChange={handleChange}>
                  <option value="">Select</option>
                  {TDM_ROUNDS.map((r) => <option key={r} value={r}>{r} rounds</option>)}
                </select>
              </div>
            </>
          )}

          {/* Format label */}
          <div>
            <label className="label" htmlFor="format_label">Format label</label>
            <input
              id="format_label"
              name="format_label"
              className="input"
              placeholder={isBR ? 'Auto-filled from team size' : isCS || isTDM ? '4v4' : '1v1 / 2v2'}
              value={form.format_label}
              onChange={handleChange}
              required
            />
          </div>

          {/* BR: Map — game-aware */}
          {isBR && (
            <div>
              <label className="label" htmlFor="map">Map</label>
              <select id="map" name="map" className="input" value={form.map} onChange={handleChange}>
                <option value="">Select map</option>
                {MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* CS/LW: Skills + Ammo */}
          {(isCS || isLW) && (
            <div className="flex items-center gap-4 pt-5">
              <label className="inline-flex items-center gap-2 text-11px text-slate-200">
                <input type="checkbox" name="skills_on" checked={form.skills_on} onChange={handleChange}
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500" />
                Skills on
              </label>
              <label className="inline-flex items-center gap-2 text-11px text-slate-200">
                <input type="checkbox" name="limited_ammo" checked={form.limited_ammo} onChange={handleChange}
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500" />
                Limited ammo
              </label>
            </div>
          )}

          {/* Entry fee */}
          <div>
            <label className="label" htmlFor="entry_fee">Entry fee</label>
            <input id="entry_fee" name="entry_fee" type="number" className="input" value={form.entry_fee} onChange={handleChange} />
          </div>

          {/* Max slots */}
          <div>
            <label className="label" htmlFor="max_slots">
              Max slots{isBR ? ' (auto-calculated)' : ' (locked to 2)'}
            </label>
            <input
              id="max_slots" name="max_slots" type="number" className="input"
              value={form.max_slots} onChange={handleChange}
              readOnly={isCS || isLW || isTDM}
            />
          </div>

          {/* Prize */}
          <div className="md:col-span-2">
            <label className="label" htmlFor="prize_text">Prize distribution (free text)</label>
            <textarea id="prize_text" name="prize_text" rows={3} className="input resize-none" value={form.prize_text} onChange={handleChange} />
          </div>

          {/* Points table */}
          <div className="md:col-span-2">
            <label className="label" htmlFor="points_table">Points table (free text)</label>
            <textarea id="points_table" name="points_table" rows={3} className="input resize-none" value={form.points_table} onChange={handleChange} />
          </div>

          {/* Times */}
          <div>
            <label className="label" htmlFor="entry_closing_time">Entry closing time</label>
            <input id="entry_closing_time" name="entry_closing_time" type="datetime-local" className="input" value={form.entry_closing_time} onChange={handleChange} required />
          </div>
          <div>
            <label className="label" htmlFor="match_start_time">Match start time</label>
            <input id="match_start_time" name="match_start_time" type="datetime-local" className="input" value={form.match_start_time} onChange={handleChange} required />
          </div>

          {/* YouTube */}
          <div className="md:col-span-2">
            <label className="label" htmlFor="youtube_live_url">YouTube live URL</label>
            <input id="youtube_live_url" name="youtube_live_url" className="input" value={form.youtube_live_url} onChange={handleChange} />
          </div>

          {/* Registration status */}
          <div>
            <label className="label" htmlFor="registration_status">Registration status</label>
            <select id="registration_status" name="registration_status" className="input" value={form.registration_status} onChange={handleChange}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {error && <div className="md:col-span-2 text-11px text-red-400">{error}</div>}

          <div className="md:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TournamentsPage() {
  const { gameId } = useParams();
  const [tournaments, setTournaments] = React.useState([]);
  const [archived, setArchived] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false });
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('game_id', gameId)
      .order('start_time', { ascending: true });
    if (error) { console.error(error); setLoading(false); return; }
    setTournaments((data || []).filter((t) => !t.is_archived));
    setArchived((data || []).filter((t) => t.is_archived));
    setLoading(false);
  };

  React.useEffect(() => { load(); }, [gameId]);

  const labelForType = (id) => TOURNAMENT_TYPES.find((x) => x.id === id)?.label || id;

  const formatBadge = (t) => {
    if (t.mode === 'br') {
      const size = Number(t.team_size) === 1 ? 'Solo' : Number(t.team_size) === 2 ? 'Duo' : 'Squad';
      return t.players_per_match ? `${size} · ${t.players_per_match}p` : size;
    }
    if (t.mode === 'cs') return t.total_rounds ? `CS · ${t.total_rounds}R` : 'CS';
    if (t.mode === 'lw') {
      const size = Number(t.team_size) === 1 ? '1v1' : '2v2';
      return t.total_rounds ? `LW ${size} · ${t.total_rounds}R` : `LW ${size}`;
    }
    if (t.mode === 'tdm') return t.total_rounds ? `TDM · ${t.total_rounds}R` : 'TDM';
    return t.format_label || t.mode;
  };

  const handleArchiveConfirmed = async () => {
    const { id } = confirmArchive;
    const { error } = await supabaseAdmin.from('tournaments').update({ is_archived: true }).eq('id', id);
    if (error) { notify('Failed to archive tournament.', 'error'); return; }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
    load();
  };

  const handleDeleteConfirmed = async () => {
    const { id } = confirmDelete;
    const { error } = await supabaseAdmin.from('tournaments').delete().eq('id', id);
    if (error) { notify('Failed to delete tournament.', 'error'); return; }
    notify('Tournament deleted permanently.');
    setConfirmDelete({ open: false });
    load();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Tournaments</h1>
          <p className="text-xs text-slate-400">
            Create, manage, and archive tournaments across all supported modes.
          </p>
        </div>
        <button type="button" className="btn-primary text-xs"
          onClick={() => { setEditing(null); setFormOpen(true); }}>
          New tournament
        </button>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-100">Active tournaments</h2>
        <div className="card overflow-x-auto">
          {loading ? (
            <p className="text-xs text-slate-400">Loading tournaments…</p>
          ) : tournaments.length === 0 ? (
            <p className="text-xs text-slate-400">No active tournaments. Create one to get started.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th><th>Type</th><th>Mode</th><th>Format</th>
                  <th>Entry</th><th>Slots</th><th>Reg</th><th>Start</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td><span className="badge">{labelForType(t.type)}</span></td>
                    <td>{t.mode?.toUpperCase()}</td>
                    <td><span className="badge">{formatBadge(t)}</span></td>
                    <td>{t.entry_fee}</td>
                    <td>{t.filled_slots || 0}/{t.max_slots}</td>
                    <td>
                      <span className={'status-pill ' + (t.registration_status === 'open' ? 'pending' : 'approved')}>
                        {t.registration_status}
                      </span>
                    </td>
                    <td>{t.start_time ? new Date(t.start_time).toLocaleString() : '—'}</td>
                    <td className="space-x-2 text-right">
                      <button type="button" className="btn-secondary text-[11px]"
                        onClick={() => { setEditing(t); setFormOpen(true); }}>Edit</button>
                      <button type="button" className="btn-secondary text-[11px]"
                        onClick={() => setConfirmArchive({ open: true, id: t.id })}>Archive</button>
                      <button type="button"
                        className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
                        onClick={() => setConfirmDelete({ open: true, id: t.id, title: t.title })}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Archived tournaments ({archived.length})
          </summary>
          <div className="card overflow-x-auto">
            {archived.length === 0 ? (
              <p className="text-xs text-slate-400">No archived tournaments yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Mode</th><th>Format</th><th>Start</th><th></th></tr>
                </thead>
                <tbody>
                  {archived.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{labelForType(t.type)}</td>
                      <td>{t.mode?.toUpperCase()}</td>
                      <td>{formatBadge(t)}</td>
                      <td>{t.start_time ? new Date(t.start_time).toLocaleString() : '—'}</td>
                      <td className="text-right">
                        <button type="button"
                          className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors"
                          onClick={() => setConfirmDelete({ open: true, id: t.id, title: t.title })}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </section>

      <TournamentForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSaved={load} gameId={gameId} />
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
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
        description="This will permanently delete the tournament and all its registrations. This action cannot be undone."
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete({ open: false })}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
