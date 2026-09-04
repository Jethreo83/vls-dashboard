import { useEffect, useState } from 'react';
import { api, type Task } from '../api';
import { useAuth } from '../auth';

const STATUS_OPTIONS: Task['status'][] = ['open', 'in_progress', 'done', 'cancelled'];
const PRIORITY_OPTIONS: Task['priority'][] = ['low', 'normal', 'high', 'urgent'];

export default function TaskManagerPage() {
  const { staff } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    api.listTasks().then(setTasks).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !staff) return;
    setCreating(true);
    try {
      await api.createTask({
        title: newTitle,
        priority: newPriority,
        due_date: newDueDate || undefined,
        created_by: staff.google_email,
      });
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('normal');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (task: Task, status: Task['status']) => {
    try {
      await api.updateTask(task.id, { status });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>{error}</p>;
  if (!tasks) return <p>Loading…</p>;

  const active = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled');
  const overdue = active.filter((t) => t.due_date && t.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="vls-cards">
        <div className="vls-card"><div className="label">Active</div><div className="value">{active.length}</div></div>
        <div className="vls-card"><div className="label">Overdue</div><div className={`value ${overdue.length > 0 ? 'warn' : ''}`}>{overdue.length}</div></div>
        <div className="vls-card"><div className="label">Completed</div><div className="value ok">{done.length}</div></div>
      </div>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="vls-input"
          placeholder="New task title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="vls-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value as Task['priority'])}>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="date"
          className="vls-input"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
        />
        <button type="submit" className="vls-btn" disabled={creating || !newTitle.trim()}>Add Task</button>
      </form>

      <h3 style={{ fontSize: 15, color: 'var(--vls-maroon)', marginBottom: 12 }}>Active ({active.length})</h3>
      <TaskTable tasks={active} onStatusChange={handleStatusChange} />

      <h3 style={{ marginTop: 32, fontSize: 15, color: 'var(--vls-gray)' }}>Completed / Cancelled ({done.length})</h3>
      <TaskTable tasks={done} onStatusChange={handleStatusChange} />
    </div>
  );
}

function TaskTable({ tasks, onStatusChange }: { tasks: Task[]; onStatusChange: (t: Task, s: Task['status']) => void }) {
  if (tasks.length === 0) return <p style={{ color: 'var(--vls-gray)' }}>None.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <table className="vls-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Priority</th>
          <th>Due</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => {
          const isOverdue = t.due_date && t.due_date.slice(0, 10) < today && (t.status === 'open' || t.status === 'in_progress');
          return (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td style={{ textTransform: 'capitalize' }}>{t.priority}</td>
              <td style={{ color: isOverdue ? 'var(--vls-danger)' : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                {t.due_date ? t.due_date.slice(0, 10) : '—'}{isOverdue ? ' (overdue)' : ''}
              </td>
              <td>
                <select className="vls-select" value={t.status} onChange={(e) => onStatusChange(t, e.target.value as Task['status'])}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
