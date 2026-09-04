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

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!tasks) return <p>Loading…</p>;

  const active = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled');

  return (
    <div>
      <h2>Task Manager</h2>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="New task title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: 6 }}
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as Task['priority'])} style={{ padding: 6 }}>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          style={{ padding: 6 }}
        />
        <button type="submit" disabled={creating || !newTitle.trim()}>Add Task</button>
      </form>

      <h3>Active ({active.length})</h3>
      <TaskTable tasks={active} onStatusChange={handleStatusChange} />

      <h3 style={{ marginTop: 32, color: '#666' }}>Completed / Cancelled ({done.length})</h3>
      <TaskTable tasks={done} onStatusChange={handleStatusChange} />
    </div>
  );
}

function TaskTable({ tasks, onStatusChange }: { tasks: Task[]; onStatusChange: (t: Task, s: Task['status']) => void }) {
  if (tasks.length === 0) return <p style={{ color: '#666' }}>None.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
          <th style={{ padding: 8 }}>Title</th>
          <th style={{ padding: 8 }}>Priority</th>
          <th style={{ padding: 8 }}>Due</th>
          <th style={{ padding: 8 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => {
          const isOverdue = t.due_date && t.due_date.slice(0, 10) < today && (t.status === 'open' || t.status === 'in_progress');
          return (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{t.title}</td>
              <td style={{ padding: 8, textTransform: 'capitalize' }}>{t.priority}</td>
              <td style={{ padding: 8, color: isOverdue ? '#b00' : undefined }}>
                {t.due_date ? t.due_date.slice(0, 10) : '—'}{isOverdue ? ' (overdue)' : ''}
              </td>
              <td style={{ padding: 8 }}>
                <select value={t.status} onChange={(e) => onStatusChange(t, e.target.value as Task['status'])}>
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
