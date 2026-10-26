/* =====================================================================
   GRAPE TREE - ORDER TRACKING PAGE
   A customer types the order number + the phone or email used on the order
   (a signed-in customer opening "Track" from My orders needs nothing more).
   The database function track_order() checks the match and returns only what
   a customer may see: status, items, delivery date and the updates our team posts.
   ===================================================================== */
(function () {
    'use strict';
    var doc = document, B = (window.GT && window.GT.backend) || {}, root = doc.getElementById('trk-root');
    function T(s) { return window.GT && window.GT.lang ? window.GT.lang.t(s) : s; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function $(s, c) { return (c || doc).querySelector(s); }
    function money(n) { return 'AED ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    function when(s, time) { try { return new Date(s).toLocaleString(({ar:'ar-AE',tr:'tr-TR',zh:'zh-CN',ru:'ru-RU',ja:'ja-JP'}[doc.documentElement.lang]||'en-GB'), time ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
    function day(s) { try { return new Date(s + 'T12:00:00').toLocaleDateString(({ar:'ar-AE',tr:'tr-TR',zh:'zh-CN',ru:'ru-RU',ja:'ja-JP'}[doc.documentElement.lang]||'en-GB'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return s; } }

    var STEPS = [['new', 'Order received'], ['confirmed', 'Confirmed'], ['preparing', 'In production'], ['ready', 'Ready'], ['delivering', 'Out for delivery'], ['delivered', 'Delivered']];
    var NAME = {}; STEPS.forEach(function (s) { NAME[s[0]] = s[1]; }); NAME.cancelled = 'Cancelled';
    var SAYS = {
        new: 'We have received your order and our team is checking it.',
        confirmed: 'Your order is confirmed. We will start working on it soon.',
        preparing: 'Your order is being made right now.',
        ready: 'Your order is ready and waiting for delivery.',
        delivering: 'Your order is on its way to you.',
        delivered: 'Your order has been delivered. We hope you love it!',
        cancelled: 'This order has been cancelled.'
    };

    function param(n) { var m = new RegExp('[?&]' + n + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
    function lastOrder() { try { return JSON.parse(localStorage.getItem('gt-last-order') || 'null') || {}; } catch (e) { return {}; } }
    function waLink(no) {
        var wa = (window.GT_DATA && GT_DATA.config && GT_DATA.config.whatsapp) || '971555577478';
        try { var b = (JSON.parse(localStorage.getItem('gt-content-v1') || '{}') || {}).business; if (b && b.whatsapp) wa = String(b.whatsapp).replace(/\D/g, ''); } catch (e) {}
        return 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hello Grape Tree, I have a question about my order #' + no);
    }

    function formView(msg, no, contact) {
        root.innerHTML = '<section class="trk-card"><h2>' + esc(T('Track your order')) + '</h2>' +
            '<p class="trk-lead">' + esc(T('Enter your order number and the phone number or email you used when you ordered. You do not need an account.')) + '</p>' +
            '<form class="trk-form" id="trk-form" novalidate>' +
            '<label>' + esc(T('Order number')) + '<input id="trk-no" inputmode="numeric" autocomplete="off" placeholder="1042" value="' + esc(no || '') + '"></label>' +
            '<label>' + esc(T('Phone or email on the order')) + '<input id="trk-contact" autocomplete="off" placeholder="05x xxx xxxx / name@email.com" value="' + esc(contact || '') + '"></label>' +
            '<p class="trk-err" id="trk-err" role="alert">' + esc(msg || '') + '</p>' +
            '<button class="gt-btn trk-go" type="submit">' + esc(T('Track order')) + '</button></form>' +
            '<p class="trk-hint">' + esc(T('Your order number is in your confirmation email and on the page you saw after ordering.')) + '</p></section>';
        $('#trk-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var n = $('#trk-no').value.replace(/\D/g, ''), c = $('#trk-contact').value.trim(), err = $('#trk-err');
            if (!n) { err.textContent = T('Please type your order number.'); return; }
            if (!c && !(B.session && B.session.user)) { err.textContent = T('Please type the phone number or email you used on the order.'); return; }
            go(n, c);
        });
    }

    function go(no, contact) {
        root.innerHTML = '<section class="trk-card"><p class="trk-lead">' + esc(T('Looking for your order...')) + '</p></section>';
        B.trackOrder(no, contact).then(function (o) {
            if (!o) { formView(T('We could not find an order with those details. Please check the number and the phone or email.'), no, contact); return; }
            resultView(o, no, contact);
        }).catch(function () { formView(T('We could not check your order right now. Please try again in a moment.'), no, contact); });
    }

    function totalsBlock(o) {
        var G = window.GT || {}, P = G.pricing ? G.pricing.ofOrder(o) : { legacy: true, total: o.subtotal }, open = G.pricing ? G.pricing.openQuote(o) : false, est = !!o.has_quote;
        var label = est ? T('Estimated total') : T('Total');
        if (P.legacy) return '<p class="trk-hint">' + esc(label) + ': <strong>' + esc(money(P.total)) + (open ? ' + ' + esc(T('quoted items')) : '') + '</strong></p>';
        var vr = P.vatRate % 1 ? P.vatRate : Math.round(P.vatRate);
        return '<dl class="trk-sum"><div><dt>' + esc(T('Items')) + (P.incl ? ' (' + esc(T('incl. VAT')) + ')' : '') + '</dt><dd>' + esc(money(P.subtotal)) + '</dd></div>' +
            '<div><dt>' + esc(T('Delivery')) + '</dt><dd>' + (P.freeDelivery ? esc(T('FREE')) : esc(money(P.deliveryFee))) + '</dd></div>' +
            '<div><dt>VAT ' + esc(vr) + '%' + (P.incl ? ' (' + esc(T('included')) + ')' : '') + '</dt><dd>' + esc(money(P.vat)) + '</dd></div>' +
            '<div class="tot"><dt>' + esc(label) + '</dt><dd>' + esc(money(P.total)) + (open ? ' + ' + esc(T('quoted items')) : '') + '</dd></div></dl>' +
            (est ? '<p class="trk-fine">' + esc(T(open ? 'Quoted items are added once we confirm them.' : 'Estimate: the final price is confirmed after we review your design.')) + '</p>' : '');
    }

    function trackItems(items) {
        var out = [], seen = {};
        (items || []).forEach(function (i) {
            if (!i.group) { out.push(i); return; }
            if (seen[i.group]) return; seen[i.group] = 1;
            out.push({ name: String(i.name || '').replace(/\s*\u00b7[^\u00b7]*\d+\s*\/\s*\d+\s*$/, ''), qty: i.boxes || i.qty, boxes: true });
        });
        return out;
    }
    function resultView(o, no, contact) {
        var cancelled = o.status === 'cancelled', order = STEPS.map(function (s) { return s[0]; }), cur = order.indexOf(o.status);
        var tl = (o.timeline || []).slice().reverse().map(function (x) { return { t: x.t, title: NAME[x.status] || x.status, msg: x.msg }; });
        var paid = o.payment_status === 'paid';
        var payTxt = cancelled ? 'Cancelled' : (paid ? 'Paid' : 'Payment pending');
        var steps = cancelled ? '' : '<ol class="trk-steps">' + STEPS.map(function (s, i) { return '<li class="' + (i < cur ? 'done' : (i === cur ? 'now' : '')) + '"><i></i>' + esc(T(s[1])) + '</li>'; }).join('') + '</ol>';
        var review = (o.art_review === 'changes' || o.art_review === 'rejected') ? '<div class="trk-note"><strong>' + esc(T('We need a change to your design')) + '</strong>' + esc(o.art_review_note || '') + '</div>' : '';
        root.innerHTML = '<div><section class="trk-card"><div class="trk-head"><div><h2>' + esc(T('Order')) + ' #' + esc(o.order_no) + '</h2><small>' + esc(T('Placed')) + ' ' + esc(when(o.created_at, true)) + '</small></div>' +
            '<span class="chip ' + (cancelled ? 'st-cancelled' : (paid ? 'st-delivered' : 'st-new')) + ' trk-pay">' + esc(T(payTxt)) + '</span></div>' +
            '<p class="trk-now">' + (cancelled ? '' : esc(T('Status')) + ': ') + '<strong>' + esc(T(NAME[o.status] || o.status)) + '</strong></p>' +
            '<p class="trk-eta">' + esc(T(SAYS[o.status] || '')) + '</p>' + steps +
            (cancelled ? '<div class="trk-cancel">' + esc(T(SAYS.cancelled)) + '</div>' : '') + review +
            '<div class="trk-two"><div><h3>' + esc(T('Items')) + '</h3><ul class="trk-items">' + trackItems(o.items).map(function (i) { return '<li><span>' + esc(i.name) + '</span><em>&times; ' + esc(i.qty) + (i.boxes ? ' ' + esc(T('boxes')) : '') + '</em></li>'; }).join('') + '</ul></div>' +
            '<div><h3>' + esc(T('Delivery')) + '</h3><p>' + esc(o.emirate || '') + '</p><p class="trk-eta">' + esc(T('Estimated delivery')) + ': ' + esc(T('3-5 days after we confirm your order')) + '</p></div></div>' +
            totalsBlock(o) + '</section>' +
            '<section class="trk-card"><h3>' + esc(T('Updates')) + '</h3><ul class="trk-tl">' +
            tl.map(function (x) { return '<li><b>' + esc(T(x.title)) + '</b>' + (x.msg ? '<span>' + esc(T(x.msg)) + '</span>' : '') + '<small>' + esc(when(x.t, true)) + '</small></li>'; }).join('') + '</ul></section></div>' +
            '<div class="trk-actions"><a class="gt-btn" href="' + esc(waLink(o.order_no)) + '" target="_blank" rel="noopener">' + esc(T('Ask us about this order')) + '</a>' +
            '<button type="button" class="gt-btn gt-btn-outline" id="trk-again">' + esc(T('Track another order')) + '</button></div>';
        $('#trk-again').addEventListener('click', function () { formView('', '', ''); });
    }

    function start() {
        var no = (param('no') || '').replace(/\D/g, ''), last = lastOrder(), contact = param('c');
        if (!no && last.order_no) { no = String(last.order_no); }
        if (!contact && last.order_no && String(last.order_no) === no) contact = last.phone || last.email || '';
        B.ready.then(function () {
            if (no && (contact || B.session)) go(no, contact); else formView('', no, contact);
        });
    }
    if (B.ready) start(); else formView('', '', '');
})();
