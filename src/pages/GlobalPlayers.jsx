import React from 'react';
import { supabaseAdmin } from '../supabaseClient';

const TABS = ['all', 'banned'];

function exportCSV(players) {
  const rows = [
    ['Name', 'Email', 'Phone', 'Joined'],
    ...players.map((p) => [
      p.full_name || '',
      p.email || '',
      p.phone || '',
      new Date(p.created_at).toLocaleString(),
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tournvia-players.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function GlobalPlayersPage() {
  const [tab, setTab] = React.useState('all');
  const [players, setPlayers] = React.useState([]);
  const [banned, setBanned] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    async function load() {
      setLoading(true);

      // All players
      const { data: allPlayers } = await supabaseAdmin
        .from('players')
        .select('id, full_name, email, phone, created_at, profile_setup')
        .order('created_at', { ascending: false });
      setPlayers(allPlayers || []);

      // Globally banned — bans where tournament_id is null
      const { data: banRows } = await supabaseAdmin
        .from('bans')
        .select('id, player_id, reason, banned_until, created_at, players(full_name, email, phone)')
        .is('tournament_id', null)
        .order('created_at', { ascending: false });
      setBanned(banRows || []);

      setLoading(false);
    }
    load();
  }, []);

  const filteredPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  });

  const filteredBanned = banned.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const pl = b.players;
    return (
      pl?.full_name?.toLowerCase().includes(q) ||
      pl?.email?.toLowerCase().includes(q) ||
      b.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Tournvia Accounts</h1>
          <p className="text-xs text-slate-400 mt-0.5">All registered accounts across every game.</p>
        </div>
        <button
          onClick={() => exportCSV(filteredPlayers)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:bg-slate-700 hover:text-slate-100"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition',
                tab === t
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
              ].join(' ')}
            >
              {t === 'all' ? `All (${players.length})` : `Banned (${banned.length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search name, email, phone…"
          className="input w-56 text-[11px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : tab === 'all' ? (
        <div className="card overflow-x-auto">
          {filteredPlayers.length === 0 ? (
            <p className="text-xs text-slate-400">No players found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Profile setup</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-slate-500">{i + 1}</td>
                    <td>{p.full_name || <span className="text-slate-500 italic">Not set</span>}</td>
                    <td>{p.email}</td>
                    <td>{p.phone || <span className="text-slate-500">—</span>}</td>
                    <td>
                      <span className={`status-pill ${p.profile_setup ? 'approved' : 'pending'}`}>
                        {p.profile_setup ? 'Done' : 'Incomplete'}
                      </span>
                    </td>
                    <td className="text-slate-400">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {filteredBanned.length === 0 ? (
            <p className="text-xs text-slate-400">No globally banned players.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Reason</th>
                  <th>Banned until</th>
                  <th>Banned on</th>
                </tr>
              </thead>
              <tbody>
                {filteredBanned.map((b, i) => (
                  <tr key={b.id}>
                    <td className="text-slate-500">{i + 1}</td>
                    <td>{b.players?.full_name || <span className="text-slate-500 italic">Unknown</span>}</td>
                    <td>{b.players?.email || '—'}</td>
                    <td>{b.reason || '—'}</td>
                    <td className="text-slate-400">
                      {b.banned_until
                        ? new Date(b.banned_until).toLocaleString()
                        : <span className="text-red-400 font-medium">Permanent</span>}
                    </td>
                    <td className="text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
