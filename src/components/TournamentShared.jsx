import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import {
  TDM_ROUNDS,
  BGMI_TDM_KILL_TARGET,
  getMapsForGame,
  getModesForGame,
} from '../constants';

const BR_TEAM_SIZES = [
  { value: 1, label: 'Solo (1 player)' },
  { value: 2, label: 'Duo (2 players)' },
  { value: 4, label: 'Squad (4 players)' },
];

// BGMI BR is always 100 players per match
const BGMI_BR_PLAYERS = 100;

const FF_BR_PLAYERS_PER_MATCH = [20, 32, 48];
const CS_ROUNDS = [5, 7, 11, 13];
const LW_ROUNDS = [9, 11, 13];

// BR slot options per game+teamSize
const BR_MAX_SLOTS = {
  bgmi: { 1: 100, 2: 50, 4: 25 },
  free_fire: {},  // dynamic: players_per_match / team_size
};

export function calcMaxSlots(playersPerMatch, teamSize) {
  const p = Number(playersPerMatch);
  const t = Number(teamSize);
  if (!p || !t) return '';
  return Math.floor(p / t);
}

export const emptyForm = {
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

function getBgmiBrSlots(teamSize) {
  return BR_MAX_SLOTS.bgmi[Number(teamSize)] || '';
}

// ── Tournament Form Modal ─────────────────────────────────────────────────────
export function TournamentForm({ open, onClose, initial, onSaved, gameId }) {
  const isBgmi = gameId === 'bgmi';
  const MODES = getModesForGame(gameId);

  const [form, setForm] = React.useState(initial || emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setForm(initial || emptyForm);
    setError('');
  }, [initial, open]);

  const MAPS = getMapsForGame(gameId, form.mode);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: type === 'checkbox' ? checked : value };

      // When mode changes, reset map
      if (name === 'mode') {
        updated.map = '';
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
          // BGMI TDM kill target is always 40 — auto-fill
          if (isBgmi) updated.total_rounds = BGMI_TDM_KILL_TARGET;
        } else if (value === 'br') {
          if (isBgmi) {
            updated.players_per_match = BGMI_BR_PLAYERS;
            updated.max_slots = getBgmiBrSlots(updated.team_size);
          } else {
            updated.max_slots = calcMaxSlots(updated.players_per_match, updated.team_size);
          }
        }
      }

      // BR team size change
      if (updated.mode === 'br' && name === 'team_size') {
        const size = Number(value);
        updated.format_label = size === 1 ? 'Solo' : size === 2 ? 'Duo' : 'Squad';
        if (isBgmi) {
          updated.players_per_match = BGMI_BR_PLAYERS;
          updated.max_slots = getBgmiBrSlots(size);
        } else {
          updated.max_slots = calcMaxSlots(f.players_per_match, value);
        }
      }

      // FF BR players_per_match change
      if (updated.mode === 'br' && name === 'players_per_match' && !isBgmi) {
        updated.max_slots = calcMaxSlots(value, f.team_size);
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
    if (!form.entry_closing_time || !form.match_start_time)
      return 'Both entry closing time and match start time are required.';
    const closing = new Date(form.entry_closing_time);
    const start = new Date(form.match_start_time);
    if (closing >= start) return 'Entry closing time must be before match start time.';
    if (form.mode === 'br') {
      if (!form.team_size) return 'Select team size for BR.';
      const slots = Number(form.max_slots || 0);
      if (!slots) return 'Max slots could not be calculated. Check team size.';
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
    const ppm = isBR
      ? isBgmi
        ? BGMI_BR_PLAYERS
        : Number(form.players_per_match) || null
      : null;
    const payload = {
      title: form.title,
      type: form.type,
      mode: form.mode,
      format_label: form.format_label,
      map: (isBR || isTDM) ? form.map || null : null,
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
      players_per_match: ppm,
      // For BGMI TDM: total_rounds stores the kill target (40). For CS/LW: stores actual rounds.
      total_rounds: isCS || isLW || isTDM ? Number(form.total_rounds) || null : null,
    };
    let result;
    if (form.id) {
      result = await supabaseAdmin.from('tournaments').update(payload).eq('id', form.id).select().single();
    } else {
      result = await supabaseAdmin.from('tournaments').insert({ ...payload, game_id: gameId }).select().single();
    }
    if (result.error) {
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
      {/* Modal container — fixed height, internal scroll */}
      <div className="card w-full max-w-2xl flex flex-col text-xs text-slate-300"
           style={{ maxHeight: 'min(90vh, 760px)' }}>

        {/* ── Sticky Header ── */}
        <div className="flex items-center justify-between flex-shrink-0 pb-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">
            {form.id ? 'Edit Tournament' : 'New Tournament'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-3 py-3 pr-1">

            {/* Title */}
            <div>
              <label className="label">Title</label>
              <input name="title" className="input" value={form.title} onChange={handleChange} required />
            </div>

            {/* Type + Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select name="type" className="input" value={form.type} onChange={handleChange}>
                  <option value="single">Single match</option>
                  <option value="long">Long tournament</option>
                </select>
              </div>
              <div>
                <label className="label">Mode</label>
                <select name="mode" className="input" value={form.mode} onChange={handleChange}>
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* BR-specific */}
            {isBR && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Team size</label>
                    <select name="team_size" className="input" value={form.team_size} onChange={handleChange}>
                      {BR_TEAM_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Max slots (auto)</label>
                    <input
                      name="max_slots"
                      type="number"
                      className="input bg-slate-800/50 cursor-not-allowed"
                      value={form.max_slots}
                      readOnly
                      tabIndex={-1}
                    />
                  </div>
                </div>
                {isBgmi && (
                  <p className="text-[11px] text-slate-500 -mt-1">
                    BGMI BR: 100 players per match · Solo=100 slots · Duo=50 · Squad=25
                  </p>
                )}
                {!isBgmi && (
                  <div>
                    <label className="label">Players per match</label>
                    <select name="players_per_match" className="input" value={form.players_per_match} onChange={handleChange}>
                      <option value="">Select…</option>
                      {FF_BR_PLAYERS_PER_MATCH.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Map</label>
                  <select name="map" className="input" value={form.map} onChange={handleChange}>
                    <option value="">Select map…</option>
                    {MAPS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* TDM specific */}
            {isTDM && (
              <div className="grid grid-cols-2 gap-3">
                {/* BGMI TDM: fixed kill target = 40; FF TDM (future): rounds dropdown */}
                {isBgmi ? (
                  <div>
                    <label className="label">Kill target (fixed)</label>
                    <input
                      name="total_rounds"
                      type="number"
                      className="input bg-slate-800/50 cursor-not-allowed"
                      value={BGMI_TDM_KILL_TARGET}
                      readOnly
                      tabIndex={-1}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">BGMI TDM: first team to 40 kills wins</p>
                  </div>
                ) : (
                  <div>
                    <label className="label">Total rounds</label>
                    <select name="total_rounds" className="input" value={form.total_rounds} onChange={handleChange}>
                      <option value="">Select…</option>
                      {TDM_ROUNDS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Map</label>
                  <select name="map" className="input" value={form.map} onChange={handleChange}>
                    <option value="">Select map…</option>
                    {MAPS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* CS/LW specific */}
            {(isCS || isLW) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Total rounds</label>
                  <select name="total_rounds" className="input" value={form.total_rounds} onChange={handleChange}>
                    <option value="">Select…</option>
                    {(isCS ? CS_ROUNDS : LW_ROUNDS).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="skills_on" checked={form.skills_on} onChange={handleChange} className="rounded" />
                    Skills on
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="limited_ammo" checked={form.limited_ammo} onChange={handleChange} className="rounded" />
                    Limited ammo
                  </label>
                </div>
              </div>
            )}

            {/* LW team size */}
            {isLW && (
              <div>
                <label className="label">LW format</label>
                <select name="team_size" className="input" value={form.team_size} onChange={handleChange}>
                  <option value={1}>1v1</option>
                  <option value={2}>2v2</option>
                </select>
              </div>
            )}

            {/* Slots + Fee */}
            <div className="grid grid-cols-2 gap-3">
              {!isBR && (
                <div>
                  <label className="label">Max slots</label>
                  <input
                    name="max_slots"
                    type="number"
                    className="input"
                    value={form.max_slots}
                    onChange={handleChange}
                  />
                </div>
              )}
              <div className={!isBR ? '' : 'col-span-2'}>
                <label className="label">Entry fee (₹)</label>
                <input name="entry_fee" type="number" className="input" value={form.entry_fee} onChange={handleChange} min={0} />
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Entry closing time</label>
                <input name="entry_closing_time" type="datetime-local" className="input" value={form.entry_closing_time} onChange={handleChange} />
              </div>
              <div>
                <label className="label">Match start time</label>
                <input name="match_start_time" type="datetime-local" className="input" value={form.match_start_time} onChange={handleChange} />
              </div>
            </div>

            {/* Registration status */}
            <div>
              <label className="label">Registration status</label>
              <select name="registration_status" className="input" value={form.registration_status} onChange={handleChange}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="full">Full</option>
              </select>
            </div>

            {/* YouTube */}
            <div>
              <label className="label">YouTube live URL (optional)</label>
              <input name="youtube_live_url" type="url" className="input" value={form.youtube_live_url} onChange={handleChange} placeholder="https://youtu.be/…" />
            </div>

            {/* Prize text */}
            <div>
              <label className="label">Prize / distribution text</label>
              <textarea name="prize_text" rows={2} className="input resize-none" value={form.prize_text} onChange={handleChange} />
            </div>

            {/* Points table */}
            <div>
              <label className="label">Points table (optional)</label>
              <textarea name="points_table" rows={2} className="input resize-none" value={form.points_table} onChange={handleChange} />
            </div>

          </div>{/* end scroll area */}

          {/* ── Sticky Footer ── */}
          <div className="flex-shrink-0 pt-3 border-t border-slate-700 space-y-2">
            {error && <p className="rounded bg-red-500/10 px-3 py-2 text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create tournament'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
