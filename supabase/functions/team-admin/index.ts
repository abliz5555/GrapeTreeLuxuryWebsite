/* =====================================================================
   team-admin: lets the ADMIN create staff accounts with a password, change a staff
   password, and delete a staff account. Only a signed-in admin can use it (checked here).
   Body: { action: 'create', email, password, name }
         { action: 'password', email, password }
         { action: 'delete', email }
   Staff accounts only: admin accounts and customers can never be changed or deleted from here.
   Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY by itself (no secret to add).
   Deploy with "Verify JWT" OFF (this function checks the login itself).
   ===================================================================== */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, env: (k: string) => string, doFetch: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: any; try { body = await req.json(); } catch (_e) { return json({ error: 'Bad request' }, 400); }
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'The function is not set up (missing Supabase keys).' }, 500);
  const svc = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

  // 1. who is calling? must be a signed-in ADMIN
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Please sign in.' }, 401);
  const ur = await doFetch(url + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token, apikey: req.headers.get('apikey') || key } });
  if (!ur.ok) return json({ error: 'Please sign in again.' }, 401);
  const me = await ur.json();
  const pr = await doFetch(url + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(me.id), { headers: svc });
  const pj = pr.ok ? await pr.json() : [];
  if (!pj[0] || pj[0].role !== 'admin') return json({ error: 'Only an admin can do this.' }, 403);

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  const action = String(body.action || '');

  // the existing account (if any) with this email
  const fr = await doFetch(url + '/rest/v1/profiles?select=id,role&email=ilike.' + encodeURIComponent(email), { headers: svc });
  const found = (fr.ok ? await fr.json() : [])[0] || null;
  if (found && found.role === 'admin') return json({ error: 'That is an admin account. It cannot be changed here.' }, 400);

  if (action === 'create') {
    const pw = String(body.password || '');
    if (pw.length < 8) return json({ error: 'The password must have at least 8 characters.' }, 400);
    if (found && found.role !== 'staff') return json({ error: 'This email already has a customer account. Use another email for the staff member.' }, 400);
    if (found) return json({ error: 'This staff account already exists. Use "Change password" instead.' }, 400);
    // make sure the sign-up trigger gives the new account the staff role
    await doFetch(url + '/rest/v1/staff_emails', { method: 'POST', headers: { ...svc, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ email }) });
    const cr = await doFetch(url + '/auth/v1/admin/users', { method: 'POST', headers: svc, body: JSON.stringify({ email, password: pw, email_confirm: true, user_metadata: { full_name: String(body.name || '').slice(0, 120) } }) });
    const cj = await cr.json().catch(() => ({}));
    if (!cr.ok) return json({ error: /already|registered|exists/i.test(JSON.stringify(cj)) ? 'This email already has an account.' : 'Could not create the account.', detail: String(cj.msg || cj.message || cj.error_description || '').slice(0, 200) }, 400);
    await doFetch(url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(cj.id), { method: 'PATCH', headers: svc, body: JSON.stringify({ role: 'staff', full_name: String(body.name || '').slice(0, 120) }) });
    return json({ ok: true });
  }

  if (action === 'password') {
    const pw = String(body.password || '');
    if (pw.length < 8) return json({ error: 'The password must have at least 8 characters.' }, 400);
    if (!found || found.role !== 'staff') return json({ error: 'Staff account not found.' }, 404);
    const r = await doFetch(url + '/auth/v1/admin/users/' + found.id, { method: 'PUT', headers: svc, body: JSON.stringify({ password: pw }) });
    if (!r.ok) return json({ error: 'Could not change the password.' }, 400);
    return json({ ok: true });
  }

  if (action === 'delete') {
    await doFetch(url + '/rest/v1/staff_emails?email=ilike.' + encodeURIComponent(email), { method: 'DELETE', headers: svc });
    if (!found) return json({ ok: true });                       // was only waiting for a sign-up
    if (found.role !== 'staff') return json({ error: 'Only staff accounts can be deleted here.' }, 400);
    const r = await doFetch(url + '/auth/v1/admin/users/' + found.id, { method: 'DELETE', headers: svc });
    if (!r.ok) return json({ error: 'Could not delete the account.' }, 400);
    return json({ ok: true });
  }
  return json({ error: 'Unknown action' }, 400);
}

// @ts-ignore (Deno provides this when deployed)
if (typeof Deno !== 'undefined' && (Deno as any).serve) (Deno as any).serve((req: Request) => handle(req, (k) => (Deno as any).env.get(k) || ''));
