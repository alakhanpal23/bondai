// GET /api/inquiries?key=YOUR_KEY — view stored inquiries.
// Set INQUIRY_KEY in Vercel project env vars to enable.
export default async function handler(req, res) {
  const key = process.env.INQUIRY_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, error: 'Set INQUIRY_KEY env var in Vercel to enable this endpoint.' });
  }
  if ((req.query.key || '') !== key) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  try {
    const { kv } = await import('@vercel/kv');
    const raw = await kv.lrange('inquiries', 0, 199);
    const items = raw.map(r => { try { return JSON.parse(r); } catch { return r; } });
    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'Vercel KV not configured. Create a KV store in the Vercel dashboard and link it to this project.' });
  }
}
