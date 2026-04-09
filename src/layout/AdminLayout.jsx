import React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabaseAdmin } from '../supabaseClient'

const navItems = [
  { to: '', label: 'Overview' },
  { to: 'players', label: 'Players' },
  { to: 'tournaments', label: 'Tournaments' },
  { to: 'registrations', label: 'Registrations' },
  { to: 'brackets', label: 'Bracket Manager' },
  { to: 'results', label: 'Results Entry' },
  { to: 'payments', label: 'Payments' },
  { to: 'rooms', label: 'Room Codes' },
  { to: 'names', label: 'Name Changes' },
  { to: 'bans', label: 'Ban Manager' },
  { to: 'broadcast', label: 'Broadcast' },
  { to: 'complaints', label: 'Complaints' },
]

export function AdminLayout({ user, children }) {
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const handleLogout = async () => {
    await supabaseAdmin.auth.signOut()
    navigate('login')
  }

  const NavLinks = ({ onNavigate }) => (
    <nav className="space-y-1 text-sm">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === ''}
          onClick={onNavigate}
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
  )

  const BrandBlock = () => (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
        <span className="text-sm font-black">T</span>
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Master panel</p>
        <p className="text-sm font-semibold">Tournvia</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-slate-950 px-4 py-4 transition-transform duration-200 md:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-4">
          <BrandBlock />
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <NavLinks onNavigate={() => setDrawerOpen(false)} />
        <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400">
          {user && <p className="mb-2 truncate">{user.email}</p>}
          <button onClick={handleLogout} className="btn-secondary w-full text-xs">
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 flex-shrink-0 border-r border-slate-800 bg-slate-950/90 px-4 py-4 md:block">
          <div className="pb-4">
            <BrandBlock />
          </div>
          <NavLinks onNavigate={() => {}} />
        </aside>

        <main className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
            {/* Mobile: hamburger + title */}
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={() => setDrawerOpen(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18"/>
                </svg>
              </button>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Tournvia master
              </p>
            </div>

            {/* Desktop: brand */}
            <div className="hidden items-center gap-2 md:flex">
              <Link to="" className="flex items-center gap-2">
                <BrandBlock />
              </Link>
            </div>

            {/* Right: user + logout */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {user ? (
                <>
                  <span className="hidden md:inline">
                    Signed in as <span className="text-slate-100">{user.email}</span>
                  </span>
                  <button onClick={handleLogout} className="btn-secondary text-xs">
                    Logout
                  </button>
                </>
              ) : (
                <span>Checking admin session</span>
              )}
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 px-4 py-4">
            {children}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
