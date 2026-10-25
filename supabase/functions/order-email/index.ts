// @ts-nocheck
/* =====================================================================
   GRAPE TREE - ORDER EMAILS
   Runs on Supabase (Edge Function). Called by a Database Webhook every
   time a new row is added to the "orders" table. Sends:
     1. a "new order" email to the shop (ADMIN_EMAILS)
     2. an "order received" email to the customer (if they gave an email)
   Emails are sent with Resend (resend.com).

   Secrets to set in Supabase (Edge Functions -> Secrets):
     RESEND_API_KEY   your Resend key
     FROM_EMAIL       e.g.  Grape Tree <orders@grapetree.ae>
     ADMIN_EMAILS     e.g.  you@gmail.com,partner@gmail.com
     WEBHOOK_SECRET   any long random text (same text goes in the webhook header)
     SITE_URL         https://grapetree.ae
     REPLY_TO         (optional) address customers can reply to
   ===================================================================== */

const GOLD = '#B88A44', INK = '#2A1810', CREAM = '#FBF7F0', MUTED = '#7a6a5d', LINE = '#eadfce';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'AED ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const PAY = { whatsapp: 'Confirm on WhatsApp', bank: 'Bank transfer', card: 'Card' };

function dateNice(s) {
  if (!s) return 'To be confirmed';
  const d = new Date(s + 'T12:00:00');
  return isNaN(d) ? esc(s) : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function itemsRows(o) {
  return (o.items || []).map((l) => {
    const meta = (l.meta || []).map((m) => `<div style="font-size:13px;color:${MUTED};padding-top:2px">${esc(m[0])}: ${esc(m[1])}</div>`).join('');
    const note = l.note ? `<div style="font-size:13px;color:${MUTED};font-style:italic;padding-top:2px">${esc(l.note)}</div>` : '';
    const artNote = l.art ? `<div style="font-size:13px;color:${INK};padding-top:6px"><strong>Design files:</strong> ${l.art.folder ? 'attached to the shop email and saved in admin' : 'NOT uploaded: ask the customer'}${l.art.designer ? ' &middot; <strong style="color:#B0483A">designer: create a cartoon character and send a proof</strong>' : ''}</div>` : '';
    const price = l.quote ? `<span style="color:${GOLD}">Quote</span>` : esc(money(l.total));
    return `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINE};vertical-align:top"><div style="font-weight:600;color:${INK}">${esc(l.name)} <span style="font-weight:400;color:${MUTED}">× ${esc(l.qty)}</span></div>${meta}${note}${artNote}</td><td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid ${LINE};vertical-align:top;white-space:nowrap;font-weight:600;color:${INK}">${price}</td></tr>`;
  }).join('');
}

function shell(site, title, intro, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3ebdd;font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ebdd"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="background:${INK};padding:26px 20px"><img src="${site}/images/email-logo.png" alt="Grape Tree" height="46" style="height:46px;border:0;display:block;margin:0 auto"></td></tr>
<tr><td style="height:4px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:34px 32px 8px"><h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:${INK}">${esc(title)}</h1><p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED}">${intro}</p></td></tr>
<tr><td style="padding:12px 32px 32px">${bodyHtml}</td></tr>
<tr><td align="center" style="background:${CREAM};padding:22px 24px;font-size:12px;line-height:1.7;color:${MUTED}">Grape Tree FZE · United Arab Emirates<br><a href="${site}" style="color:${GOLD};text-decoration:none">grapetree.ae</a> · Katanukiya &amp; GildArt</td></tr>
</table></td></tr></table></body></html>`;
}

const hasTax = (o) => o.total != null && o.total !== '';
const grand = (o) => (hasTax(o) ? Number(o.total) : Number(o.subtotal));
function totalsRows(o) {
  const q = o.has_quote ? ' <span style="font-weight:400;color:' + MUTED + ';font-size:13px">+ quoted items</span>' : '';
  if (!hasTax(o)) return `<tr><td style="padding:16px 0 4px;font-size:15px;color:${MUTED}">Estimated total</td><td align="right" style="padding:16px 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;color:${INK}">${esc(money(o.subtotal))}${q}</td></tr>`;
  const row = (l, v) => `<tr><td style="padding:6px 0;font-size:14px;color:${MUTED}">${l}</td><td align="right" style="padding:6px 0;font-size:14px;color:${INK}">${v}</td></tr>`;
  const rate = Number(o.vat_rate) % 1 ? Number(o.vat_rate) : Math.round(Number(o.vat_rate));
  return row('Items' + (o.prices_include_vat ? ' (incl. VAT)' : ''), esc(money(o.subtotal))) +
    row('Delivery', Number(o.delivery_fee) > 0 ? esc(money(o.delivery_fee)) : '<strong style="color:#16602B">FREE</strong>') +
    row('VAT ' + rate + '%' + (o.prices_include_vat ? ' (included)' : ''), esc(money(o.vat_amount))) +
    `<tr><td style="padding:14px 0 4px;font-size:15px;color:${INK};font-weight:600;border-top:1px solid ${LINE}">${o.has_quote ? 'Estimated total' : 'Total'}</td><td align="right" style="padding:14px 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;color:${INK};border-top:1px solid ${LINE}">${esc(money(o.total))}${q}</td></tr>`;
}

function orderBlock(o, forShop) {
  const total = `${esc(money(grand(o)))}`;
  const addr = esc(o.address).replace(/\n/g, '<br>');
  const cell = (label, val) => `<td valign="top" style="padding:0 12px 14px 0;font-size:14px;line-height:1.55"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};font-weight:700;padding-bottom:3px">${label}</div>${val}</td>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;margin:8px 0 22px"><tr>
<td style="padding:16px 18px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};font-weight:700">Order number</div><div style="font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:${INK}">#${esc(o.order_no)}</div></td>
<td align="right" style="padding:16px 18px;font-size:13px;color:${MUTED}">${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br><span style="color:${INK};font-weight:600">${esc(PAY[o.payment_method] || o.payment_method)}</span></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsRows(o)}
${totalsRows(o)}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid ${LINE};padding-top:18px"><tr>
${cell('Delivery to', `<strong>${esc(o.name)}</strong><br>${esc(o.emirate)}<br>${addr}`)}
${cell('Delivery date', esc(dateNice(o.delivery_date)))}</tr><tr>
${cell('Contact', `${esc(o.phone)}${o.email ? '<br>' + esc(o.email) : ''}`)}
${o.notes ? cell('Notes', esc(o.notes)) : (forShop && o.source ? cell('Came from', esc(o.source)) : '<td></td>')}</tr>
${forShop && o.notes && o.source ? `<tr>${cell('Came from', esc(o.source))}<td></td></tr>` : ''}</table>`;
}

function btn(href, label, dark) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 8px 6px 0;display:inline-block"><tr><td style="border-radius:999px;background:${dark ? INK : GOLD}"><a href="${href}" style="display:inline-block;padding:13px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">${esc(label)}</a></td></tr></table>`;
}

export function customerEmail(o, site, bank, wa) {
  const bankBlock = (o.payment_method === 'bank' && bank)
    ? `<div style="background:${CREAM};border-radius:12px;padding:16px 18px;margin:0 0 20px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};font-weight:700;padding-bottom:6px">Bank details</div><div style="font-size:14px;line-height:1.7;color:${INK}">${esc(bank).replace(/\n/g, '<br>')}</div><div style="font-size:13px;color:${MUTED};padding-top:8px">Please send the transfer receipt on WhatsApp with your order number. We prepare your order once the payment arrives.</div></div>` : '';
  const next = `<div style="font-size:14px;line-height:1.7;color:${MUTED};margin:6px 0 18px"><strong style="color:${INK}">What happens next</strong><br>1. We confirm availability, final price and delivery with you${o.payment_method === 'bank' ? '' : ' on WhatsApp'}.<br>2. We prepare your order fresh.<br>3. We deliver it to you.</div>`;
  const html = shell(site, 'Thank you, ' + (o.name || '').split(' ')[0], 'We have received your order. Here is a summary for your records.',
    bankBlock + orderBlock(o, false) + next + btn(site + '/account.html#receipts', 'View my order and receipt', true) + btn('https://wa.me/' + wa + '?text=' + encodeURIComponent('Hello Grape Tree, about my order #' + o.order_no), 'Message us on WhatsApp', false) + `<p style="margin:18px 0 0;font-size:12px;color:${MUTED}">Grape Tree FZE${o.trn ? ' &middot; TRN ' + esc(o.trn) : ''}</p>`);
  return { subject: `Your Grape Tree order #${o.order_no}`, html };
}


export function cancelEmail(o, site, wa) {
  const reason = esc(o.cancel_reason || 'Please contact us for details.');
  const html = shell(site, 'Your order was cancelled', 'Order #' + esc(o.order_no) + ' has been cancelled. We are sorry for any inconvenience.',
    `<div style="background:#fff5f4;border:1px solid #f0c9c5;border-radius:12px;padding:16px 18px;margin:0 0 20px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b3261e;font-weight:700;padding-bottom:6px">Reason</div><div style="font-size:15px;line-height:1.6;color:${INK}">${reason}</div></div>` +
    orderBlock(o, false) +
    `<p style="font-size:14px;line-height:1.7;color:${MUTED};margin:6px 0 18px">If you paid anything for this order, we will contact you about the refund. If you think this is a mistake, or you would like to order again, just message us.</p>` +
    btn('https://wa.me/' + wa + '?text=' + encodeURIComponent('Hello Grape Tree, about my cancelled order #' + o.order_no), 'Message us on WhatsApp', false) + btn(site + '/account.html#receipts', 'View my orders', true));
  return { subject: `Your Grape Tree order #${o.order_no} was cancelled`, html };
}

function reviewNote(o, site) {
  const hasArt = (o.items || []).some((l) => l.art);
  const lg = o.legal || {};
  const agreed = lg.accepted ? `Customer accepted the terms and content policy (version ${esc(lg.version || '?')}).` : 'No terms acceptance was recorded for this order.';
  if (!hasArt && lg.accepted) return '';
  return `<div style="background:#fff7e0;border:1px solid #f0d78a;border-radius:12px;padding:14px 16px;margin:0 0 18px;font-size:14px;line-height:1.6;color:${INK}"><strong>${hasArt ? 'Please review the design before production.' : 'Note'}</strong><br>${hasArt ? 'Check copyright, trademarks and content (open the order in Admin: you can see the customer\'s upload and the final design they confirmed, then mark it Approved, Needs change or Rejected). ' : ''}${agreed}</div>`;
}

export function shopEmail(o, site, wa) {
  const phone = String(o.phone || '').replace(/\D/g, '');
  const html = shell(site, 'New order #' + o.order_no, `<strong style="color:${INK}">${esc(o.name)}</strong> just ordered ${esc(money(grand(o)))}${o.has_quote ? ' + quoted items' : ''}.`,
    reviewNote(o, site) + orderBlock(o, true) + btn('https://wa.me/' + phone + '?text=' + encodeURIComponent('Hello ' + o.name + ', this is Grape Tree about your order #' + o.order_no + '.'), 'WhatsApp the customer', false) + btn(site + '/admin.html', 'Open admin', true));
  return { subject: `${o.source === 'admin-test' ? '[TEST] ' : ''}New order #${o.order_no} - ${o.name} - ${money(grand(o))}`, html };
}

function b64(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
// design files from the cake studio, attached to the shop email (read with the service key, never exposed)
async function artAttachments(o, base, svcKey) {
  const out = []; let total = 0;
  for (const it of (o.items || [])) {
    const a = it.art; if (!a || !a.folder || !a.files) continue;
    for (const k of ['print', 'preview', 'cutline', 'orig']) {
      const f = a.files[k]; if (!f) continue;
      try {
        const r = await fetch(`${base}/storage/v1/object/order-art/${a.folder}/${f}`, { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey } });
        if (!r.ok) continue;
        const u8 = new Uint8Array(await r.arrayBuffer());
        if (total + u8.length > 30 * 1024 * 1024) continue;
        total += u8.length;
        out.push({ filename: `order-${o.order_no}-${k}-${f}`, content: b64(u8) });
      } catch (e) { console.error('attach', e.message); }
    }
  }
  return out;
}

async function send(key, from, to, subject, html, replyTo, attachments) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, reply_to: replyTo || undefined, attachments: attachments && attachments.length ? attachments : undefined })
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()));
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(async (req) => {
    const env = (k) => Deno.env.get(k) || '';
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    // A staff member cancelling an order from the admin page: the reason is emailed to the customer
    if (!req.headers.get('x-webhook-secret') && req.headers.get('authorization')) {
      const jr = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
      try {
        const tok = req.headers.get('authorization');
        const chk = await fetch(env('SUPABASE_URL') + '/rest/v1/rpc/is_staff', { method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: tok, 'Content-Type': 'application/json' }, body: '{}' });
        if (!chk.ok || (await chk.json()) !== true) return jr({ error: 'not allowed' }, 403);
        const b = await req.json();
        if (b.action !== 'cancel' || !b.order_id) return jr({ error: 'bad request' }, 400);
        const sh = { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY') };
        const rr = await fetch(env('SUPABASE_URL') + '/rest/v1/orders?id=eq.' + encodeURIComponent(b.order_id) + '&select=*', { headers: sh });
        const o = ((await rr.json()) || [])[0];
        if (!o || o.status !== 'cancelled') return jr({ error: 'order is not cancelled' }, 400);
        if (!o.email || o.source === 'admin-test') return jr({ ok: true, skipped: true });
        let wa2 = env('WHATSAPP') || '971555577478', rep = env('REPLY_TO') || undefined;
        try {
          const br = await fetch(env('SUPABASE_URL') + '/rest/v1/site_content?key=eq.business&select=value', { headers: sh });
          const bz = (((await br.json()) || [])[0] || {}).value || {};
          if (bz.whatsapp) wa2 = String(bz.whatsapp).replace(/\D/g, '') || wa2;
          if (bz.reply_to && String(bz.reply_to).trim()) rep = String(bz.reply_to).trim();
        } catch (e) {}
        const m = cancelEmail(o, (env('SITE_URL') || 'https://grapetree.ae').replace(/\/$/, ''), wa2);
        await send(env('RESEND_API_KEY'), env('FROM_EMAIL'), o.email, m.subject, m.html, rep);
        return jr({ ok: true });
      } catch (e) { console.error('cancel mail', e.message); return jr({ error: String(e.message || e) }, 500); }
    }
    if (req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET') || !env('WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 });
    let body; try { body = await req.json(); } catch (e) { return new Response('bad request', { status: 400 }); }
    const o = body && body.record;
    if (!o || body.type !== 'INSERT' || body.table !== 'orders') return new Response('ignored', { status: 200 });
    const site = (env('SITE_URL') || 'https://grapetree.ae').replace(/\/$/, '');
    const from = env('FROM_EMAIL'), key = env('RESEND_API_KEY'), reply = env('REPLY_TO') || undefined;
    const admins = env('ADMIN_EMAILS').split(',').map((s) => s.trim()).filter(Boolean);
    let wa = env('WHATSAPP') || '971555577478';
    let bank = '', biz = {};
    try {
      const h = { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY') };
      const r = await fetch(env('SUPABASE_URL') + '/rest/v1/site_content?key=in.(settings,business)&select=key,value', { headers: h });
      const rows = await r.json();
      for (const row of (rows || [])) { if (row.key === 'settings') bank = (row.value && row.value.bank_details) || ''; if (row.key === 'business') biz = row.value || {}; }
    } catch (e) {}
    // Business info saved in the admin page wins over the secrets
    const bizAdmins = String(biz.notify_emails || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (bizAdmins.length) { admins.length = 0; admins.push(...bizAdmins); }
    const replyTo = (biz.reply_to && String(biz.reply_to).trim()) || reply;
    if (biz.whatsapp) wa = String(biz.whatsapp).replace(/\D/g, '') || wa;
    const results = [];
    if (admins.length) { const m = shopEmail(o, site, wa); const att = await artAttachments(o, env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')); results.push(send(key, from, admins, m.subject, m.html, o.email || undefined, att).catch((e) => console.error('shop mail', e.message))); }
    if (o.email && o.source !== 'admin-test') { const m = customerEmail(o, site, bank, wa); results.push(send(key, from, o.email, m.subject, m.html, replyTo).catch((e) => console.error('customer mail', e.message))); }
    await Promise.all(results);
    return new Response('ok', { status: 200 });
  });
}
