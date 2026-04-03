import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

export function ComplaintsPage() {
  const [items, setItems] = React.useState([]);
  const [showReviewed, setShowReviewed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setItems(data || []);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const markReviewed = async (id) => {
    const { error } = await supabaseAdmin
      .from('contact_messages')
      .update({ is_reviewed: true })
      .eq('id', id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to update message.', 'error');
      return;
    }
    notify('Marked as reviewed.');
    load();
  };

  const visible = items.filter((m) => (showReviewed ? true : !m.is_reviewed));

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Complaints & feedback</h1>
          <p className="text-xs text-slate-400">
            All messages submitted from the public contact form.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-11px text-slate-300">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={(e) => setShowReviewed(e.target.checked)}
            className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500"
          />
          Show reviewed
        </label>
      </header>
      <div className="space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading messages…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-slate-400">No complaints or feedback yet.</p>
        ) : (
          visible.map((m) => (
            <div
              key={m.id}
              className={`card space-y-1 text-xs text-slate-200 ${
                m.is_reviewed ? 'opacity-70' : ''
              }`}
            >
              <p className="text-11px text-slate-400">
                {m.category} • {new Date(m.created_at).toLocaleString()}
              </p>
              <p className="font-semibold text-slate-50">
                {m.name} · {m.email}
              </p>
              <p className="whitespace-pre-line text-slate-200">{m.message}</p>
              <div className="flex items-center justify-between pt-2">
                <span className="text-11px text-slate-500">
                  {m.is_reviewed ? 'Reviewed' : 'Not reviewed yet'}
                </span>
                {!m.is_reviewed && (
                  <button
                    type="button"
                    className="btn-secondary text-11px"
                    onClick={() => markReviewed(m.id)}
                  >
                    Mark as reviewed
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
