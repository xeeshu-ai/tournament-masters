import React from 'react';
import { supabaseAdmin } from '../supabaseClient';
import { Toast } from '../components/Toast';

function splitBansByExpiry(bans) {
  const now = new Date();
  const active = [];
  const expired = [];
  for (const b of bans) {
    if (!b.expires_at) {
      active.push(b);
      continue;
    }
    const exp = new Date(b.expires_at);
    if (exp.getTime() >= now.getTime()) active.push(b);
    else expired.push(b);
  }
  return { active, expired };
}

export function BanManagerPage() {
  const [search, setSearch] = React.useState('');
  const [players, setPlayers] = React.useState([]);
  const [bans, setBans] = React.useState([]);
  const [loadingPlayers, setLoadingPlayers] = React.useState(false);
  const [loadingBans, setLoadingBans] = React.useState(true);
  const [showExpired, setShowExpired] = React.useState(false);

  const [form, setForm] = React.useState({
    player_id: '',
    scope: 'global',
    tournament_id: '',
    duration: '3d',
    reason: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadBans = async () => {
    setLoadingBans(true);
    const { data, error } = await supabaseAdmin
      .from('bans')
      .select('*, players:player_id(full_name, ff_uid, email), tournaments:tournament_id(title)')
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    setBans(data || []);
    setLoadingBans(false);
  };

  React.useEffect(() => {
    loadBans();
  }, []);

  const searchPlayers = async (term) => {
    setSearch(term);
    if (!term || term.trim().length < 2) {
      setPlayers([]);
      return;
    }
    setLoadingPlayers(true);
    const like = `%${term.trim()}%`;
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('id, ff_uid, full_name, email, status')
      .or(`ff_uid.ilike.${like},full_name.ilike.${like},email.ilike.${like}`)
      .limit(20);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setPlayers([]);
    } else {
      setPlayers(data || []);
    }
    setLoadingPlayers(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const computeExpiry = () => {
    if (form.duration === 'permanent') return null;
    const now = new Date();
    if (form.duration === '3d') now.setDate(now.getDate() + 3);
    else if (form.duration === '7d') now.setDate(now.getDate() + 7);
    else if (form.duration === '30d') now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const handleCreateBan = async (e) => {
    e.preventDefault();
    if (!form.player_id) {
      notify('Select a player to ban.', 'error');
      return;
    }
    if (!form.reason.trim()) {
      notify('Reason is required.', 'error');
      return;
    }
    if (form.scope === 'tournament' && !form.tournament_id) {
      notify('Select a tournament for tournament-scoped bans.', 'error');
      return;
    }
    setSaving(true);
    const expires_at = computeExpiry();
    const payload = {
      player_id: form.player_id,
      tournament_id: form.scope === 'tournament' ? form.tournament_id || null : null,
      scope: form.scope,
      reason: form.reason.trim(),
      expires_at,
    };

    const { error } = await supabaseAdmin.from('bans').insert(payload);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      notify('Failed to create ban.', 'error');
      setSaving(false);
      return;
    }

    // ✅ Fixed: use title + body + type instead of message
    try {
      await supabaseAdmin.from('notifications').insert({
        player_id: form.player_id,
        title: 'Account Banned',
        body:
          form.scope === 'global'
            ? `You have been banned from Tournvia. Reason: ${form.reason.trim()}`
            : `You have been banned from a tournament on Tournvia. Reason: ${form.reason.trim()}`,
        type: 'ban',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    setSaving(false);
    setForm({ player_id: '', scope: 'global', tournament_id: '', duration: '3d', reason: '' });
    setSearch('');
    setPlayers([]);
    notify('Ban created successfully.');
    loadBans();
  };

  const { active, expired } = splitBansByExpiry(bans);
  const visible = showExpired ? expired : active;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Ban manager</h1>
        <p className="text-xs text-slate-400">
          Issue temporary or platform-wide bans and keep a clean esports environment.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1.2fr)] md:items-start">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Find player</h2>
          <div className="card space-y-3 text-xs">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <label className="label" htmlFor="search">
                  Search by UID, name, or email
                </label>
                <input
                  id="search"
                  type="search"
                  className="input text-11px"
                  placeholder="Type at least 2 characters"
                  value={search}
                  onChange={(e) => searchPlayers(e.target.value)}
                />
              </div>
              <p className="mt-1 text-11px text-slate-500 md:mt-6">
                {loadingPlayers ? 'Searching…' : players.length ? `${players.length} results` : 'No search yet'}
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800/80">
              {loadingPlayers && (
                <div className="p-3 text-11px text-slate-400">Loading players…</div>
              )}
              {!loadingPlayers && players.length === 0 && (
                <div className="p-3 text-11px text-slate-500">No players found for this search.</div>
              )}
              {!loadingPlayers &&
                players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      'flex w-full items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-left last:border-0 hover:bg-slate-900/80' +
                      (form.player_id === p.id ? ' bg-sky-500/10' : '')
                    }
                    onClick={() => setForm((f) => ({ ...f, player_id: p.id }))}
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-100">{p.full_name}</p>
                      <p className="text-11px text-slate-400">{p.email}</p>
                    </div>
                    <div className="text-right text-11px text-slate-500">
                      <div className="font-mono">UID {p.ff_uid}</div>
                      <div className="capitalize">{p.status}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateBan} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Create ban</h2>
          <div className="card space-y-3 text-xs">
            <div>
              <p className="label">Selected player</p>
              <p className="text-11px text-slate-300">
                {form.player_id
                  ? 'Player selected from the left list.'
                  : 'Select a player from the left pane to continue.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="scope">
                  Scope
                </label>
                <select
                  id="scope"
                  name="scope"
                  className="input"
                  value={form.scope}
                  onChange={handleFormChange}
                >
                  <option value="match">Single match</option>
                  <option value="tournament">Tournament only</option>
                  <option value="global">Global platform ban</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="duration">
                  Duration
                </label>
                <select
                  id="duration"
                  name="duration"
                  className="input"
                  value={form.duration}
                  onChange={handleFormChange}
                >
                  <option value="3d">3 days</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="tournament_id">
                Tournament (for tournament bans)
              </label>
              <input
                id="tournament_id"
                name="tournament_id"
                className="input text-11px"
                placeholder="Paste tournament ID (optional)"
                value={form.tournament_id}
                onChange={handleFormChange}
              />
              <p className="mt-1 text-11px text-slate-500">
                You can keep this empty for match or global bans.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="reason">
                Reason
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={3}
                className="input resize-none"
                value={form.reason}
                onChange={handleFormChange}
                placeholder="Explain why this ban is being issued. This text is also sent to the player."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="btn-primary text-xs"
                disabled={saving || !form.player_id}
              >
                {saving ? 'Saving…' : 'Create ban'}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {showExpired ? 'Expired bans' : 'Active bans'}
            </h2>
            <p className="text-11px text-slate-500">
              {showExpired
                ? 'Previously enforced bans for reference.'
                : 'Bans that are currently in effect.'}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-11px text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
            />
            Show expired bans
          </label>
        </div>

        <div className="card overflow-x-auto text-xs">
          {loadingBans ? (
            <p className="text-11px text-slate-400">Loading bans…</p>
          ) : visible.length === 0 ? (
            <p className="text-11px text-slate-400">No bans in this view.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Scope</th>
                  <th>Tournament</th>
                  <th>Reason</th>
                  <th>Expires</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id} className={showExpired ? 'opacity-70' : ''}>
                    <td>
                      <div className="text-slate-100">{b.players?.full_name || 'Unknown'}</div>
                      <div className="text-11px text-slate-500">
                        UID {b.players?.ff_uid} • {b.players?.email}
                      </div>
                    </td>
                    <td className="capitalize">{b.scope}</td>
                    <td>{b.tournaments?.title || '-'}</td>
                    <td className="max-w-xs whitespace-pre-line text-slate-200">{b.reason}</td>
                    <td className="text-11px text-slate-400">
                      {b.expires_at ? new Date(b.expires_at).toLocaleString() : 'No expiry'}
                    </td>
                    <td className="text-11px text-slate-400">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
