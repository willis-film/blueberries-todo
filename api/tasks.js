import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — load all tasks
    if (req.method === 'GET') {
      const tasks = await sql`SELECT * FROM tasks ORDER BY added ASC`;
      return res.status(200).json(tasks);
    }

    // POST — save all tasks (full sync)
    if (req.method === 'POST') {
      const { tasks } = req.body;
      if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Invalid tasks array' });
      }

      // Upsert all tasks
      for (const t of tasks) {
        await sql`
          INSERT INTO tasks (id, text, notes, due, priority, tags, subtasks, done, added, bucket, quickable, effort, updated_at)
          VALUES (
            ${t.id}, ${t.text}, ${t.notes||''}, ${t.due||''}, ${t.priority||2},
            ${JSON.stringify(t.tags||[])}, ${JSON.stringify(t.subtasks||[])},
            ${t.done||false}, ${t.added||Date.now()}, ${t.bucket||'inbox'},
            ${t.quickable}, ${t.effort||null}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            text=${t.text}, notes=${t.notes||''}, due=${t.due||''},
            priority=${t.priority||2}, tags=${JSON.stringify(t.tags||[])},
            subtasks=${JSON.stringify(t.subtasks||[])}, done=${t.done||false},
            bucket=${t.bucket||'inbox'}, quickable=${t.quickable},
            effort=${t.effort||null}, updated_at=NOW()
        `;
      }

      // Delete tasks that are no longer in the list
      if (tasks.length > 0) {
        const ids = tasks.map(t => t.id);
        await sql`DELETE FROM tasks WHERE id != ALL(${ids})`;
      } else {
        await sql`DELETE FROM tasks`;
      }

      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error('Tasks API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
