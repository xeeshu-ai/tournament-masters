import React from 'react';
import { supabaseAdmin } from '../supabaseClient';

function StatCard({ label, value, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex flex-col items-start space-y-1 text-left hover:border-sky-500/60 hover:bg-slate-900/90"
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-50">{value ?? '—'}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </button>
  );
}

export function DashboardPage({ navigate }) {
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      const [players, pendingPlayers, tournaments, pendingPayments, complaints, nameChanges] =
        await Promise.all([
          supabaseAdmin.from('players').select('id', { count: 'exact', head: true }),
          supabaseAdmin
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabaseAdmin
            .from('tournaments')
            .select('id', { count: 'exact', head: true })
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
          totalPlayers: players.count ?? 0,
          pendingPlayers: pendingPlayers.count ?? 0,
          activeTournaments: tournaments.count ?? 0,
          pendingPayments: pendingPayments.count ?? 0,
          openComplaints: complaints.count ?? 0,
          pendingNameChanges: nameChanges.count ?? 0,
        });
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Overview</h1>
        <p className="text-xs text-slate-400">
          Quick snapshot of the platform. All numbers update live from Supabase.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Registered players"
          value={stats?.totalPlayers}
          sub="All players, any status"
          onClick={() => navigate('/players')}
        />
        <StatCard
          label="Pending approvals"
          value={stats?.pendingPlayers}
          sub="Profiles waiting for manual check"
          onClick={() => navigate('/players')}
        />
        <StatCard
          label="Active tournaments"
          value={stats?.activeTournaments}
          sub="Not archived, upcoming or live"
          onClick={() => navigate('/tournaments')}
        />
        <StatCard
          label="Pending payments"
          value={stats?.pendingPayments}
          sub="Payment requests awaiting confirmation"
          onClick={() => navigate('/payments')}
        />
        <StatCard
          label="Open complaints"
          value={stats?.openComplaints}
          sub="Contact messages not reviewed"
          onClick={() => navigate('/complaints')}
        />
        <StatCard
          label="Pending name changes"
          value={stats?.pendingNameChanges}
          sub="Name change requests to review"
          onClick={() => navigate('/names')}
        />
      </div>
    </div>
  );
}
