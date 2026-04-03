import React from 'react';

export function BanManagerPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Ban manager</h1>
        <p className="text-xs text-slate-400">
          Issue temporary or platform-wide bans and keep a clean esports environment.
        </p>
      </header>
      <div className="card text-xs text-slate-300">
        <p>
          Wire this page to your <code>bans</code> table and <code>players</code> to support:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Live player search by UID or name.</li>
          <li>Optional tournament-scoped bans vs platform-wide bans.</li>
          <li>Automatic notification with reason and ban lift date.</li>
          <li>Active bans table plus a collapsed list of expired bans.</li>
        </ul>
      </div>
    </div>
  );
}
