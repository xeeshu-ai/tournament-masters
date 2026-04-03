import React from 'react';

export function ConfirmDialog({ open, title, description, confirmLabel, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="card max-w-sm space-y-3 text-xs text-slate-200">
        <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
        {description && <p className="text-11px text-slate-400">{description}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
