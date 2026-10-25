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
        root.innerHTML = window.GTOrderDoc.build(o, { mode: 'customer', bank: bank });
        doc.title = 'Grape Tree order #' + (o.order_no || '');
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
