import React from 'react';

export function BracketManagerPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Bracket manager</h1>
        <p className="text-xs text-slate-400">
          Long tournament bracket generation and winner selection. Wiring to long_brackets is
          left for you to customize based on your exact schema.
        </p>
      </header>
      <div className="card text-xs text-slate-300">
        <p>
          This panel is prepared for integrating with your <code>long_brackets</code> table. You
          can extend it to:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Load confirmed teams for a long tournament.</li>
          <li>Generate round fixtures using a Fisher–Yates shuffle.</li>
          <li>Select winners per match and auto-generate next rounds.</li>
          <li>Rebuild later rounds when a previous winner changes.</li>
        </ul>
        <p className="mt-3 text-11px text-slate-500">
          The core Supabase queries depend heavily on whether you keep team names directly on
          <code>long_brackets</code> or reference <code>tournament_registrations</code>. Because your
          attached repo uses a slightly different schema (<code>longbrackets</code>,
          <code>longbrmatches</code>), this file keeps the UI shell ready for you to drop in the
          exact queries you prefer.
        </p>
      </div>
    </div>
  );
}
