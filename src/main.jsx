import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './index.css';
import { supabaseAuth } from './supabaseClient';
import { AdminLayout } from './layout/AdminLayout';
import { GameSelectPage } from './pages/GameSelect';
import { Login } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PlayersPage } from './pages/Players';
import { GlobalPlayersPage } from './pages/GlobalPlayers';
import { SingleTournamentsPage } from './pages/SingleTournaments';
import { LongTournamentsPage } from './pages/LongTournaments';
import { SingleTournamentDetailPage } from './pages/SingleTournamentDetail';
import { LongTournamentDetailPage } from './pages/LongTournamentDetail';
import { RegistrationsPage } from './pages/Registrations';
import { ResultsPage } from './pages/Results';

function GlobalPlayersShell({ user }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabaseAuth.auth.signOut();
    navigate('/login');
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Games
          </button>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-semibold text-slate-200">Players</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline">Signed in as <span className="text-slate-100">{user?.email}</span></span>
          <button onClick={handleLogout} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-100">Logout</button>
        </div>
      </header>
      <main className="flex-1 px-6 py-6"><GlobalPlayersPage /></main>
    </div>
  );
}

function AdminShell() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      const { data } = await supabaseAuth.auth.getUser();
      if (!ignore) {
        if (!data?.user) { navigate('/login'); }
        else { setUser(data.user); }
        setLoading(false);
      }
    }
    load();
    const { data: sub } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setUser(null); navigate('/login'); }
      else { setUser(session.user); }
    });
    return () => { ignore = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-xs text-slate-400">Checking admin session…</div>;
  }

  return (
    <Routes>
      <Route path="games" element={<GameSelectPage user={user} />} />
      <Route path="players" element={<GlobalPlayersShell user={user} />} />
      <Route path=":gameId" element={<AdminLayout user={user} />}>
        <Route index element={<DashboardPage navigate={navigate} />} />
        <Route path="players" element={<PlayersPage />} />

        {/* ── Single-match tournaments ── */}
        <Route path="single-tournaments" element={<SingleTournamentsPage />} />
        <Route path="single-tournaments/:tournamentId" element={<SingleTournamentDetailPage />} />

        {/* ── Long tournaments ── */}
        <Route path="long-tournaments" element={<LongTournamentsPage />} />
        <Route path="long-tournaments/:tournamentId" element={<LongTournamentDetailPage />} />

        {/* Legacy /tournaments redirect kept for backwards compat */}
        <Route path="tournaments" element={<SingleTournamentsPage />} />
        <Route path="tournaments/:tournamentId" element={<SingleTournamentDetailPage />} />

        {/* Shared utility views that will later be integrated into per-tournament focus mode */}
        <Route path="registrations" element={<RegistrationsPage />} />
        <Route path="results" element={<ResultsPage />} />
      </Route>
      <Route path="*" element={<RedirectToGames />} />
    </Routes>
  );
}

function RedirectToGames() {
  const navigate = useNavigate();
  React.useEffect(() => { navigate('/games', { replace: true }); }, [navigate]);
  return null;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AdminShell />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppRouter /></React.StrictMode>,
);
