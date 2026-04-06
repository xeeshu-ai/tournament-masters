
import React from 'react';
// ✅ Fix — use named imports
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

export function BroadcastPage() {
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      notify('Message cannot be empty.', 'error');
      return;
    }
    if (trimmed.length > 500) {
      notify('Message is too long. Keep it under 500 characters.', 'error');
      return;
    }

    setSending(true);
    setProgress('Loading approved players…');

    const { data: players, error } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('status', 'approved');

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to load players.', 'error');
      setSending(false);
      setProgress(null);
      return;
    }

    if (!players || players.length === 0) {
      notify('No approved players to broadcast to.', 'error');
      setSending(false);
      setProgress(null);
      return;
    }

    setProgress(`Sending to ${players.length} players…`);

    const chunks = [];
    const chunkSize = 100;
    for (let i = 0; i < players.length; i += chunkSize) {
      chunks.push(players.slice(i, i + chunkSize));
    }

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const rows = chunk.map((p) => ({ player_id: p.id, message: trimmed }));
        const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
        if (insertError) {
          // eslint-disable-next-line no-console
          console.error(insertError);
          throw insertError;
        }
        setProgress(`Sent to ${Math.min((i + 1) * chunkSize, players.length)} of ${players.length} players…`);
      }
    } catch (err) {
      notify('Failed while sending some notifications. Check console for details.', 'error');
      setSending(false);
      setProgress(null);
      return;
    }

    setSending(false);
    setProgress(`Broadcast sent to ${players.length} players.`);
    notify('Broadcast sent successfully.');
  };

  const remaining = 500 - message.length;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Broadcast</h1>
        <p className="text-xs text-slate-400">
          Send important messages to all approved players via the notifications table.
        </p>
      </header>

      <section className="card space-y-3 text-xs text-slate-200">
        <p>
          This broadcast uses the same <code className="mx-1 rounded bg-slate-900 px-1 py-0.5">notifications</code> table
          as other system messages. Each approved player receives one row with this message.
        </p>
        <div>
          <label className="label" htmlFor="broadcast-message">
            Message (max 500 characters)
          </label>
          <textarea
            id="broadcast-message"
            rows={5}
            className="input resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="Example: Maintenance tonight at 11:30 PM IST. Ongoing tournaments will resume tomorrow with updated timings."
          />
          <div className="mt-1 flex items-center justify-between text-11px text-slate-500">
            <span>{remaining} characters left</span>
            {progress && <span className="text-slate-400">{progress}</span>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
