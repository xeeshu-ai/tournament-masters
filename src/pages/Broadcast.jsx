import React from 'react';

export function BroadcastPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Broadcast</h1>
        <p className="text-xs text-slate-400">
          Send important messages to all approved players via the notifications table.
        </p>
      </header>
      <div className="card space-y-3 text-xs text-slate-200">
        <p>
          Add a textarea, live character count (max 500), and a button that loops over approved
          players and inserts one notification row per player. Show progress ("Sending to X
          players…") and a success summary once done.
        </p>
      </div>
    </div>
  );
}
