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
            '<p class="trk-hint">' + esc(T('Your order number is on the confirmation page and in the message we send you. Signed-in customers can also open any order from My account.')) + ' <a class="acct-link" href="account.html">' + esc(T('My account')) + '</a></p></section>';
        $('#trk-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var n = $('#trk-no').value.replace(/\D/g, ''), c = $('#trk-contact').value.trim(), err = $('#trk-err');
            if (!n) { err.textContent = T('Please enter your order number.'); return; }
            if (!c && !(B.session)) { err.textContent = T('Please enter the phone number or email you used on the order.'); return; }
            go(n, c);
        });
    }

    function go(no, contact) {
        root.innerHTML = '<section class="trk-card"><p class="trk-lead">' + esc(T('Looking for your order...')) + '</p></section>';
        (B.trackOrder ? B.trackOrder(no, contact) : Promise.reject(new Error('offline'))).then(function (o) {
            if (!o) { formView(T('We could not find an order with those details. Please check the number and the phone or email you used on the order.'), no, contact); return; }
            resultView(o, no, contact);
        }).catch(function () {
            formView(T('We could not check your order right now. Please try again in a moment, or message us on WhatsApp.'), no, contact);
        });
    }

    function resultView(o, no, contact) {
        var st = o.status, cancelled = st === 'cancelled', idx = 0;
        STEPS.forEach(function (s, i) { if (s[0] === st) idx = i; });
        var steps = cancelled ? '' : '<ol class="trk-steps">' + STEPS.map(function (s, i) {
            return '<li class="' + (i < idx || st === 'delivered' ? 'done' : (i === idx ? 'now' : '')) + '"><i></i>' + esc(T(s[1])) + '</li>';
        }).join('') + '</ol>';
        var tl = [{ t: o.created_at, title: 'Order placed', msg: 'We received your order.' }].concat((o.timeline || []).map(function (x) {
            return { t: x.t, title: x.status ? NAME[x.status] || x.status : 'Update from Grape Tree', msg: x.msg || (x.status ? SAYS[x.status] : '') };
        })).sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
        var review = (o.art_review === 'changes' || o.art_review === 'rejected')
            ? '<div class="trk-note"><strong>' + esc(T(o.art_review === 'changes' ? 'We need a small change to your design' : 'We cannot produce your design')) + '</strong>' + esc(o.art_review_note || '') +
              ' <a href="' + esc(waLink(o.order_no)) + '" target="_blank" rel="noopener">' + esc(T('Message us on WhatsApp')) + '</a></div>' : '';
        root.innerHTML =
            '<section class="trk-card"><div class="trk-head"><div><h2>' + esc(T('Order')) + ' #' + esc(o.order_no) + '</h2><small>' + esc(T('Placed on')) + ' ' + esc(when(o.created_at)) + '</small></div>' +
            '<span><span class="chip st-' + esc(st) + '">' + esc(T(NAME[st] || st)) + '</span><span class="chip trk-pay ' + (o.payment_status === 'paid' ? 'st-delivered' : 'st-new') + '">' + esc(T(o.payment_status === 'paid' ? 'Paid' : 'Payment pending')) + '</span></span></div>' +
            (o.first_name ? '<p class="trk-now">' + esc(T('Hello')) + ' ' + esc(o.first_name) + '. <strong>' + esc(T(SAYS[st] || '')) + '</strong></p>' : '<p class="trk-now"><strong>' + esc(T(SAYS[st] || '')) + '</strong></p>') +
            (o.delivery_date && !cancelled && st !== 'delivered' ? '<p class="trk-eta">' + esc(T('Requested delivery date')) + ': <strong>' + esc(day(o.delivery_date)) + '</strong>' + (o.emirate ? ' &middot; ' + esc(o.emirate) : '') + '</p>' : '') +
            (cancelled ? '<div class="trk-cancel">' + esc(T(SAYS.cancelled)) + ' ' + esc(T('If you did not expect this, please message us.')) + '</div>' : steps) + review + '</section>' +
            '<div class="trk-two"><section class="trk-card"><h3>' + esc(T('Your items')) + '</h3><ul class="trk-items">' +
            (o.items || []).map(function (i) { return '<li><span>' + esc(i.name) + '</span><em>x ' + esc(i.qty) + '</em></li>'; }).join('') + '</ul>' +
            '<p class="trk-hint">' + esc(T('Estimated total')) + ': <strong>' + esc(money(o.subtotal)) + (o.has_quote ? ' + ' + esc(T('quoted items')) : '') + '</strong></p></section>' +
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
