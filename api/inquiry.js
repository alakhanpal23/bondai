// POST /api/inquiry — stores contact-form submissions in Neon Postgres.
// Falls back to runtime-log capture if the database is unreachable.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

async function notifyFounders(entry) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'email not configured' };

  const from = process.env.INQUIRY_FROM_EMAIL || 'Kara Labs <onboarding@resend.dev>';
  const fields = [
    ['Name', entry.name || '—'], ['Email', entry.email], ['Organization', entry.org || '—'],
    ['Subject', entry.subject || '—'], ['Message', entry.msg]
  ];
  const html = `<h2>New Kara inquiry</h2><table>${fields.map(([label, value]) =>
    `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
  ).join('')}</table>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: ['founders@karalabs.ai'], reply_to: entry.email,
      subject: `New inquiry: ${entry.subject || entry.name || 'Kara Labs'}`, html })
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
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
    // tables created before the topic → subject rename lack the column
    await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS subject TEXT`;
    await sql`INSERT INTO inquiries (name, email, org, subject, msg)
              VALUES (${entry.name}, ${entry.email}, ${entry.org}, ${entry.subject}, ${entry.msg})`;
    let email = { sent: false };
    try { email = await notifyFounders(entry); }
    catch (error) { console.error('KARA_INQUIRY_EMAIL_ERROR', String(error.message)); }
    return res.status(200).json({ ok: true, stored: 'db', emailSent: email.sent });
  } catch (e) {
    console.log('KARA_INQUIRY_DB_ERROR', String(e && e.message));
    return res.status(200).json({ ok: true, stored: 'log' });
  }
}
