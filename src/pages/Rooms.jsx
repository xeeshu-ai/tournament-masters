import React from 'react';
// ✅ Fix — use named imports
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

export function RoomCodesPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [existing, setExisting] = React.useState(null);
  const [form, setForm] = React.useState({ room_id: '', room_password: '', reveal_at: '' });
  const [status, setStatus] = React.useState('idle');
  const [toast, setToast] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  React.useEffect(() => {
    async function loadTournaments() {
      const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('id, title, mode, mode_label, format_label, start_time')
        .eq('is_archived', false)
        .order('start_time', { ascending: true });
      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
      setTournaments(data || []);
    }
    loadTournaments();
  }, []);

  const loadRoomCode = async (tid) => {
    if (!tid) {
      setExisting(null);
      setForm({ room_id: '', room_password: '', reveal_at: '' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('room_codes')
      .select('*')
      .eq('tournament_id', tid)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setExisting(null);
      setForm({ room_id: '', room_password: '', reveal_at: '' });
      return;
    }
    setExisting(data);
    setForm({
      room_id: data?.room_id || '',
      room_password: data?.room_password || '',
      reveal_at: data?.reveal_at ? data.reveal_at.slice(0, 16) : '',
    });
  };

  const handleSelect = (value) => {
    setSelectedId(value);
    if (value) loadRoomCode(value);
    else {
      setExisting(null);
      setForm({ room_id: '', room_password: '', reveal_at: '' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedId) {
      notify('Select a tournament first.', 'error');
      return;
    }
    if (!form.room_id.trim() || !form.room_password.trim() || !form.reveal_at) {
      notify('Room ID, password, and reveal time are required.', 'error');
      return;
    }

    setStatus('saving');
    const payload = {
      tournament_id: selectedId,
      room_id: form.room_id.trim(),
      room_password: form.room_password.trim(),
      reveal_at: new Date(form.reveal_at).toISOString(),
    };

    let error;
    if (existing?.id) {
      ({ error } = await supabaseAdmin
        .from('room_codes')
        .update(payload)
        .eq('id', existing.id));
    } else {
      ({ error } = await supabaseAdmin.from('room_codes').insert(payload));
    }

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to save room code.', 'error');
      setStatus('idle');
      return;
    }

    notify('Room code saved successfully.');
    setStatus('idle');
    loadRoomCode(selectedId);
  };

  const selectedTournament = tournaments.find((t) => String(t.id) === String(selectedId));
  let revealHint = '';
  if (form.reveal_at && selectedTournament?.start_time) {
    try {
      const reveal = new Date(form.reveal_at);
      const start = new Date(selectedTournament.start_time);
      const diffMs = start.getTime() - reveal.getTime();
      const diffMin = Math.round(diffMs / 60000);
      if (diffMin >= 0) {
        revealHint = `${diffMin} minutes before match start.`;
      } else {
        revealHint = `${Math.abs(diffMin)} minutes after match start.`;
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Room codes</h1>
        <p className="text-xs text-slate-400">
          Configure and schedule room IDs and passwords per tournament.
        </p>
      </header>

      <section className="card space-y-3 text-xs text-slate-200">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1.4fr)] md:items-end">
          <div>
            <label className="label" htmlFor="tournament">
              Tournament
            </label>
            <select
              id="tournament"
              className="input"
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="">Select tournament</option>
              {tournaments.map((t) => {
                const modeStr = [t.mode_label, t.format_label].filter(Boolean).join(' • ') || t.mode || '';
                return (
                  <option key={t.id} value={t.id}>
                    {t.title}{modeStr ? ` • ${modeStr}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedTournament && (
            <div className="text-11px text-slate-500">
              <p>
                Match start:{' '}
                {selectedTournament.start_time
                  ? new Date(selectedTournament.start_time).toLocaleString()
                  : 'Not set'}
              </p>
              <p>
                Existing room code:{' '}
                {existing?.room_id ? `${existing.room_id} • ****` : 'None yet'}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="room_id">
              Room ID
            </label>
            <input
              id="room_id"
              name="room_id"
              className="input"
              value={form.room_id}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="room_password">
              Room password
            </label>
            <input
              id="room_password"
              name="room_password"
              className="input"
              value={form.room_password}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="reveal_at">
              Reveal time
            </label>
            <input
              id="reveal_at"
              name="reveal_at"
              type="datetime-local"
              className="input"
              value={form.reveal_at}
              onChange={handleChange}
            />
            {revealHint && <p className="mt-1 text-11px text-slate-500">{revealHint}</p>}
          </div>
          <div className="md:col-span-3 flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={status === 'saving' || !selectedId}
            >
              {status === 'saving' ? 'Saving…' : 'Save room code'}
            </button>
          </div>
        </form>
        <p className="text-11px text-slate-500">
          Room details will only be shown to the <strong>host</strong> of each registered team — after the reveal time has passed.
          The host is responsible for sharing them with teammates.
        </p>
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
