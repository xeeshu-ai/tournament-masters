import React from 'react';

export function RoomCodesPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Room codes</h1>
        <p className="text-xs text-slate-400">
          Configure and schedule room IDs and passwords per tournament.
        </p>
      </header>
      <div className="card text-xs text-slate-300">
        <p>
          Hook this page to your <code>room_codes</code> table. The recommended UI:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tournament dropdown, showing only non-archived events.</li>
          <li>Existing room code preview with room ID, password, and reveal time.</li>
          <li>Form to post or update codes with a datetime picker.</li>
          <li>
            Helper note showing how many minutes remain until reveal based on the current time.
          </li>
        </ul>
      </div>
    </div>
  );
}
