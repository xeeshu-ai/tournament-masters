import React from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';

function StatCard({ label, value, sub, onClick, accent }) {
  const accentClass = accent === 'sky'
    ? 'hover:border-sky-500/60'
    : accent === 'violet'
    ? 'hover:border-violet-500/60'
    : 'hover:border-sky-500/60';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card flex flex-col items-start space-y-1 text-left hover:bg-slate-900/90 ${accentClass}`}
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-50">{value ?? '—'}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </button>
  );
}

export function DashboardPage({ navigate }) {
  const { gameId } = useParams();
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    if (!gameId) return;
    let ignore = false;

    async function load() {
      const [
        gpAll,
        gpPending,
        gpVerified,
        singleTournaments,
        longTournaments,
        pendingPayments,
        complaints,
        nameChanges,
      ] = await Promise.all([
        supabaseAdmin
          .from('game_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId),

        supabaseAdmin
          .from('game_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('status', 'pending'),

        supabaseAdmin
          .from('game_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('status', 'verified'),

        // Single-match tournaments
        supabaseAdmin
          .from('tournaments')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('type', 'single')
          .eq('is_archived', false),

        // Long tournaments
        supabaseAdmin
          .from('tournaments')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('type', 'long')
          .eq('is_archived', false),

        supabaseAdmin
          .from('payment_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),

        supabaseAdmin
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_reviewed', false),

        supabaseAdmin
          .from('name_change_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      if (!ignore) {
        setStats({
          totalProfiles:      gpAll.count          ?? 0,
          pendingProfiles:    gpPending.count       ?? 0,
          verifiedPlayers:    gpVerified.count      ?? 0,
          singleTournaments:  singleTournaments.count ?? 0,
          longTournaments:    longTournaments.count   ?? 0,
          pendingPayments:    pendingPayments.count  ?? 0,
          openComplaints:     complaints.count       ?? 0,
          pendingNameChanges: nameChanges.count      ?? 0,
        });
      }
    }

    load();
    return () => { ignore = true; };
  }, [gameId]);

  const gameLabel = gameId
    ?.split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">{gameLabel} — Overview</h1>
        <p className="text-xs text-slate-400">
          Stats scoped to {gameLabel} only. All numbers are live from Supabase.
        </p>
      </header>

      {/* Players */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Players</p>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Game profiles submitted"
            value={stats?.totalProfiles}
            sub={`All ${gameLabel} profiles, any status`}
            onClick={() => navigate(`/${gameId}/players`)}
          />
          <StatCard
            label="Pending verifications"
            value={stats?.pendingProfiles}
            sub={`${gameLabel} profiles awaiting manual check`}
            onClick={() => navigate(`/${gameId}/players`)}
          />
          <StatCard
            label="Verified players"
            value={stats?.verifiedPlayers}
            sub={`${gameLabel} profiles approved to compete`}
            onClick={() => navigate(`/${gameId}/players`)}
          />
        </div>
      </section>

      {/* Tournaments */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Tournaments</p>
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="Single-match tournaments"
            value={stats?.singleTournaments}
            sub="Active, non-archived single matches"
            accent="sky"
            onClick={() => navigate(`/${gameId}/single-tournaments`)}
          />
          <StatCard
            label="Long tournaments"
            value={stats?.longTournaments}
            sub="Active, non-archived long events"
            accent="violet"
            onClick={() => navigate(`/${gameId}/long-tournaments`)}
          />
        </div>
      </section>

      {/* Operations */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Operations</p>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Pending payments"
            value={stats?.pendingPayments}
            sub="Payment requests awaiting confirmation"
            onClick={() => navigate(`/${gameId}/payments`)}
          />
          <StatCard
            label="Open complaints"
            value={stats?.openComplaints}
            sub="Contact messages not reviewed"
            onClick={() => navigate(`/${gameId}/complaints`)}
          />
          <StatCard
            label="Pending name changes"
            value={stats?.pendingNameChanges}
            sub="Name change requests to review"
            onClick={() => navigate(`/${gameId}/names`)}
          />
        </div>
      </section>
    </div>
  );
}
