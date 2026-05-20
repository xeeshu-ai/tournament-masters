import React from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { supabaseAdmin } from '../supabaseClient'
import { GAMES } from '../constants'

const navItems = [
  { to: '', label: 'Overview', end: true },
  { to: 'players', label: 'Players' },
  // Tournament pages — two dedicated routes
  { to: 'single-tournaments', label: 'Single Matches' },
  { to: 'long-tournaments', label: 'Long Tournaments' },
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

const GAME_ACCENT = {
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
}

// Nav item accent colours for the two tournament routes
const NAV_ACCENT = {
  'single-tournaments': { active: 'bg-sky-500/10 text-sky-300', dot: 'bg-sky-500' },
  'long-tournaments':   { active: 'bg-violet-500/10 text-violet-300', dot: 'bg-violet-500' },
}

export function AdminLayout({ user, children }) {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const game = GAMES.find((g) => g.id === gameId)

  const handleLogout = async () => {
    await supabaseAdmin.auth.signOut()
    navigate('/login')
  }

  const handleSwitchGame = () => {
    navigate('/games')
  }

  const NavLinks = ({ onNavigate }) => (
    <nav className="space-y-0.5 text-sm">
      {navItems.map((item) => {
        const accent = NAV_ACCENT[item.to]
        const fullPath = item.to === '' ? `/${gameId}` : `/${gameId}/${item.to}`
        return (
          <NavLink
            key={item.to}
            to={fullPath}
            end={item.end || false}
            onClick={onNavigate}
            className={({ isActive }) => {
              const base = 'flex items-center gap-2 rounded-lg px-3 py-2 transition'
              if (isActive) {
                return `${base} ${accent ? accent.active : 'bg-sky-500/10 text-sky-300'}`
              }
              return `${base} text-slate-300 hover:bg-slate-900/70 hover:text-sky-200`
            }}
          >
            {/* Coloured dot for tournament routes */}
            {accent && (
              <span className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${accent.dot}`} />
            )}
            {item.label}
          </NavLink>
        )
      })}
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

  const GameBadge = () =>
    game ? (
      <div className="mt-4 mb-2">
        <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
          GAME_ACCENT[game.color] || GAME_ACCENT.blue
        }`}>
          <div>
            <p className="font-semibold">{game.label}</p>
            <p className="opacity-70 text-[10px] mt-0.5">{game.description}</p>
          </div>
          <button onClick={handleSwitchGame} title="Switch game" className="ml-2 rounded p-1 opacity-60 transition hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h7" />
              <path d="M15 15l3 3 3-3" />
            </svg>
          </button>
        </div>
      </div>
    ) : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {drawerOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-slate-950 px-4 py-4 transition-transform duration-200 md:hidden ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between pb-2">
          <BrandBlock />
          <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <GameBadge />
        <NavLinks onNavigate={() => setDrawerOpen(false)} />
        <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400">
          {user && <p className="mb-2 truncate">{user.email}</p>}
          <button onClick={handleLogout} className="btn-secondary w-full text-xs">Logout</button>
        </div>
      </aside>

      <div className="flex min-h-screen">
        <aside className="hidden w-60 flex-shrink-0 border-r border-slate-800 bg-slate-950/90 px-4 py-4 md:block">
          <div className="pb-2"><BrandBlock /></div>
          <GameBadge />
          <NavLinks onNavigate={() => {}} />
        </aside>

        <main className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
            <div className="flex items-center gap-3 md:hidden">
              <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="Open menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
              {game && <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{game.label}</span>}
            </div>
            <div className="hidden items-center gap-2 text-sm md:flex">
              <button onClick={handleSwitchGame} className="text-slate-400 hover:text-slate-200 transition">Games</button>
              {game && (
                <>
                  <span className="text-slate-700">/</span>
                  <span className="font-medium text-slate-200">{game.label}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {user ? (
                <>
                  <span className="hidden md:inline">Signed in as <span className="text-slate-100">{user.email}</span></span>
                  <button onClick={handleLogout} className="btn-secondary text-xs">Logout</button>
                </>
              ) : (
                <span>Checking admin session…</span>
              )}
            </div>
          </header>
          <div className="flex-1 px-4 py-4">
            {children}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
