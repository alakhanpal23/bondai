// POST /api/inquiry — persist submissions and send email through Kara Workspace.
async function notifyWorkspace(entry) {
  const url = process.env.GOOGLE_WORKSPACE_EMAIL_WEBHOOK_URL;
  const token = process.env.GOOGLE_WORKSPACE_EMAIL_WEBHOOK_TOKEN;
  if (!url || !token) return { sent: false, reason: 'Workspace email not configured' };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, inquiry: entry }),
  });
  if (!response.ok) throw new Error(`Workspace email webhook returned ${response.status}`);
  const result = await response.json().catch(() => ({}));
  if (!result.ok) throw new Error(result.error || 'Workspace email webhook failed');
  return { sent: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  const b = req.body || {};
  const entry = {
    name: String(b.name || '').slice(0, 200),
    email: String(b.email || '').slice(0, 200),
    org: String(b.org || '').slice(0, 200),
    subject: String(b.subject || '').slice(0, 50),
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
      name TEXT, email TEXT, org TEXT, subject TEXT, msg TEXT,
      ts TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS subject TEXT`;
    await sql`INSERT INTO inquiries (name, email, org, subject, msg)
              VALUES (${entry.name}, ${entry.email}, ${entry.org}, ${entry.subject}, ${entry.msg})`;

    let email = { sent: false };
    try { email = await notifyWorkspace(entry); }
    catch (error) { console.error('KARA_INQUIRY_EMAIL_ERROR', String(error.message)); }
    return res.status(200).json({ ok: true, stored: 'db', emailSent: email.sent });
  } catch (error) {
    console.log('KARA_INQUIRY_DB_ERROR', String(error && error.message));
    return res.status(200).json({ ok: true, stored: 'log' });
  }
}
