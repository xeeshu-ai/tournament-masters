import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GAMES } from '../constants';
import { supabaseAuth } from '../supabaseClient';

const GAME_COLORS = {
  orange: {
    ring: 'ring-orange-500/60',
    badge: 'bg-orange-500/15 text-orange-300',
    icon: 'bg-orange-500/20 text-orange-300',
    hover: 'hover:border-orange-500/50 hover:bg-slate-900/80',
    glow: 'shadow-orange-500/10',
    singleBtn: 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/60',
    longBtn: 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/60',
  },
  blue: {
    ring: 'ring-blue-500/60',
    badge: 'bg-blue-500/15 text-blue-300',
    icon: 'bg-blue-500/20 text-blue-300',
    hover: 'hover:border-blue-500/50 hover:bg-slate-900/80',
    glow: 'shadow-blue-500/10',
    singleBtn: 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/60',
    longBtn: 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/60',
  },
  red: {
    ring: 'ring-red-500/60',
    badge: 'bg-red-500/15 text-red-300',
    icon: 'bg-red-500/20 text-red-300',
    hover: 'hover:border-red-500/50 hover:bg-slate-900/80',
    glow: 'shadow-red-500/10',
    singleBtn: 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/60',
    longBtn: 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/60',
  },
};

// ─── Game Hub ────────────────────────────────────────────────────────────────
// Shown after selecting a game — two big action cards.
function GameHub({ game, onBack, navigate }) {
  const c = GAME_COLORS[game.color] || GAME_COLORS.blue;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Back bar */}
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Games
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-200">{game.label}</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Game title */}
        <div className="mb-10 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black ${c.icon}`}>
            {game.shortLabel}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{game.label}</h1>
          <p className="mt-2 text-sm text-slate-400">Choose the tournament type you want to manage</p>
        </div>

        {/* Two big cards */}
        <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Single Matches */}
          <button
            type="button"
            onClick={() => navigate(`/${game.id}/single-tournaments`)}
            className={`flex flex-col items-start rounded-xl border p-6 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 ${c.singleBtn}`}
          >
            {/* Icon */}
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-300">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-base font-semibold text-sky-200">Single Matches</p>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              One match per tournament — BR, CS, LW or TDM. Results entered after the match ends.
            </p>
            <div className="mt-5 flex items-center gap-1.5 text-xs text-sky-400 font-medium">
              Manage
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>

          {/* Long Tournaments */}
          <button
            type="button"
            onClick={() => navigate(`/${game.id}/long-tournaments`)}
            className={`flex flex-col items-start rounded-xl border p-6 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 ${c.longBtn}`}
          >
            {/* Icon */}
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-300">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <p className="text-base font-semibold text-violet-200">Long Tournaments</p>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Multi-match events with bracket management, fixture generation and round tracking.
            </p>
            <div className="mt-5 flex items-center gap-1.5 text-xs text-violet-400 font-medium">
              Manage
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        </div>

        {/* Or go to full game dashboard */}
        <button
          type="button"
          onClick={() => navigate(`/${game.id}`)}
          className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition underline underline-offset-4"
        >
          Open full {game.label} dashboard →
        </button>
      </main>
    </div>
  );
}

// ─── Game Select Page ─────────────────────────────────────────────────────────
export function GameSelectPage({ user }) {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = React.useState(null);

  const handleLogout = async () => {
    await supabaseAuth.auth.signOut();
    navigate('/login');
  };

  // If a game is selected, show the hub
  if (selectedGame) {
    return (
      <GameHub
        game={selectedGame}
        onBack={() => setSelectedGame(null)}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
            <span className="text-sm font-black">T</span>
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Master Panel</p>
            <p className="text-sm font-bold">Tournvia</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/players')}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Players
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">
              Signed in as <span className="text-slate-200">{user?.email}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Game grid */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">Admin Panel</p>
          <h1 className="text-2xl font-bold text-slate-100">Select a Game</h1>
          <p className="mt-2 text-sm text-slate-400">Choose which game you want to manage</p>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => {
            const c = GAME_COLORS[game.color] || GAME_COLORS.blue;
            return (
              <button
                key={game.id}
                onClick={() => game.active && setSelectedGame(game)}
                disabled={!game.active}
                className={[
                  'relative flex flex-col items-start rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-left transition-all duration-150',
                  game.active
                    ? `cursor-pointer ${c.hover} hover:shadow-lg ${c.glow} focus-visible:outline-none focus-visible:ring-2 ${c.ring}`
                    : 'cursor-not-allowed opacity-40',
                ].join(' ')}
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black ${c.icon}`}>
                  {game.shortLabel}
                </div>
                <p className="text-sm font-semibold text-slate-100">{game.label}</p>
                <p className="mt-1 text-xs text-slate-400">{game.description}</p>
                <div className="mt-4">
                  {game.active ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.badge}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Coming soon
                    </span>
                  )}
                </div>
                {game.active && (
                  <svg
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
