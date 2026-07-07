// GET /api/inquiries?key=YOUR_KEY — view stored inquiries from Neon.
// Set INQUIRY_KEY in Vercel project env vars to enable.
export default async function handler(req, res) {
  const key = process.env.INQUIRY_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, error: 'Set INQUIRY_KEY env var in Vercel project settings to enable this endpoint.' });
  }
  if ((req.query.key || '') !== key) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  try {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('database env not configured');
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    const items = await sql`SELECT id, name, email, org, topic, msg, ts
                            FROM inquiries ORDER BY id DESC LIMIT 200`;
    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'Database not reachable: ' + String(e && e.message) });
  }
}
