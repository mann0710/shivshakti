// PDF service: renders the app's document HTML in headless Chrome. Staff only.
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const MAX_HTML = 3.5 * 1024 * 1024;
// Documents embed their images; only Google Fonts may load from the network.
const ALLOWED = [/^data:/, /^about:blank/, /^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function isStaff(token) {
  if (!token || !SUPABASE_URL || !ANON_KEY) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  return r.ok && (await r.json()) === true;
}

let launching = null;
// One browser per warm instance; CHROME_PATH runs a local Chrome for testing.
function browser() {
  launching ??= (async () => {
    const local = process.env.CHROME_PATH;
    return puppeteer.launch(local
      ? { executablePath: local, headless: true }
      : { args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  })().catch(e => { launching = null; throw e; });
  return launching;
}

const footerTemplate = text => `<div style="font-family:Arial,sans-serif;font-size:8px;color:#5C5C6B;width:100%;padding:0 13mm;display:flex;justify-content:space-between">
<span>${esc(text)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

async function render(html, footer) {
  const page = await (await browser()).newPage();
  try {
    await page.setRequestInterception(true);
    page.on('request', r => (ALLOWED.some(rx => rx.test(r.url())) ? r.continue() : r.abort()));
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(footer),
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(footer),
    });
  } finally {
    await page.close().catch(() => undefined);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await isStaff(token))) return res.status(401).json({ error: 'Sign in as staff' });
    const { html, footer } = req.body || {};
    if (typeof html !== 'string' || !/^<!doctype html>/i.test(html) || html.length > MAX_HTML) return res.status(400).json({ error: 'Bad document' });
    const pdf = await render(html, typeof footer === 'string' ? footer.slice(0, 200) : '');
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error('pdf failed', e);
    return res.status(500).json({ error: 'Could not make the PDF' });
  }
};

module.exports.render = render;
