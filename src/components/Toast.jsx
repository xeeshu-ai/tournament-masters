import React from 'react';

export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const color = type === 'error' ? 'text-red-300' : 'text-emerald-300';
  return (
    <div className="toast" role="status">
      <div className={`text-11px ${color}`}>{message}</div>
      <button
        type="button"
        className="mt-1 text-11px text-slate-400 hover:text-slate-200"
        onClick={onClose}
      >
        Dismiss
      </button>
    </div>
  );
}
