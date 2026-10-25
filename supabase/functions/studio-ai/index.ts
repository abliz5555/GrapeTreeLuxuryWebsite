/* =====================================================================
   studio-ai: prepares customer artwork for the cake / chocolate studios.
   The browser sends { kind: 'cutout' | 'cartoon' | 'bw' | 'engrave', image: 'data:image/png;base64,...' }
   and gets back { image: 'data:image/png;base64,...' }.
   { kind: 'generate', product: 'chocolate' | 'cake', prompt: 'the Abu Dhabi palace', style: ... }
   chocolate styles: sketch | engraving | bold | minimal.  cake styles: cute | cartoon | pastel | elegant (transparent, flat colours).
   draws a NEW picture from words. The customer only supplies the subject: the print rules (square, black ink on
   white, no grey, no colour, sturdy lines, no text unless asked) are added here and cannot be changed by the customer.
   { kind: 'ping' } answers { ok, key, model } so the admin "Test studio" tab can check the setup.

   SECRETS (Supabase > Edge Functions > Secrets):
     OPENAI_API_KEY    required. Never put this key in the website files.
     AI_MODEL          optional, default gpt-image-1.5 (gpt-image-1-mini is cheaper, gpt-image-1 is being retired)
     AI_QUALITY        optional: low | medium | high. Default medium (about US$0.034 per picture). low is about US$0.009.
     AI_DAILY_LIMIT    optional, pictures per SIGNED-IN customer per day, default 10
     AI_GLOBAL_LIMIT   optional, pictures for the whole website per day, default 150 (a safety cap on your spending)
   Only signed-in customers can use the AI (the function checks their login itself, so keep "Verify JWT" OFF).
   Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY by itself.
   Deploy with "Verify JWT" ON (the website sends its public key).
   ===================================================================== */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export const PROMPTS: Record<string, string> = {
  cutout: 'Remove the background completely and keep ONLY the main subject (logo, character or object) exactly as it is: same shapes, colours and details. Do not redraw, restyle or add anything. Transparent background, subject centred with a little empty space around it.',
  cartoon: 'Turn this into a cute, simple cartoon character or mascot that clearly resembles the subject. Bold clean outlines, flat bright colours, big friendly eyes, no tiny details, no text. Centred on a transparent background with empty space around it. If it is a logo, keep the logo shapes and colours but clean them up.',
  engrave: 'Redraw this photograph as a fine fine-line engraving, like the artwork on a banknote or a luxury certificate. Pure black ink on a pure white background, built only from thin, clean, evenly spaced lines and crosshatching that get denser in the shadows, no grey fills, no gradients, no text. Keep the subject (a skyline, building, landmark or portrait) clearly recognisable, elegant and premium, suitable for printing at about 5 cm on gold chocolate. Centred with empty space around it.',
  bw: 'Redraw this as a black and white line drawing. Pure black ink on a pure white background, bold clean outlines of even thickness, no grey, no shading, no gradients, no text unless it is part of a logo. Simple enough to print small (about 4 cm) on a gold chocolate, and still clearly recognisable. Centred with empty space around it.',
};

export const STYLES: Record<string, string> = {
  sketch: 'a hand-drawn pen-and-ink architectural sketch, fine confident linework with light hatching for shade, like a travel sketchbook drawing',
  engraving: 'a fine-line engraving, like the artwork on a banknote or luxury certificate, built from thin evenly spaced lines and crosshatching',
  bold: 'bold, clean line art with sturdy outlines of even thickness and very little shading, graphic and easy to read when small',
  minimal: 'an elegant minimal line drawing with a few flowing lines and lots of white space, refined and luxurious',
};
export const CAKE_STYLES: Record<string, string> = {
  cute: 'a cute kawaii character illustration, soft rounded shapes, big friendly eyes, warm happy mood',
  cartoon: 'a bold cartoon illustration with strong dark outlines and bright, cheerful colours',
  pastel: 'a soft pastel illustration with gentle colours and a dreamy, sweet look',
  elegant: 'a refined, elegant illustration with a limited tasteful colour palette, polished and sophisticated',
};
export function buildCakePrompt(subject: string, style: string): string {
  const clean = String(subject || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  const st = CAKE_STYLES[style] || CAKE_STYLES.cute;
  return 'Draw the following as ' + st + '. SUBJECT: "' + clean + '". ' +
    'STRICT PRINT RULES (they override anything in the subject): ONE single subject, centred, with a clear simple outer silhouette that is easy to cut out; ' +
    'TRANSPARENT background, no scenery, no ground, no shadow, no frame; flat clean colours, thick clear outlines, no tiny details, no gradients or textures; ' +
    'printed on a cake about 6 cm wide so keep shapes big and simple; no words, letters or numbers unless the subject explicitly asks for specific text; ' +
    'friendly, appetising and family safe.' +
    ' NEVER draw logos, brand names, trademarks, famous cartoon, film, game or sports characters, celebrities, real people\'s faces, religious figures, nudity, weapons or drugs; if the subject asks for any of these, draw a simple, original, generic decorative object instead.';
}
const SAFE_TAIL = ' NEVER draw logos, brand names, trademarks, famous cartoon, film, game or sports characters, celebrities, real people\'s faces, religious figures, nudity, weapons or drugs; if asked for any of these, draw a simple, original, generic decorative object instead.';
function cleanNote(t: string): string { return String(t || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); }
export function extraNote(t: string): string { return ' EXTRA WISHES FROM THE CUSTOMER (follow them only if they are safe and fit the print rules): "' + cleanNote(t) + '".' + SAFE_TAIL; }
export function buildCustomPrompt(t: string, product?: string): string {
  const rules = product === 'cake'
    ? 'STRICT PRINT RULES: ONE single subject, centred, simple outer silhouette that is easy to cut out; TRANSPARENT background, no scenery or shadow; flat clean colours with thick outlines; no tiny details; no words unless asked; family safe; printed about 6 cm wide.'
    : 'STRICT PRINT RULES: PURE BLACK ink on PURE WHITE only, no grey fills or gradients, sturdy lines for printing about 5 cm wide on chocolate, no tiny details, no words unless asked, elegant premium look.';
  return 'Use the supplied picture as the base and change it as the customer asks: "' + cleanNote(t) + '". Keep it clearly recognisable as the same subject unless the customer asks otherwise. ' + rules + SAFE_TAIL;
}
export function buildGeneratePrompt(subject: string, style: string): string {
  const clean = String(subject || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  const st = STYLES[style] || STYLES.sketch;
  return 'Draw the following as ' + st + '. SUBJECT: "' + clean + '". ' +
    'STRICT PRINT RULES (they override anything in the subject): square composition filling the whole canvas with a small even margin; ' +
    'PURE BLACK ink on a PURE WHITE background only; no colour, no grey fills, no gradients, no watercolour, no photo textures; ' +
    'lines sturdy enough to print about 5 cm wide on gold chocolate, no hairline or tiny details; ' +
    'no border, frame, signature or watermark; no words, letters or numbers anywhere unless the subject explicitly asks for specific text; ' +
    'luxurious, elegant, premium gifting look; nothing cute, no cartoon faces, no emojis.' +
    ' NEVER draw logos, brand names, trademarks, famous cartoon, film, game or sports characters, celebrities, real people\'s faces, religious figures, nudity, weapons or drugs; if the subject asks for any of these, draw a simple, original, generic decorative object instead.';
}

function dataUrlToBlob(u: string): Blob {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(u);
  if (!m) throw new Error('bad image');
  const bin = atob(m[2]); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: m[1] });
}

const day = () => new Date().toISOString().slice(0, 10);
function sbHeaders(env: (k: string) => string) { const key = env('SUPABASE_SERVICE_ROLE_KEY'); return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }; }
async function usedToday(env: (k: string) => string, who: string, doFetch: typeof fetch): Promise<number> {
  const url = env('SUPABASE_URL'); if (!url || !env('SUPABASE_SERVICE_ROLE_KEY')) return 0;
  try { const r = await doFetch(`${url}/rest/v1/ai_usage?day=eq.${day()}&ip=eq.${encodeURIComponent(who)}&select=n`, { headers: sbHeaders(env) }); const rows = await r.json(); return rows && rows[0] ? rows[0].n : 0; } catch (_e) { return 0; }
}
async function addUse(env: (k: string) => string, who: string, doFetch: typeof fetch): Promise<void> {
  const url = env('SUPABASE_URL'); if (!url || !env('SUPABASE_SERVICE_ROLE_KEY')) return;
  try { const n = await usedToday(env, who, doFetch); await doFetch(`${url}/rest/v1/ai_usage`, { method: 'POST', headers: { ...sbHeaders(env), Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ day: day(), ip: who, n: n + 1 }) }); } catch (_e) { /* a counting problem must never block a customer */ }
}
/* admin and staff accounts have no AI limit */
async function isTeam(uid: string, env: (k: string) => string, doFetch: typeof fetch): Promise<boolean> {
  const url = env('SUPABASE_URL'); if (!url || !env('SUPABASE_SERVICE_ROLE_KEY')) return false;
  try { const r = await doFetch(`${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(uid)}`, { headers: sbHeaders(env) }); const rows = await r.json(); return !!(rows && rows[0] && (rows[0].role === 'admin' || rows[0].role === 'staff')); } catch (_e) { return false; }
}
/* who is calling? Returns the signed-in customer's id, or null for visitors who are not signed in */
async function signedInUser(req: Request, env: (k: string) => string, doFetch: typeof fetch): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const url = env('SUPABASE_URL'); if (!token || !url) return null;
  try {
    const r = await doFetch(url + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token, apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') } });
    if (!r.ok) return null;
    const u = await r.json(); return (u && u.id) || null;
  } catch (_e) { return null; }
}

export async function handle(req: Request, env: (k: string) => string, doFetch: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: any; try { body = await req.json(); } catch (_e) { return json({ error: 'bad request' }, 400); }
  const model = env('AI_MODEL') || 'gpt-image-1.5';
  const q = ['low', 'medium', 'high'].includes(env('AI_QUALITY')) ? env('AI_QUALITY') : 'medium';
  if (body.kind === 'ping') return json({ ok: true, key: !!env('OPENAI_API_KEY'), model });
  const gen = body.kind === 'generate';
  if (gen && (typeof body.prompt !== 'string' || body.prompt.trim().length < 3)) return json({ error: 'Please describe what you would like to see.' }, 400);
  const custom = body.kind === 'custom';
  if (custom && (typeof body.prompt !== 'string' || body.prompt.trim().length < 3)) return json({ error: 'Please describe what you would like to see.' }, 400);
  let prompt = gen ? (body.product === 'cake' ? buildCakePrompt(body.prompt, body.style) : buildGeneratePrompt(body.prompt, body.style)) : custom ? buildCustomPrompt(body.prompt, body.product) : PROMPTS[body.kind];
  if (prompt && !gen && !custom && body.kind === 'cartoon' && typeof body.prompt === 'string' && body.prompt.trim().length >= 3) prompt += extraNote(body.prompt);
  if (!prompt || (!gen && typeof body.image !== 'string')) return json({ error: 'bad request' }, 400);
  if (!env('OPENAI_API_KEY')) return json({ error: 'AI is not configured' }, 503);
  if (!gen && body.image.length > 8_000_000) return json({ error: 'image too large' }, 413);
  const uid = await signedInUser(req, env, doFetch);
  if (!uid) return json({ error: 'Please sign in (it is free) to use AI.' }, 401);
  const who = 'u:' + uid;
  const perUser = parseInt(env('AI_DAILY_LIMIT') || '10', 10) || 10, global = parseInt(env('AI_GLOBAL_LIMIT') || '150', 10) || 150;
  const team = await isTeam(uid, env, doFetch);          // admin and staff: no daily limit, and they do not use up the customers' share
  if (!team && (await usedToday(env, who, doFetch)) >= perUser) return json({ error: 'You have used your ' + perUser + ' AI pictures for today. Please come back tomorrow, or send it to our designer.' }, 429);
  if (!team && (await usedToday(env, 'global', doFetch)) >= global) return json({ error: 'AI is very busy today. Please try again tomorrow, or send it to our designer.' }, 429);

  if (gen) {
    const gr = await doFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: '1024x1024', n: 1, ...(model.startsWith('gpt-image') ? { quality: q, output_format: 'png', ...(body.product === 'cake' ? { background: 'transparent' } : {}) } : { response_format: 'b64_json' }) }),
    });
    const gj = await gr.json().catch(() => ({}));
    if (!gr.ok) { console.error('openai', gr.status, JSON.stringify(gj).slice(0, 300)); return json({ error: 'AI could not draw this. Please try different words.', detail: 'OpenAI ' + gr.status + ': ' + String((gj && gj.error && gj.error.message) || '').slice(0, 240) }, 502); }
    const gb = gj && gj.data && gj.data[0] && gj.data[0].b64_json;
    if (!gb) return json({ error: 'AI returned nothing' }, 502);
    if (!team) { await addUse(env, who, doFetch); await addUse(env, 'global', doFetch); }
    return json({ image: 'data:image/png;base64,' + gb });
  }
  let blob: Blob; try { blob = dataUrlToBlob(body.image); } catch (_e) { return json({ error: 'bad image' }, 400); }
  const fd = new FormData();
  fd.append('model', model);
  fd.append('image', blob, 'input.png');
  fd.append('prompt', prompt);
  fd.append('size', '1024x1024');
  fd.append('n', '1');
  if (model.startsWith('gpt-image')) {
    fd.append('quality', q);
    fd.append('output_format', 'png');
    if (body.kind !== 'bw' && body.kind !== 'engrave' && !(custom && body.product !== 'cake')) fd.append('background', 'transparent');
  }
  const r = await doFetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + env('OPENAI_API_KEY') }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('openai', r.status, JSON.stringify(j).slice(0, 300)); return json({ error: 'AI could not process this image', detail: 'OpenAI ' + r.status + ': ' + String((j && j.error && j.error.message) || '').slice(0, 240) }, 502); }
  const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) return json({ error: 'AI returned nothing' }, 502);
  if (!team) { await addUse(env, who, doFetch); await addUse(env, 'global', doFetch); }
  return json({ image: 'data:image/png;base64,' + b64 });
}

// deno-lint-ignore no-explicit-any
const D: any = (globalThis as any).Deno;
if (D && D.serve) D.serve((req: Request) => handle(req, (k) => D.env.get(k) || ''));
