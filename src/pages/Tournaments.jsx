import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { BR_SLOT_OPTIONS, FFMAPS, FFMODES, TOURNAMENT_TYPES } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

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
  tournament_password: '',
  registration_status: 'open',
};

function TournamentForm({ open, onClose, initial, onSaved }) {
  const [form, setForm] = React.useState(initial || emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setForm(initial || emptyForm);
    setError('');
  }, [initial, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    if (!/^\d{4}$/.test(form.tournament_password || '')) {
      return 'Tournament password must be exactly 4 digits.';
    }
    if (!form.entry_closing_time || !form.match_start_time) {
      return 'Both entry closing time and match start time are required.';
    }
    const closing = new Date(form.entry_closing_time);
    const start = new Date(form.match_start_time);
    if (closing >= start) {
      return 'Entry closing time must be before match start time.';
    }
    const maxSlots = Number(form.max_slots || 0);
    if (form.mode === 'br') {
      const format = (form.format_label || '').toLowerCase();
      if (format.includes('solo') && !BR_SLOT_OPTIONS.solo.includes(maxSlots)) {
        return 'BR Solo max slots must be 20, 32, or 48.';
      }
      if (format.includes('duo') && !BR_SLOT_OPTIONS.duo.includes(maxSlots)) {
        return 'BR Duo max slots must be 10, 16, or 24.';
      }
      if (format.includes('squad') && !BR_SLOT_OPTIONS.squad.includes(maxSlots)) {
        return 'BR Squad max slots must be 5, 8, or 12.';
      }
    } else {
      if (!maxSlots || maxSlots < 4 || maxSlots % 2 !== 0) {
        return 'CS and LW max slots must be an even number ≥ 4.';
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      type: form.type,
      mode: form.mode,
      format_label: form.format_label,
      map: form.mode === 'br' ? form.map || null : null,
      skills_on: form.mode !== 'br' ? form.skills_on : false,
      limited_ammo: form.mode !== 'br' ? form.limited_ammo : false,
      lw_format: form.mode === 'lw' ? form.lw_format || null : null,
      entry_fee: Number(form.entry_fee || 0),
      max_slots: Number(form.max_slots || 0),
      prize_text: form.prize_text,
      points_table: form.points_table,
      entry_closing_time: form.entry_closing_time,
      match_start_time: form.match_start_time,
      youtube_live_url: form.youtube_live_url || null,
      tournament_password: form.tournament_password,
      registration_status: form.registration_status,
      is_archived: form.is_archived || false,
    };

    let result;
    if (form.id) {
      result = await supabaseAdmin
        .from('tournaments')
        .update(payload)
        .eq('id', form.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin.from('tournaments').insert(payload).select().single();
    }

    const { error: err } = result;
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto text-xs text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              {form.id ? 'Edit tournament' : 'Create tournament'}
            </h2>
            <p className="text-11px text-slate-500">
              Configure mode, slots, timings, and security password.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              className="input"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              name="type"
              className="input"
              value={form.type}
              onChange={handleChange}
            >
              {TOURNAMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mode">
              Mode
            </label>
            <select
              id="mode"
              name="mode"
              className="input"
              value={form.mode}
              onChange={handleChange}
            >
              {FFMODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="format_label">
              Format label
            </label>
            <input
              id="format_label"
              name="format_label"
              className="input"
              placeholder={isBR ? 'Solo / Duo / Squad' : isCS ? '4v4' : '1v1 / 2v2'}
              value={form.format_label}
              onChange={handleChange}
              required
            />
          </div>
          {isBR && (
            <div>
              <label className="label" htmlFor="map">
                Map (BR only)
              </label>
              <select
                id="map"
                name="map"
                className="input"
                value={form.map}
                onChange={handleChange}
              >
                <option value="">Select map</option>
                {FFMAPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isBR && (
            <>
              <div className="flex items-center gap-2 pt-5">
                <label className="inline-flex items-center gap-2 text-11px text-slate-200">
                  <input
                    type="checkbox"
                    name="skills_on"
                    checked={form.skills_on}
                    onChange={handleChange}
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  Skills on
                </label>
                <label className="inline-flex items-center gap-2 text-11px text-slate-200">
                  <input
                    type="checkbox"
                    name="limited_ammo"
                    checked={form.limited_ammo}
                    onChange={handleChange}
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  Limited ammo
                </label>
              </div>
              {isLW && (
                <div>
                  <label className="label" htmlFor="lw_format">
                    LW format
                  </label>
                  <select
                    id="lw_format"
                    name="lw_format"
                    className="input"
                    value={form.lw_format}
                    onChange={handleChange}
                  >
                    <option value="">Select</option>
                    <option value="1v1">1v1</option>
                    <option value="2v2">2v2</option>
                  </select>
                </div>
              )}
            </>
          )}
          <div>
            <label className="label" htmlFor="entry_fee">
              Entry fee
            </label>
            <input
              id="entry_fee"
              name="entry_fee"
              type="number"
              className="input"
              value={form.entry_fee}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="max_slots">
              Max slots
            </label>
            <input
              id="max_slots"
              name="max_slots"
              type="number"
              className="input"
              value={form.max_slots}
              onChange={handleChange}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="prize_text">
              Prize distribution (free text)
            </label>
            <textarea
              id="prize_text"
              name="prize_text"
              rows={3}
              className="input resize-none"
              value={form.prize_text}
              onChange={handleChange}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="points_table">
              Points table (free text)
            </label>
            <textarea
              id="points_table"
              name="points_table"
              rows={3}
              className="input resize-none"
              value={form.points_table}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="entry_closing_time">
              Entry closing time
            </label>
            <input
              id="entry_closing_time"
              name="entry_closing_time"
              type="datetime-local"
              className="input"
              value={form.entry_closing_time}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="match_start_time">
              Match start time
            </label>
            <input
              id="match_start_time"
              name="match_start_time"
              type="datetime-local"
              className="input"
              value={form.match_start_time}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="youtube_live_url">
              YouTube live URL
            </label>
            <input
              id="youtube_live_url"
              name="youtube_live_url"
              className="input"
              value={form.youtube_live_url}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="tournament_password">
              Tournament password (4 digits)
            </label>
            <input
              id="tournament_password"
              name="tournament_password"
              className="input"
              value={form.tournament_password}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="registration_status">
              Registration status
            </label>
            <select
              id="registration_status"
              name="registration_status"
              className="input"
              value={form.registration_status}
              onChange={handleChange}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {error && (
            <div className="md:col-span-2 text-11px text-red-400">{error}</div>
          )}
          <div className="md:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
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
  const [tournaments, setTournaments] = React.useState([]);
  const [archived, setArchived] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
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
      .order('match_start_time', { ascending: true });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setLoading(false);
      return;
    }
    setTournaments((data || []).filter((t) => !t.is_archived));
    setArchived((data || []).filter((t) => t.is_archived));
    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

  const labelForType = (id) => TOURNAMENT_TYPES.find((x) => x.id === id)?.label || id;

  const handleArchiveConfirmed = async () => {
    const { id } = confirmArchive;
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ is_archived: true })
      .eq('id', id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to archive tournament.', 'error');
      return;
    }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
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
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
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
                  <th>Title</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Format</th>
                  <th>Entry</th>
                  <th>Slots</th>
                  <th>Reg</th>
                  <th>Start</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>
                      <span className="badge">{labelForType(t.type)}</span>
                    </td>
                    <td>{t.mode}</td>
                    <td>{t.format_label}</td>
                    <td>{t.entry_fee}</td>
                    <td>
                      {t.filled_slots || 0}/{t.max_slots}
                    </td>
                    <td>
                      <span
                        className={
                          'status-pill ' +
                          (t.registration_status === 'open'
                            ? 'pending'
                            : 'approved')
                        }
                      >
                        {t.registration_status}
                      </span>
                    </td>
                    <td>
                      {t.match_start_time
                        ? new Date(t.match_start_time).toLocaleString()
                        : '—'}
                    </td>
                    <td className="space-x-2 text-right">
                      <button
                        type="button"
                        className="btn-secondary text-[11px]"
                        onClick={() => {
                          setEditing(t);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-[11px]"
                        onClick={() => setConfirmArchive({ open: true, id: t.id })}
                      >
                        Archive
                      </button>
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
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th>Format</th>
                    <th>Start</th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{labelForType(t.type)}</td>
                      <td>{t.mode}</td>
                      <td>{t.format_label}</td>
                      <td>
                        {t.match_start_time
                          ? new Date(t.match_start_time).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </section>

      <TournamentForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
      <ConfirmDialog
        open={confirmArchive.open}
        title="Archive tournament?"
        description="Archived tournaments are hidden from lists but kept in the database."
        confirmLabel="Archive"
        onCancel={() => setConfirmArchive({ open: false })}
        onConfirm={handleArchiveConfirmed}
      />
    </div>
  );
}
