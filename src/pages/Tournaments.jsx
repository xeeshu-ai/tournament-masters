import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import {
  BR_SLOT_OPTIONS,
  TDM_ROUNDS,
  BGMI_TDM_KILL_TARGET,
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

// BGMI BR: max_slots is fixed per team size — no players_per_match dropdown needed
// Solo=100 slots, Duo=50 slots, Squad=25 slots
function getBgmiBrMaxSlots(teamSize) {
  const t = Number(teamSize);
  if (t === 1) return 100;
  if (t === 2) return 50;
  if (t >= 4) return 25;
  return '';
}

// Free Fire BR: players_per_match is selectable
function getFfBrPlayersPerMatchOptions() {
  return [20, 32, 48];
}

function calcMaxSlots(playersPerMatch, teamSize) {
  const p = Number(playersPerMatch);
  const t = Number(teamSize);
  if (!p || !t) return '';
  return Math.floor(p / t);
}

const CS_ROUNDS = [5, 7, 11, 13];
const LW_ROUNDS = [9, 11, 13];

const emptyForm = {
  id: null,
  title: '',
  type: 'single',
  mode: 'br',
  format_label: '',
  map: '',
  tdm_map: '',
  kill_target: '',
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
  const TDM_MAPS = getMapsForGame(gameId, 'tdm');
  const MODES = getModesForGame(gameId);
  const isBgmi = gameId === 'bgmi';

  const [form, setForm] = React.useState(initial || emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setForm(initial || emptyForm);
    setError('');
  }, [initial, open]);

  // Auto-fill TDM defaults when mode switches to TDM
  React.useEffect(() => {
    if (form.mode === 'tdm' && isBgmi) {
      setForm((f) => ({
        ...f,
        tdm_map: f.tdm_map || 'Warehouse',
        kill_target: f.kill_target || BGMI_TDM_KILL_TARGET,
        format_label: '4v4',
        max_slots: 2,
        team_size: 4,
      }));
    }
  }, [form.mode, isBgmi]);

  // BGMI BR: auto-set max_slots whenever team_size changes
  React.useEffect(() => {
    if (form.mode === 'br' && isBgmi) {
      const slots = getBgmiBrMaxSlots(form.team_size);
      if (slots && String(slots) !== String(form.max_slots)) {
        setForm((f) => ({ ...f, max_slots: slots }));
      }
    }
  }, [form.team_size, form.mode, isBgmi]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: type === 'checkbox' ? checked : value };

      // Free Fire BR: calculate max_slots from players_per_match + team_size
      if (!isBgmi && updated.mode === 'br' && (name === 'team_size' || name === 'players_per_match')) {
        updated.max_slots = calcMaxSlots(
          name === 'players_per_match' ? value : f.players_per_match,
          name === 'team_size' ? value : f.team_size,
        );
      }

      // BGMI BR: auto-set max_slots from team_size
      if (isBgmi && updated.mode === 'br' && name === 'team_size') {
        updated.max_slots = getBgmiBrMaxSlots(value);
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
          if (isBgmi) {
            updated.tdm_map = updated.tdm_map || 'Warehouse';
            updated.kill_target = updated.kill_target || BGMI_TDM_KILL_TARGET;
          }
        } else if (value === 'br') {
          updated.tdm_map = '';
          updated.kill_target = '';
          if (isBgmi) {
            updated.max_slots = getBgmiBrMaxSlots(updated.team_size);
          } else {
            updated.max_slots = calcMaxSlots(updated.players_per_match, updated.team_size);
          }
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
      if (!form.team_size) return 'Select team size for BR.';
      if (!isBgmi && !form.players_per_match) return 'Select players per match for BR.';
      const maxSlots = Number(form.max_slots || 0);
      const baseKey =
        Number(form.team_size) === 1 ? 'solo' :
        Number(form.team_size) === 2 ? 'duo'  : 'squad';
      const specificKey =
        isBgmi ? `bgmi_${baseKey}` :
        gameId === 'free_fire' ? `ff_${baseKey}` :
        baseKey;
      const allowed = BR_SLOT_OPTIONS[specificKey] ?? BR_SLOT_OPTIONS[baseKey] ?? [];
      if (!allowed.includes(maxSlots)) {
        return `BR ${baseKey} max slots must be ${allowed.join(', ')}.`;
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

    const isBR  = form.mode === 'br';
    const isCS  = form.mode === 'cs';
    const isLW  = form.mode === 'lw';
    const isTDM = form.mode === 'tdm';

    const payload = {
      title: form.title,
      type: form.type,
      mode: form.mode,
      format_label: form.format_label,
      map: isBR ? form.map : null,
      tdm_map: isTDM ? (form.tdm_map || 'Warehouse') : null,
      kill_target: isTDM ? (Number(form.kill_target) || BGMI_TDM_KILL_TARGET) : null,
      skills_on: isCS || isLW ? form.skills_on : false,
      limited_ammo: isCS || isLW ? form.limited_ammo : false,
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
      // players_per_match: only stored for Free Fire BR
      players_per_match: (isBR && !isBgmi) ? Number(form.players_per_match) || null : null,
      total_rounds: isCS || isLW || isTDM ? Number(form.total_rounds) || null : null,
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

  const isBR  = form.mode === 'br';
  const isCS  = form.mode === 'cs';
  const isLW  = form.mode === 'lw';
  const isTDM = form.mode === 'tdm';
  const isLong = form.type === 'long';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="card maxh-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto text-xs text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                {form.id ? 'Edit tournament' : 'Create tournament'}
              </h2>
              <span
                className={
                  'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                  (isLong
                    ? 'bg-violet-900/60 text-violet-300 border border-violet-700/50'
                    : 'bg-sky-900/60 text-sky-300 border border-sky-700/50')
                }
              >
                {isLong ? 'Long tournament' : 'Single match'}
              </span>
            </div>
            <p className="text-11px text-slate-500">Configure mode, slots, and timings.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="input" value={form.title} onChange={handleChange} required />
          </div>

          <input type="hidden" name="type" value={form.type} />

          {/* Mode */}
          <div>
            <label className="label" htmlFor="mode">Mode</label>
            <select id="mode" name="mode" className="input" value={form.mode} onChange={handleChange}>
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* BR: Team size */}
          {isBR && (
            <div>
              <label className="label" htmlFor="team_size">Team size</label>
              <select id="team_size" name="team_size" className="input" value={form.team_size} onChange={handleChange}>
                {BR_TEAM_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* BR: Players per match — Free Fire only */}
          {isBR && !isBgmi && (
            <div>
              <label className="label" htmlFor="players_per_match">Players per match</label>
              <select id="players_per_match" name="players_per_match" className="input" value={form.players_per_match} onChange={handleChange}>
                <option value="">Select</option>
                {getFfBrPlayersPerMatchOptions().map((n) => (
                  <option key={n} value={n}>{n} players</option>
                ))}
              </select>
            </div>
          )}

          {/* BR: BGMI auto-slots info pill */}
          {isBR && isBgmi && (
            <div className="flex items-center gap-2 rounded-lg bg-sky-900/20 border border-sky-800/40 px-3 py-2 text-[11px] text-sky-300">
              <span>🎯</span>
              <span>
                BGMI BR slots are fixed:&nbsp;
                <strong>Solo = 100</strong>,&nbsp;
                <strong>Duo = 50</strong>,&nbsp;
                <strong>Squad = 25</strong>
              </span>
            </div>
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

          {/* TDM: fixed 4v4, map, kill target — NO rounds for BGMI TDM */}
          {isTDM && (
            <>
              <div>
                <label className="label">Team size</label>
                <input className="input" value="4v4 (fixed)" disabled />
              </div>
              <div>
                <label className="label">Slots</label>
                <input className="input" value="2 (fixed)" disabled />
              </div>
              <div>
                <label className="label" htmlFor="tdm_map">Map</label>
                <select id="tdm_map" name="tdm_map" className="input" value={form.tdm_map} onChange={handleChange}>
                  {TDM_MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="kill_target">Kill target (first to X kills wins)</label>
                <input
                  id="kill_target"
                  name="kill_target"
                  type="number"
                  className="input"
                  value={form.kill_target}
                  onChange={handleChange}
                />
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

          {/* BR: Map */}
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
                <input type="checkbox" name="skills_on" checked={form.skills_on} onChange={handleChange} className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500" />
                Skills on
              </label>
              <label className="inline-flex items-center gap-2 text-11px text-slate-200">
                <input type="checkbox" name="limited_ammo" checked={form.limited_ammo} onChange={handleChange} className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500" />
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
              Max slots
              {isBR && isBgmi ? ' (auto from team size)' : isBR ? ' (auto-calculated)' : ' (locked to 2)'}
            </label>
            <input
              id="max_slots"
              name="max_slots"
              type="number"
              className="input"
              value={form.max_slots}
              onChange={handleChange}
              readOnly={isCS || isLW || isTDM || (isBR && isBgmi)}
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

// ── Single-match tournament row ──────────────────────────────────────────────
function SingleTournamentRow({ t, gameId, onEdit, onArchive, onDelete, navigate }) {
  const formatBadge = () => {
    if (t.mode === 'br') {
      const size = Number(t.team_size) === 1 ? 'Solo' : Number(t.team_size) === 2 ? 'Duo' : 'Squad';
      return t.players_per_match ? `${size} · ${t.players_per_match}p` : size;
    }
    if (t.mode === 'cs') return t.total_rounds ? `CS · ${t.total_rounds}R` : 'CS';
    if (t.mode === 'lw') {
      const size = Number(t.team_size) === 1 ? '1v1' : '2v2';
      return t.total_rounds ? `LW ${size} · ${t.total_rounds}R` : `LW ${size}`;
    }
    if (t.mode === 'tdm') {
      const mapLabel = t.tdm_map ? ` · ${t.tdm_map}` : '';
      const killLabel = t.kill_target ? ` · First to ${t.kill_target}` : '';
      return `4v4${mapLabel}${killLabel}`;
    }
    return t.format_label || t.mode;
  };

  return (
    <tr>
      <td>{t.title}</td>
      <td>{t.mode?.toUpperCase()}</td>
      <td><span className="badge">{formatBadge()}</span></td>
      <td>{t.entry_fee ? `₹${Number(t.entry_fee).toLocaleString('en-IN')}` : 'Free'}</td>
      <td>{t.filled_slots || 0}/{t.max_slots}</td>
      <td>
        <span className={'status-pill ' + (t.registration_status === 'open' ? 'pending' : 'approved')}>
          {t.registration_status}
        </span>
      </td>
      <td>{t.start_time ? new Date(t.start_time).toLocaleString('en-IN') : '—'}</td>
      <td className="space-x-1.5 text-right whitespace-nowrap">
        <button type="button" className="btn-secondary text-[11px]" onClick={() => navigate(`/${gameId}/tournaments/${t.id}`)}>Open</button>
        <button type="button" className="btn-secondary text-[11px]" onClick={() => onEdit(t)}>Edit</button>
        <button type="button" className="btn-secondary text-[11px]" onClick={() => onArchive(t)}>Archive</button>
        <button type="button" className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors" onClick={() => onDelete(t)}>Delete</button>
      </td>
    </tr>
  );
}

// ── Long tournament card ──────────────────────────────────────────────────────
function LongTournamentCard({ t, gameId, onEdit, onArchive, onDelete, navigate }) {
  const hasBracket = t.mode === 'cs' || t.mode === 'lw';

  const modeBadge = () => {
    if (t.mode === 'br') {
      const size = Number(t.team_size) === 1 ? 'Solo' : Number(t.team_size) === 2 ? 'Duo' : 'Squad';
      return `BR · ${size}${t.players_per_match ? ` · ${t.players_per_match}p` : ''}`;
    }
    if (t.mode === 'cs') return t.total_rounds ? `CS · ${t.total_rounds}R` : 'CS';
    if (t.mode === 'lw') {
      const size = Number(t.team_size) === 1 ? '1v1' : '2v2';
      return t.total_rounds ? `LW ${size} · ${t.total_rounds}R` : `LW ${size}`;
    }
    if (t.mode === 'tdm') {
      const mapLabel = t.tdm_map ? ` · ${t.tdm_map}` : '';
      const killLabel = t.kill_target ? ` · First to ${t.kill_target}` : '';
      return `TDM 4v4${mapLabel}${killLabel}`;
    }
    return t.format_label || t.mode?.toUpperCase();
  };

  return (
    <div className="rounded-xl border border-violet-800/40 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-50 leading-tight">{t.title}</h3>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="badge bg-violet-900/60 text-violet-300 border border-violet-700/40">{modeBadge()}</span>
            <span className={'status-pill ' + (t.registration_status === 'open' ? 'pending' : 'approved')}>{t.registration_status}</span>
            <span className="badge bg-slate-800 text-slate-300">{t.filled_slots || 0}/{t.max_slots} slots</span>
            {t.entry_fee > 0 && (
              <span className="badge bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">₹{Number(t.entry_fee).toLocaleString('en-IN')}</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 text-right shrink-0">
          {t.start_time ? new Date(t.start_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="btn-primary text-[11px] flex-1 min-w-[100px]" onClick={() => navigate(`/${gameId}/tournaments/${t.id}`)}>Open tournament</button>
        {hasBracket && (
          <button type="button" className="btn-secondary text-[11px] flex-1 min-w-[120px] border-violet-700/50 text-violet-300 hover:bg-violet-900/30" onClick={() => navigate(`/${gameId}/brackets?tournamentId=${t.id}`)}>Bracket manager</button>
        )}
        <button type="button" className="btn-secondary text-[11px]" onClick={() => navigate(`/${gameId}/results?tournamentId=${t.id}`)}>Results</button>
        <button type="button" className="btn-secondary text-[11px]" onClick={() => onEdit(t)}>Edit</button>
        <button type="button" className="btn-secondary text-[11px]" onClick={() => onArchive(t)}>Archive</button>
        <button type="button" className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors" onClick={() => onDelete(t)}>Delete</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TournamentsPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  React.useEffect(() => {
    const editId = searchParams.get('editId');
    if (!editId || !tournaments.length) return;
    const t = tournaments.find((tt) => String(tt.id) === String(editId));
    if (!t) return;
    setEditing(t);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('editId');
    setSearchParams(next, { replace: true });
  }, [searchParams, tournaments, setSearchParams]);

  const openCreate = (type) => { setEditing({ ...emptyForm, type }); setFormOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };
  const openArchive = (t) => setConfirmArchive({ open: true, id: t.id });
  const openDelete = (t) => setConfirmDelete({ open: true, id: t.id, title: t.title });

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

  const singleActive = tournaments.filter((t) => t.type === 'single');
  const longActive = tournaments.filter((t) => t.type === 'long');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-50">Tournaments</h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage single-match and long tournaments separately for this game.</p>
      </header>

      {/* Single-match section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-sky-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Single-match tournaments</h2>
              <p className="text-[11px] text-slate-500">One match per tournament — BR, CS, LW, or TDM format.</p>
            </div>
          </div>
          <button type="button" className="btn-primary text-xs shrink-0" onClick={() => openCreate('single')}>+ New single match</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : singleActive.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500">No single-match tournaments yet.</p>
              <button type="button" className="mt-3 btn-secondary text-xs" onClick={() => openCreate('single')}>Create your first one</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Mode</th><th>Format</th><th>Entry</th><th>Slots</th><th>Reg</th><th>Start</th><th></th></tr>
              </thead>
              <tbody>
                {singleActive.map((t) => (
                  <SingleTournamentRow key={t.id} t={t} gameId={gameId} onEdit={openEdit} onArchive={openArchive} onDelete={openDelete} navigate={navigate} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Long tournaments section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-violet-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Long tournaments</h2>
              <p className="text-[11px] text-slate-500">Multi-match, multi-team events — bracket manager and fixture generation included.</p>
            </div>
          </div>
          <button type="button" className="text-xs rounded-lg px-3 py-1.5 bg-violet-900/40 text-violet-300 border border-violet-700/50 hover:bg-violet-800/40 transition-colors shrink-0" onClick={() => openCreate('long')}>+ New long tournament</button>
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="card"><p className="text-xs text-slate-400">Loading…</p></div>
          ) : longActive.length === 0 ? (
            <div className="card py-8 text-center border-violet-800/30">
              <p className="text-xs text-slate-500">No long tournaments yet.</p>
              <button type="button" className="mt-3 text-xs rounded-lg px-3 py-1.5 bg-violet-900/40 text-violet-300 border border-violet-700/50 hover:bg-violet-800/40 transition-colors" onClick={() => openCreate('long')}>Create your first one</button>
            </div>
          ) : (
            longActive.map((t) => (
              <LongTournamentCard key={t.id} t={t} gameId={gameId} onEdit={openEdit} onArchive={openArchive} onDelete={openDelete} navigate={navigate} />
            ))
          )}
        </div>
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section className="space-y-2">
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors select-none">
              Archived tournaments ({archived.length})
            </summary>
            <div className="mt-2 card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Mode</th><th>Start</th><th></th></tr>
                </thead>
                <tbody>
                  {archived.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>
                        <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + (t.type === 'long' ? 'bg-violet-900/40 text-violet-400' : 'bg-sky-900/40 text-sky-400')}>
                          {t.type === 'long' ? 'Long' : 'Single'}
                        </span>
                      </td>
                      <td>{t.mode?.toUpperCase()}</td>
                      <td>{t.start_time ? new Date(t.start_time).toLocaleString('en-IN') : '—'}</td>
                      <td className="text-right">
                        <button type="button" className="text-[11px] rounded px-2 py-1 bg-red-900/40 text-red-400 hover:bg-red-800/60 transition-colors" onClick={() => openDelete(t)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <TournamentForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSaved={load} gameId={gameId} />
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <ConfirmDialog open={confirmArchive.open} title="Archive tournament?" description="Archived tournaments are hidden from lists but kept in the database." confirmLabel="Archive" onCancel={() => setConfirmArchive({ open: false })} onConfirm={handleArchiveConfirmed} />
      <ConfirmDialog open={confirmDelete.open} title={`Delete "${confirmDelete.title}"?`} description="This will permanently delete the tournament and all its registrations. This action cannot be undone." confirmLabel="Delete permanently" onCancel={() => setConfirmDelete({ open: false })} onConfirm={handleDeleteConfirmed} />
    </div>
  );
}
