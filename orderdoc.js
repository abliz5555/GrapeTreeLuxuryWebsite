/* =====================================================================
   GRAPE TREE - ORDER DOCUMENTS (one professional layout, two uses)
   GTOrderDoc.build(order, opts) returns the HTML of an A4 sheet.
     opts.mode   'customer'  order confirmation / receipt for the customer
                 'job'       production job sheet for the team (design files, checklist)
     opts.bank   bank details text (customer)
     opts.thumbs { "<folder>/<file>": "<image url>" }  design pictures for the job sheet
   ===================================================================== */
(function () {
    'use strict';
    var G = window.GT || {};
    var CFG = (window.GT_DATA || {}).config || {}, CO = CFG.company || {};
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function money(n) { return CFG.showPrices === false ? '-' : (G.money ? G.money(n) : 'AED ' + Number(n || 0).toFixed(2)); }
    function nice(d) {
        if (!d) return 'To be confirmed';
        var x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
        return isNaN(x) ? d : x.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function short(d) { var x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    var STATUS = { new: 'Received', confirmed: 'Confirmed', preparing: 'Preparing', delivering: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
    var PAY = { whatsapp: 'Confirm on WhatsApp', bank: 'Bank transfer', card: 'Card' };
    var REVIEW = { pending: 'Waiting for review', approved: 'Approved for production', changes: 'Needs change', rejected: 'Rejected' };
    var FILE = { print: 'Print file (PNG)', preview: 'Final design', cutline: 'Cut line (SVG)', orig: 'Customer original', spec: 'Spec (JSON)' };

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function docNo(o) { return 'GT-' + (o.order_no || '0000'); }

    function itemsHtml(o, job) {
        var rows = job ? (o.items || []).map(function (l) { return { name: l.name, qty: l.qty, total: Number(l.total) || 0, quote: !!l.quote, meta: l.meta || [], note: l.note || '', grouped: false }; }) : G.pricing.groupItems(o.items, function (l) { return Number(l.total) || 0; });
        return rows.map(function (l, i) {
            var meta = (l.meta || []).map(function (m) { return '<span class="sub">' + esc(m[0]) + ': <b>' + esc(m[1]) + '</b></span>'; }).join('');
            var note = l.note ? '<span class="sub it">' + esc(l.note) + '</span>' : '';
            var open = l.quote && !(Number(l.total) > 0);
            var unit = !open && l.qty > 0 ? '<span class="sub">' + esc(money(Number(l.total) / Number(l.qty))) + ((l.grouped || l.boxes) ? ' per box' : ' each') + '</span>' : '';
            return '<tr><td class="n">' + pad(i + 1) + '</td><td><span class="nm" dir="auto">' + esc(l.name) + '</span>' + meta + note + (job ? '' : unit) + '</td>' +
                '<td class="c">' + esc(l.qty) + '</td><td class="r">' + (open ? '<span class="quote">Quote</span>' : esc(money(l.total)) + (l.quote ? ' <small>est.</small>' : '')) + '</td></tr>';
        }).join('');
    }

    function artHtml(o, thumbs) {
        var out = '';
        (o.items || []).forEach(function (l, i) {
            var a = l.art; if (!a) return;
            var head = '<div class="art-h"><b>' + pad(i + 1) + ' &middot; ' + esc(l.name) + '</b>' +
                (a.piece ? ' <span class="tag">piece ' + esc(a.piece) + (a.pieces ? '/' + esc(a.pieces) : '') + '</span>' : '') +
                (a.designer ? ' <span class="tag warn">designer to create artwork + send proof</span>' : '') + '</div>';
            if (a.failed || !a.folder) { out += '<div class="art">' + head + '<p class="warn">Design files were not uploaded with this order. Ask the customer to send them on WhatsApp.</p></div>'; return; }
            var figs = [['orig', "Customer's original"], ['preview', 'Final design confirmed']].map(function (k) {
                var f = a.files && a.files[k[0]]; if (!f) return '';
                var u = thumbs && thumbs[a.folder + '/' + f];
                return '<figure>' + (u ? '<img src="' + esc(u) + '" alt="">' : '<div class="noimg">preview not loaded</div>') + '<figcaption>' + esc(k[1]) + '</figcaption></figure>';
            }).join('');
            var files = ['print', 'cutline', 'orig', 'preview', 'spec'].filter(function (k) { return a.files && a.files[k]; }).map(function (k) { return '<li>' + esc(FILE[k]) + ' <code>' + esc(a.files[k]) + '</code></li>'; }).join('');
            out += '<div class="art">' + head + '<div class="art-g">' + figs + '</div>' +
                '<p class="art-m"><span>Design ID <b>' + esc(a.id || a.folder) + '</b></span>' + (a.finish ? '<span>Finish <b>' + esc(a.finish) + '</b></span>' : '') + (a.look ? '<span>Look <b>' + esc(a.look) + '</b></span>' : '') +
                '<span>Rights confirmed <b>' + (a.legal && a.legal.accepted_at ? 'Yes' : 'Not recorded') + '</b></span></p>' +
                '<ul class="art-f">' + files + '</ul></div>';
        });
        return out ? '<div class="sec"><h4>Design files</h4>' + out + '<p class="note-s">Full-size print and cut files are in the admin page (Orders) and were emailed to the shop.</p></div>' : '';
    }

    function totalsHtml(o, P, job) {
        var q = G.pricing && G.pricing.openQuote(o) ? ' <small>+ quoted items</small>' : '';
        if (P.legacy) return '<div class="tot"><span>' + (o.has_quote ? 'Estimated total' : 'Total') + '</span><b>' + money(P.total) + q + '</b></div>';
        var vatLbl = 'VAT ' + (P.vatRate % 1 ? P.vatRate : Math.round(P.vatRate)) + '%' + (P.incl ? ' (included)' : '');
        return '<div class="l"><span>Items' + (P.incl ? ' (incl. VAT)' : '') + '</span><b>' + money(P.subtotal) + '</b></div>' +
            '<div class="l"><span>Delivery</span><b>' + (P.freeDelivery ? '<span class="free">FREE</span>' : money(P.deliveryFee)) + '</b></div>' +
            '<div class="l"><span>' + vatLbl + '</span><b>' + money(P.vat) + '</b></div>' +
            '<div class="tot"><span>' + (o.has_quote ? 'Estimated total' : 'Total') + '</span><b>' + money(P.total) + q + '</b></div>' +
            (o.has_quote ? '<p class="note-s" style="text-align:right;margin:4px 0 0">' + (q ? 'Quoted items are added once confirmed, with VAT.' : 'Estimate: the final price is confirmed after we review your design.') + '</p>' : '');
    }

    function build(o, opts) {
        opts = opts || {}; var job = opts.mode === 'job', wa = (CFG.whatsapp || '971555577478');
        var biz = opts.biz || {}, P = (G.pricing ? G.pricing.ofOrder(o) : { legacy: true, total: o.subtotal });
        var trn = String(o.trn || biz.trn || '').trim();
        var paid = o.payment_status === 'paid';
        var hasArt = (o.items || []).some(function (l) { return l.art; });
        var title = job ? 'Production job sheet' : (paid ? (trn ? 'Tax invoice' : 'Receipt') : 'Order confirmation');
        var sub = job ? 'Internal &middot; not for the customer' : (trn ? 'TRN ' + esc(trn) : 'Katanukiya &middot; GildArt');
        var total = money(P.total);
        var bankBlock = (!job && o.payment_method === 'bank' && opts.bank)
            ? '<div class="sec"><h4>Bank details</h4><pre dir="ltr">' + esc(opts.bank) + '</pre><p>Please send the transfer receipt on WhatsApp with order #' + esc(o.order_no) + '. We prepare your order once payment is confirmed.</p></div>' : '';
        var next = job ? '' :
            '<div class="steps"><div><b>1</b><span>We confirm availability, final price and delivery with you.</span></div>' +
            (hasArt ? '<div><b>2</b><span>Our team checks your design and may send you a proof.</span></div>' : '<div><b>2</b><span>We prepare your order with care.</span></div>') +
            '<div><b>3</b><span>We deliver within 3-5 days after confirming your order. You can track it any time.</span></div></div>';
        var deliver = job ? '<div class="banner"><div><span>Deliver by (estimate)</span><b>' + esc(nice(o.delivery_date)) + '</b></div>' +
            (hasArt ? '<div><span>Design review</span><b>' + esc(REVIEW[o.art_review || 'pending'] || 'Waiting for review') + '</b></div>' : '') +
            '<div><span>Payment</span><b>' + (paid ? 'PAID' : 'NOT PAID') + '</b></div></div>' : '';
        var checklist = job ? '<div class="sec"><h4>Production checklist</h4><div class="chk"><span>Order confirmed with customer</span><span>Artwork approved</span><span>Print file checked</span><span>Cut file checked</span><span>Produced</span><span>Quality checked</span><span>Packed</span><span>Delivered / handed over</span></div>' +
            '<div class="sign"><div><i></i>Prepared by</div><div><i></i>Checked by</div><div><i></i>Date</div></div></div>' : '';
        var internal = job && o.admin_note ? '<div class="sec"><h4>Private team note</h4><p class="ink">' + esc(o.admin_note) + '</p></div>' : '';
        var ph = biz.phone || CO.phone, co = [biz.address || CO.address, biz.email || CO.email, ph ? '+' + String(ph).replace(/^\+/, '') : ''].filter(Boolean).join(' &middot; ');
        return '<article class="sheet' + (job ? ' job' : '') + '">' +
            '<div class="sheet-head"><img src="images/email-logo.png" alt="Grape Tree"><div class="doc"><b>' + title + '</b><span>' + sub + '</span></div></div>' +
            '<div class="sheet-body">' +
            '<div class="meta"><div class="no"><span>' + (job ? 'Job' : 'Order') + ' number</span><b>#' + esc(o.order_no || '-') + '</b></div><div><span>Date</span><b>' + esc(short(o.created_at)) + '</b></div>' +
            '<div><span>Status</span><b>' + esc(STATUS[o.status] || 'Received') + '</b></div>' +
            '<div><span>Payment</span><b>' + esc(PAY[o.payment_method] || 'WhatsApp') + '</b><br><span class="pill' + (paid && o.status !== 'cancelled' ? ' paid' : '') + '">' + (o.status === 'cancelled' ? 'Cancelled' : (paid ? 'Paid' : 'Payment pending')) + '</span></div></div>' +
            deliver +
            '<div class="cols"><div><h4>Customer</h4><p dir="auto"><b>' + esc(o.name) + '</b><br>' + esc(o.phone) + (o.email ? '<br>' + esc(o.email) : '') + '</p></div>' +
            '<div><h4>Delivery</h4><p dir="auto">' + esc(o.emirate) + '<br>' + esc(o.address).replace(/\n/g, '<br>') + (job ? '' : '<br><b>Estimated delivery: 3-5 days</b>') + '</p></div></div>' +
            '<table><thead><tr><th class="n">#</th><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead><tbody>' + itemsHtml(o, job) + '</tbody></table>' +
            '<div class="tots">' + totalsHtml(o, P, job) + '</div>' +
            (o.notes ? '<div class="sec"><h4>Customer notes</h4><p class="ink" dir="auto">' + esc(o.notes) + '</p></div>' : '') +
            (job ? artHtml(o, opts.thumbs) : '') + bankBlock + next + internal + checklist +
            '<p class="note">' + (job ? 'Internal document. Handle customer details with care.' : 'This document confirms your order request. Availability, final price and delivery are confirmed with you by Grape Tree FZE. Custom designs are produced only after you approve the final preview, and approved designs cannot be changed or returned.') + '</p>' +
            '</div>' +
            '<div class="sheet-foot"><span><b>Grape Tree FZE</b>' + (co ? ' &middot; ' + co : ' &middot; United Arab Emirates') + '</span><span>WhatsApp +' + esc(wa) + ' &middot; grapetree.ae</span><span class="dn">' + (trn ? 'TRN ' + esc(trn) + ' &middot; ' : '') + esc(docNo(o)) + '</span></div>' +
            '</article>';
    }
    window.GTOrderDoc = { build: build, docNo: docNo };
})();
