import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

export function RoomCodesPage() {
  const [tournaments, setTournaments] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [existing, setExisting] = React.useState(null);
  const [form, setForm] = React.useState({ room_id: '', room_password: '' });
  const [status, setStatus] = React.useState('idle');
  const [toggling, setToggling] = React.useState(false);
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
      if (error) console.error(error);
      setTournaments(data || []);
    }
    loadTournaments();
  }, []);

  const loadRoomCode = async (tid) => {
    if (!tid) {
      setExisting(null);
      setForm({ room_id: '', room_password: '' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('room_codes')
      .select('*')
      .eq('tournament_id', tid)
      .maybeSingle();
    if (error) {
      console.error(error);
      setExisting(null);
      setForm({ room_id: '', room_password: '' });
      return;
    }
    setExisting(data);
    setForm({
      room_id: data?.room_id || '',
      room_password: data?.room_password || '',
    });
  };

  const handleSelect = (value) => {
    setSelectedId(value);
    if (value) loadRoomCode(value);
    else {
      setExisting(null);
      setForm({ room_id: '', room_password: '' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedId) { notify('Select a tournament first.', 'error'); return; }
    if (!form.room_id.trim() || !form.room_password.trim()) {
      notify('Room ID and password are required.', 'error');
      return;
    }

    setStatus('saving');
    const payload = {
      tournament_id: selectedId,
      room_id: form.room_id.trim(),
      room_password: form.room_password.trim(),
    };

    let error;
    if (existing?.id) {
      ({ error } = await supabaseAdmin.from('room_codes').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabaseAdmin.from('room_codes').insert({ ...payload, is_revealed: false }));
    }

    if (error) {
      console.error(error);
      notify('Failed to save room code.', 'error');
      setStatus('idle');
      return;
    }

    notify('Room code saved successfully.');
    setStatus('idle');
    loadRoomCode(selectedId);
  };

  const handleToggleReveal = async () => {
    if (!existing?.id) return;
    setToggling(true);
    const newVal = !existing.is_revealed;
    const { error } = await supabaseAdmin
      .from('room_codes')
      .update({ is_revealed: newVal })
      .eq('id', existing.id);
    if (error) {
      console.error(error);
      notify('Failed to update reveal status.', 'error');
      setToggling(false);
      return;
    }
    setExisting((prev) => ({ ...prev, is_revealed: newVal }));
    notify(newVal ? 'Room code is now visible to hosts.' : 'Room code is now hidden.');
    setToggling(false);
  };

  const selectedTournament = tournaments.find((t) => String(t.id) === String(selectedId));

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Room codes</h1>
        <p className="text-xs text-slate-400">
          Set room IDs and passwords per tournament, then reveal them to hosts when ready.
        </p>
      </header>

      <section className="card space-y-3 text-xs text-slate-200">
        {/* Tournament selector */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1.4fr)] md:items-end">
          <div>
            <label className="label" htmlFor="tournament">Tournament</label>
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
              <p>Match start: {selectedTournament.start_time ? new Date(selectedTournament.start_time).toLocaleString() : 'Not set'}</p>
              <p>Existing room code: {existing?.room_id ? `${existing.room_id} / ****` : 'None yet'}</p>
            </div>
          )}
        </div>

        {/* Room ID + Password form */}
        <form onSubmit={handleSave} className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="room_id">Room ID</label>
            <input
              id="room_id"
              name="room_id"
              className="input"
              value={form.room_id}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label" htmlFor="room_password">Room password</label>
            <input
              id="room_password"
              name="room_password"
              className="input"
              value={form.room_password}
              onChange={handleChange}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={status === 'saving' || !selectedId}
            >
              {status === 'saving' ? 'Saving…' : 'Save room code'}
            </button>
          </div>
        </form>

        {/* Reveal / Hide toggle — only shown after a room code is saved */}
        {existing?.id && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-200">
                {existing.is_revealed ? '👁 Room code is visible to hosts' : '🙈 Room code is hidden from hosts'}
              </p>
              <p className="text-11px text-slate-500">
                {existing.is_revealed
                  ? 'Hosts can currently see the room ID and password. Click to hide.'
                  : 'Hosts cannot see the room details yet. Click to reveal when ready.'}
              </p>
            </div>
            <button
              onClick={handleToggleReveal}
              disabled={toggling}
              className={`ml-4 shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                existing.is_revealed
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-700/40'
                  : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-700/40'
              }`}
            >
              {toggling ? '…' : existing.is_revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
        )}

        <p className="text-11px text-slate-500">
          Room details are only shown to the <strong>host</strong> of each confirmed team.
          The host is responsible for sharing them with teammates.
        </p>
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
