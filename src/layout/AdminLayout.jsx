import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/players', label: 'Players' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/brackets', label: 'Bracket Manager' },
  { to: '/results', label: 'Results Entry' },
  { to: '/payments', label: 'Payments' },
  { to: '/rooms', label: 'Room Codes' },
  { to: '/names', label: 'Name Changes' },
  { to: '/bans', label: 'Ban Manager' },
  { to: '/broadcast', label: 'Broadcast' },
  { to: '/complaints', label: 'Complaints' },
];

export function AdminLayout({ user, children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabaseAdmin.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 border-r border-slate-800 bg-slate-950/90 px-4 py-4 md:block">
          <div className="flex items-center gap-2 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
              <span className="text-sm font-black">T</span>
            </div>
            <div className="leading-tight">
              <p className="text-11px font-semibold uppercase tracking-[0.16em] text-slate-400">
                Master panel
              </p>
              <p className="text-sm font-semibold">Tournvia</p>
            </div>
          </div>
          <nav className="space-y-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'block rounded-lg bg-sky-500/10 px-3 py-2 text-sky-300'
                    : 'block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-900/70 hover:text-sky-200'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
            <div className="md:hidden">
              <p className="text-11px font-semibold uppercase tracking-[0.18em] text-slate-400">
                Tournvia master
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
                  <span className="text-sm font-black">T</span>
                </div>
                <div className="leading-tight">
                  <p className="text-11px font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Tournvia master panel
                  </p>
                  <p className="text-xs text-slate-400">Free Fire esports control center</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {user ? (
                <>
                  <span>
                    Signed in as <span className="text-slate-100">{user.email}</span>
                  </span>
                  <button type="button" className="btn-secondary" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <span>Checking admin session…</span>
              )}
            </div>
          </header>
          <div className="px-4 py-4">
  {children}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
