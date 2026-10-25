/* =====================================================================
   team-admin: lets the ADMIN create staff accounts with a password, change a staff
   password, and delete a staff account. Only a signed-in admin can use it (checked here).
   Body: { action: 'create', email, password, name }
         { action: 'password', email, password }
         { action: 'delete', email }
         CUSTOMER actions (by id): { action: 'c_status' }  -> sign-in info for every customer
                                   { action: 'c_password', id, password }
                                   { action: 'c_update', id, name, phone, email }
                                   { action: 'c_suspend', id, suspend: true|false }
                                   { action: 'c_delete', id }
   Staff actions only touch staff; customer actions only touch customers. Admin accounts can never be changed here.
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
  const pr = await doFetch(url + '/rest/v1/profiles?select=role,perms&id=eq.' + encodeURIComponent(me.id), { headers: svc });
  const pj = pr.ok ? await pr.json() : [];
  const isAdm = !!pj[0] && pj[0].role === 'admin';
  const action0 = String(body.action || '');
  // team members with the "customers" access may help customers (not delete accounts); everything else is admin only
  const custOk = !!pj[0] && pj[0].role === 'staff' && Array.isArray(pj[0].perms) && pj[0].perms.indexOf('customers') >= 0 && ['c_status', 'c_password', 'c_update', 'c_suspend'].indexOf(action0) >= 0;
  if (!isAdm && !custOk) return json({ error: 'Only an admin can do this.' }, 403);
  if (action0.indexOf('c_') === 0) {
    if (action0 === 'c_status') {
      const lr = await doFetch(url + '/auth/v1/admin/users?per_page=1000', { headers: svc });
      const lj: any = lr.ok ? await lr.json().catch(() => ({})) : {};
      const out: Record<string, any> = {};
      (lj.users || []).forEach((u: any) => { out[u.id] = { last: u.last_sign_in_at || null, confirmed: !!u.email_confirmed_at, suspended: !!(u.banned_until && new Date(u.banned_until).getTime() > Date.now()) }; });
      return json({ ok: true, users: out });
    }
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Customer not found.' }, 400);
    const cr0 = await doFetch(url + '/rest/v1/profiles?select=id,role,email&id=eq.' + encodeURIComponent(id), { headers: svc });
    const cu = (cr0.ok ? await cr0.json() : [])[0];
    if (!cu || cu.role !== 'customer') return json({ error: 'Customer account not found. Admin and staff accounts cannot be changed here.' }, 404);
    if (action0 === 'c_password') {
      const pw = String(body.password || '');
      if (pw.length < 8) return json({ error: 'The password must have at least 8 characters.' }, 400);
      const r = await doFetch(url + '/auth/v1/admin/users/' + id, { method: 'PUT', headers: svc, body: JSON.stringify({ password: pw }) });
      return r.ok ? json({ ok: true }) : json({ error: 'Could not change the password.' }, 400);
    }
    if (action0 === 'c_suspend') {
      const r = await doFetch(url + '/auth/v1/admin/users/' + id, { method: 'PUT', headers: svc, body: JSON.stringify({ ban_duration: body.suspend ? '876000h' : 'none' }) });
      return r.ok ? json({ ok: true }) : json({ error: 'Could not change the account.' }, 400);
    }
    if (action0 === 'c_update') {
      const name = String(body.name || '').trim().slice(0, 120), phone = String(body.phone || '').trim().slice(0, 40), em = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return json({ error: 'Please enter a valid email address.' }, 400);
      if (em !== String(cu.email || '').toLowerCase()) {
        const dup = await doFetch(url + '/rest/v1/profiles?select=id&email=ilike.' + encodeURIComponent(em), { headers: svc });
        if (dup.ok && (await dup.json()).length) return json({ error: 'Another account already uses this email.' }, 400);
        const r = await doFetch(url + '/auth/v1/admin/users/' + id, { method: 'PUT', headers: svc, body: JSON.stringify({ email: em, email_confirm: true }) });
        if (!r.ok) return json({ error: 'Could not change the email.' }, 400);
      }
      const r2 = await doFetch(url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: svc, body: JSON.stringify({ full_name: name, phone, email: em }) });
      return r2.ok ? json({ ok: true }) : json({ error: 'Could not save the details.' }, 400);
    }
    if (action0 === 'c_delete') {
      const r = await doFetch(url + '/auth/v1/admin/users/' + id, { method: 'DELETE', headers: svc });   // their orders stay (the link to the account is cleared)
      return r.ok ? json({ ok: true }) : json({ error: 'Could not delete the account.' }, 400);
    }
    return json({ error: 'Unknown action' }, 400);
  }

  const PERMS = ['orders', 'customers', 'products', 'studio', 'website', 'settings', 'business', 'legal'];
  const cleanPerms = (a: any) => (Array.isArray(a) ? a : []).map((x: any) => String(x)).filter((x: string, i: number, r: string[]) => PERMS.indexOf(x) >= 0 && r.indexOf(x) === i);
  const cleanTitle = (t: any) => String(t || '').trim().slice(0, 80);
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
    await doFetch(url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(cj.id), { method: 'PATCH', headers: svc, body: JSON.stringify({ role: 'staff', full_name: String(body.name || '').slice(0, 120), job_title: cleanTitle(body.title), perms: body.perms === undefined ? ['orders'] : cleanPerms(body.perms) }) });
    return json({ ok: true });
  }

  if (action === 'access') {
    if (!found || found.role !== 'staff') return json({ error: 'Team member not found.' }, 404);
    const r = await doFetch(url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(found.id), { method: 'PATCH', headers: svc, body: JSON.stringify({ perms: cleanPerms(body.perms), job_title: cleanTitle(body.title) }) });
    return r.ok ? json({ ok: true }) : json({ error: 'Could not save the access.' }, 400);
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
