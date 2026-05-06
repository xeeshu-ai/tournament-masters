import React from 'react';

export const GameContext = React.createContext(null);

export function useGame() {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameContext.Provider');
  return ctx;
}
