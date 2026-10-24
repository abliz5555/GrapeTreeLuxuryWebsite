/* =====================================================================
   GRAPE TREE - ORDER SUMMARY (PDF)
   invoice.html?last=1     the order just placed (saved in this browser)
   invoice.html?no=1002    one of the signed-in customer's orders
   &print=1                opens the "Save as PDF" window straight away
   ===================================================================== */
(function () {
    'use strict';
    var doc = document, CFG = (window.GT_DATA || {}).config || {}, CO = CFG.company || {};
    var B = window.GT.backend, root = doc.getElementById('inv-root');
    var q = new URLSearchParams(location.search);
    var esc = function (s) { return window.GT.esc(s); };
    var STATUS = { new: 'Received', confirmed: 'Confirmed', preparing: 'Preparing', delivering: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
    var PAY = { whatsapp: 'Confirm on WhatsApp', bank: 'Bank transfer', card: 'Card' };

    function money(n) { return CFG.showPrices === false ? '-' : window.GT.money(n); }
    function nice(d) {
        if (!d) return 'To be confirmed';
        var x = new Date(d.length === 10 ? d + 'T12:00:00' : d);
        return isNaN(x) ? d : x.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function short(d) { var x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

    function find() {
        var no = q.get('no');
        if (no && B.enabled) {
            return B.ready.then(function () { return B.session ? B.myOrders() : []; }).then(function (rows) {
                return (rows || []).filter(function (o) { return String(o.order_no) === String(no); })[0] || lastOrder(no);
            });
        }
        return Promise.resolve(lastOrder(no));
    }
    function lastOrder(no) {
        try { var o = JSON.parse(localStorage.getItem('gt-last-order') || 'null'); if (o && (!no || String(o.order_no) === String(no))) return o; } catch (e) {}
        return null;
    }

    function render(o, bank) {
        var wa = CFG.whatsapp || '971555577478';
        var items = (o.items || []).map(function (l) {
            var meta = (l.meta || []).map(function (m) { return '<span class="sub">' + esc(m[0]) + ': ' + esc(m[1]) + '</span>'; }).join('');
            var note = l.note ? '<span class="sub">' + esc(l.note) + '</span>' : '';
            return '<tr><td><span class="nm" dir="auto">' + esc(l.name) + '</span>' + meta + note + '</td><td class="c">' + esc(l.qty) + '</td><td class="r">' + (l.quote ? '<span class="quote">Quote</span>' : esc(money(l.total))) + '</td></tr>';
        }).join('');
        var paid = o.payment_status === 'paid';
        var bankBlock = (o.payment_method === 'bank' && bank)
            ? '<div class="sec"><h4>Bank details</h4><pre dir="ltr">' + esc(bank) + '</pre><p>Please send the transfer receipt on WhatsApp with order #' + esc(o.order_no) + '. We prepare your order once the payment arrives.</p></div>' : '';
        root.innerHTML =
            '<article class="sheet">' +
            '<div class="sheet-head"><img src="images/email-logo.png" alt="Grape Tree"><div class="doc"><b>Order summary</b><span>Katanukiya &middot; GildArt</span></div></div>' +
            '<div class="sheet-body">' +
            '<div class="meta"><div class="no"><span>Order number</span><b>#' + esc(o.order_no || '-') + '</b></div><div><span>Date</span><b>' + esc(short(o.created_at)) + '</b></div>' +
            '<div><span>Status</span><b>' + esc(STATUS[o.status] || 'Received') + '</b></div><div><span>Payment</span><b>' + esc(PAY[o.payment_method] || 'WhatsApp') + '</b> <span class="pill' + (paid ? ' paid' : '') + '" style="margin-top:2px">' + (paid ? 'Paid' : 'Not paid yet') + '</span></div></div>' +
            '<div class="cols"><div><h4>Customer</h4><p dir="auto"><b>' + esc(o.name) + '</b><br>' + esc(o.phone) + (o.email ? '<br>' + esc(o.email) : '') + '</p></div>' +
            '<div><h4>Delivery</h4><p dir="auto">' + esc(o.emirate) + '<br>' + esc(o.address).replace(/\n/g, '<br>') + '<br><b>' + esc(nice(o.delivery_date)) + '</b></p></div></div>' +
            '<table><thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead><tbody>' + items + '</tbody></table>' +
            '<div class="tot"><div><span>Estimated total</span><b>' + esc(money(o.subtotal)) + (o.has_quote ? '<small style="font:500 12px Inter,sans-serif"> + quoted items</small>' : '') + '</b></div></div>' +
            (o.notes ? '<div class="sec"><h4>Your notes</h4><p style="color:inherit;font-size:14px" dir="auto">' + esc(o.notes) + '</p></div>' : '') +
            bankBlock +
            '<p class="note">This is a summary of your order request. Availability, final price and delivery are confirmed with you by Grape Tree FZE. Delivery fees, if any, are confirmed with your order. Thank you for choosing Katanukiya and GildArt.</p>' +
            '</div>' +
            '<div class="sheet-foot"><span><b>Grape Tree FZE</b> &middot; ' + esc(CO.address || 'United Arab Emirates') + '</span><span>WhatsApp +' + esc(wa) + (CO.email ? ' &middot; ' + esc(CO.email) : '') + ' &middot; ' + esc((CFG.siteUrl || 'https://grapetree.ae').replace(/^https?:\/\//, '')) + '</span></div>' +
            '</article>';
        doc.title = 'Grape Tree order #' + (o.order_no || '') ;
        if (q.get('print')) setTimeout(function () { window.print(); }, 700);
    }

    doc.getElementById('inv-print').addEventListener('click', function () { window.print(); });
    var back = doc.querySelector('.inv-back'); if (q.get('last')) back.setAttribute('href', 'shop.html');

    find().then(function (o) {
        if (!o) { root.innerHTML = '<div class="inv-empty"><p>We could not find that order.</p><p><a href="account.html">Open my account</a></p></div>'; return; }
        var p = B.enabled ? B.content().then(function (c) { return (c.settings || {}).bank_details || ''; }) : Promise.resolve('');
        p.then(function (bank) { render(o, bank); });
    });
})();
