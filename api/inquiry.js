// POST /api/inquiry — stores contact-form submissions in Neon Postgres.
// Falls back to runtime-log capture if the database is unreachable.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }
  const b = req.body || {};
  const entry = {
    name: String(b.name || '').slice(0, 200),
    email: String(b.email || '').slice(0, 200),
    org: String(b.org || '').slice(0, 200),
    topic: String(b.topic || '').slice(0, 100),
    msg: String(b.msg || '').slice(0, 4000),
    ts: new Date().toISOString(),
  };
  if (!entry.email || !entry.msg) {
    return res.status(400).json({ ok: false, error: 'email and message required' });
  }
  console.log('KARA_INQUIRY', JSON.stringify(entry));
  try {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('database env not configured');
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    await sql`CREATE TABLE IF NOT EXISTS inquiries (
      id SERIAL PRIMARY KEY,
      name TEXT, email TEXT, org TEXT, topic TEXT, msg TEXT,
      ts TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`INSERT INTO inquiries (name, email, org, topic, msg)
              VALUES (${entry.name}, ${entry.email}, ${entry.org}, ${entry.topic}, ${entry.msg})`;
    return res.status(200).json({ ok: true, stored: 'db' });
  } catch (e) {
    console.log('KARA_INQUIRY_DB_ERROR', String(e && e.message));
    return res.status(200).json({ ok: true, stored: 'log' });
  }
}
