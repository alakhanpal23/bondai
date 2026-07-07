// POST /api/inquiry — stores contact-form submissions.
// Persists to Vercel KV when configured; always logs so submissions
// are visible in Vercel runtime logs regardless.
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
    const { kv } = await import('@vercel/kv');
    await kv.lpush('inquiries', JSON.stringify(entry));
    await kv.ltrim('inquiries', 0, 999);
    return res.status(200).json({ ok: true, stored: 'kv' });
  } catch (e) {
    // KV not configured yet: submission still captured in logs
    return res.status(200).json({ ok: true, stored: 'log' });
  }
}
