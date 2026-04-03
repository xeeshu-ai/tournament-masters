import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './index.css';
import { supabaseAdmin } from './supabaseClient';
import { AdminLayout } from './layout/AdminLayout';
import { Login } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PlayersPage } from './pages/Players';
import { TournamentsPage } from './pages/Tournaments';
import { PaymentsPage } from './pages/Payments';
import { ComplaintsPage } from './pages/Complaints';
import { BracketManagerPage } from './pages/Brackets';
import { ResultsPage } from './pages/Results';
import { RoomCodesPage } from './pages/Rooms';
import { NameChangesPage } from './pages/Names';
import { BanManagerPage } from './pages/Bans';
import { BroadcastPage } from './pages/Broadcast';

function AdminShell() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      const { data } = await supabaseAdmin.auth.getUser();
      if (!ignore) {
        if (!data?.user) {
          navigate('/login');
        } else {
          setUser(data.user);
        }
        setLoading(false);
      }
    }
    load();
    const { data: sub } = supabaseAdmin.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        navigate('/login');
      } else {
        setUser(session.user);
      }
    });
    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-xs text-slate-400">
        Checking admin session…
      </div>
    );
  }

  return (
    <AdminLayout user={user}>
      <Routes>
        <Route index element={<DashboardPage navigate={navigate} />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="brackets" element={<BracketManagerPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="rooms" element={<RoomCodesPage />} />
        <Route path="names" element={<NameChangesPage />} />
        <Route path="bans" element={<BanManagerPage />} />
        <Route path="broadcast" element={<BroadcastPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
      </Routes>
    </AdminLayout>
  );
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
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
