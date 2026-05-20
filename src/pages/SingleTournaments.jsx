import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseAdmin } from '../supabaseClient';
import { TournamentForm, SingleTournamentRow, ArchivedSection, emptyForm } from '../components/TournamentShared';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

export function SingleTournamentsPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tournaments, setTournaments] = React.useState([]);
  const [archived, setArchived] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [confirmArchive, setConfirmArchive] = React.useState({ open: false });
  const [confirmDelete, setConfirmDelete] = React.useState({ open: false });
  const [toast, setToast] = React.useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('game_id', gameId)
      .eq('type', 'single')
      .order('start_time', { ascending: true });
    if (error) { console.error(error); setLoading(false); return; }
    setTournaments((data || []).filter((t) => !t.is_archived));
    setArchived((data || []).filter((t) => t.is_archived));
    setLoading(false);
  };

  React.useEffect(() => { load(); }, [gameId]);

  React.useEffect(() => {
    const editId = searchParams.get('editId');
    if (!editId || !tournaments.length) return;
    const t = tournaments.find((tt) => String(tt.id) === String(editId));
    if (!t) return;
    setEditing(t);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('editId');
    setSearchParams(next, { replace: true });
  }, [searchParams, tournaments, setSearchParams]);

  const openCreate = () => { setEditing({ ...emptyForm, type: 'single' }); setFormOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };
  const openArchive = (t) => setConfirmArchive({ open: true, id: t.id });
  const openDelete = (t) => setConfirmDelete({ open: true, id: t.id, title: t.title });

  const handleArchiveConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').update({ is_archived: true }).eq('id', confirmArchive.id);
    if (error) { notify('Failed to archive.', 'error'); return; }
    notify('Tournament archived.');
    setConfirmArchive({ open: false });
    load();
  };

  const handleDeleteConfirmed = async () => {
    const { error } = await supabaseAdmin.from('tournaments').delete().eq('id', confirmDelete.id);
    if (error) { notify('Failed to delete.', 'error'); return; }
    notify('Tournament deleted permanently.');
    setConfirmDelete({ open: false });
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-full bg-sky-500" />
            <h1 className="text-xl font-semibold text-slate-50">Single-match tournaments</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-3">One match per tournament — BR, CS, LW, or TDM format.</p>
        </div>
        <button type="button" className="btn-primary text-xs shrink-0" onClick={openCreate}>
          + New single match
        </button>
      </header>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : tournaments.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-slate-500">No single-match tournaments yet for this game.</p>
            <button type="button" className="btn-secondary text-xs" onClick={openCreate}>Create your first one</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th><th>Mode</th><th>Format</th><th>Entry</th><th>Slots</th><th>Reg</th><th>Start</th><th></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <SingleTournamentRow
                  key={t.id}
                  t={t}
                  gameId={gameId}
                  onEdit={openEdit}
                  onArchive={openArchive}
                  onDelete={openDelete}
                  navigate={navigate}
                  detailPath={`/${gameId}/single-tournaments/${t.id}`}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ArchivedSection archived={archived} onDelete={openDelete} />

      <TournamentForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSaved={load} gameId={gameId} />
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <ConfirmDialog open={confirmArchive.open} title="Archive tournament?" description="Archived tournaments are hidden from lists but kept in the database." confirmLabel="Archive" onCancel={() => setConfirmArchive({ open: false })} onConfirm={handleArchiveConfirmed} />
      <ConfirmDialog open={confirmDelete.open} title={`Delete "${confirmDelete.title}"?`} description="This will permanently delete the tournament and all its registrations. This cannot be undone." confirmLabel="Delete permanently" onCancel={() => setConfirmDelete({ open: false })} onConfirm={handleDeleteConfirmed} />
    </div>
  );
}
