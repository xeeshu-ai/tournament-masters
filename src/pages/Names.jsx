import React from 'react';

export function NameChangesPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Name change requests</h1>
        <p className="text-xs text-slate-400">
          Approve or reject player display name changes and notify them instantly.
        </p>
      </header>
      <div className="card text-xs text-slate-300">
        <p>
          Connect this section to <code>name_change_requests</code> and <code>players</code> to:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Load pending requests with current and requested name plus UID.</li>
          <li>Approve to update <code>players.full_name</code> and insert a notification.</li>
          <li>Reject with a typed reason saved on the request plus a notification.</li>
        </ul>
      </div>
    </div>
  );
}
