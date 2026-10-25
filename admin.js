/* =====================================================================
   GRAPE TREE - ADMIN DASHBOARD
   Orders, products, website images and settings.
   Only people listed as admins (see supabase/setup.sql) can open this.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document, B = window.GT.backend, CFG = (window.GT_DATA || {}).config || {};
    var root = doc.getElementById('adm-root'), tabsEl = doc.getElementById('adm-tabs'), outBtn = doc.getElementById('adm-out');
    var esc = function (s) { return window.GT.esc(s); };
    var money = function (n) { return 'AED ' + (Number(n) % 1 ? Number(n).toFixed(2) : String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')); };
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

    var STATUSES = [['new', 'New'], ['confirmed', 'Confirmed'], ['preparing', 'Preparing'], ['ready', 'Ready for delivery'], ['delivering', 'Out for delivery'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
    var STATUS_NAME = {}; STATUSES.forEach(function (s) { STATUS_NAME[s[0]] = s[1]; });
    var PAY_NAME = { whatsapp: 'WhatsApp', bank: 'Bank transfer', card: 'Card' };
    var tab = 'dashboard', ORDERS = [], PRODUCTS = [], CONTENT = {};

    function toast(text, bad) {
        var t = $('#adm-toast'); t.textContent = text; t.className = 'adm-toast show' + (bad ? ' bad' : '');
        clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = 'adm-toast'; }, 3200);
    }
    function fail(e) { toast('Could not save: ' + String((e && e.message) || e || 'unknown error'), true); }
    function confirmBox(text, yes) {
        return new Promise(function (resolve) {
            var d = doc.createElement('div'); d.className = 'adm-modal open';
            d.innerHTML = '<div class="adm-dialog small"><p>' + esc(text) + '</p><div class="adm-row end"><button class="adm-btn ghost" data-no>Cancel</button><button class="adm-btn danger" data-yes>' + esc(yes || 'Delete') + '</button></div></div>';
            doc.body.appendChild(d);
            d.addEventListener('click', function (e) {
                var y = e.target.closest('[data-yes]'), n = e.target.closest('[data-no]') || e.target === d;
                if (y || n) { d.remove(); resolve(!!y); }
            });
        });
    }
    function dt(s) { try { return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    function digits(s) { return String(s || '').replace(/\D/g, ''); }

    /* ------------------------------ gate ------------------------------ */
    function gate() {
        tabsEl.hidden = true; outBtn.hidden = !B.session;
        if (!B.enabled) { root.innerHTML = card('<h2>Database not connected</h2><p>Check <code>supabaseUrl</code> and <code>supabaseKey</code> in shop-data.js.</p>'); return; }
        if (!B.session) {
            root.innerHTML = '<div class="adm-card narrow"><h2>Admin sign in</h2><form id="adm-login" novalidate>' +
                '<label>Email<input type="email" id="l-email" autocomplete="username" required></label>' +
                '<label>Password<input type="password" id="l-pass" autocomplete="current-password" required></label>' +
                '<p class="adm-err" id="l-err" role="alert"></p><button class="adm-btn" type="submit">Sign in</button></form></div>';
            $('#adm-login').addEventListener('submit', function (e) {
                e.preventDefault();
                var b = $('button', e.target); b.disabled = true;
                B.signIn($('#l-email').value.trim(), $('#l-pass').value).catch(function (err) {
                    b.disabled = false;
                    $('#l-err').textContent = /confirm/i.test(err.message) ? 'Please confirm your email first (check your inbox).' : 'The email or password is not right.';
                });
            });
            return;
        }
        if (!B.isStaff()) {
            root.innerHTML = card('<h2>This account has no admin access</h2><p>You are signed in as <strong>' + esc(B.user().email) + '</strong>, which is not an admin or staff account. Sign out and use your admin or staff email.</p>');
            return;
        }
        $$('[data-tab]', tabsEl).forEach(function (b) { b.hidden = !B.isAdmin() && b.getAttribute('data-tab') !== 'orders'; });   // staff see the Orders tab only
        tabsEl.hidden = false; show(tab);
    }
    function card(html) { return '<div class="adm-card narrow">' + html + '</div>'; }

    outBtn.addEventListener('click', function () { B.signOut(); });
    tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) show(b.getAttribute('data-tab')); });
    function show(t) {
        if (!B.isAdmin()) t = 'orders';
        tab = t;
        $$('[data-tab]', tabsEl).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
        ({ dashboard: viewDashboard, team: viewTeam, business: viewBusiness, legal: viewLegal, orders: viewOrders, products: viewProducts, website: viewWebsite, studio: viewStudio, test: viewTest, settings: viewSettings })[t]();
    }

    /* ============================ SMALL HELPERS (v9) ============================ */
    function cacheSet(key, val) {
        try { var c = JSON.parse(localStorage.getItem('gt-content-v1') || '{}') || {}; c[key] = val; localStorage.setItem('gt-content-v1', JSON.stringify(c)); } catch (e) {}
    }
    function hasArt(o) { return (o.items || []).some(function (l) { return l.art; }); }
    function reviewOf(o) { return hasArt(o) ? (o.art_review || 'pending') : 'na'; }
    var REVIEWS = [['pending', 'Waiting for review'], ['approved', 'Approved for production'], ['changes', 'Customer must change it'], ['rejected', 'Rejected (not allowed)']];
    var REVIEW_NAME = { pending: 'Review design', approved: 'Design approved', changes: 'Needs change', rejected: 'Design rejected', na: '' };
    function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function daysFromNow(s) { if (!s) return null; var a = new Date(s + 'T12:00:00'), b = new Date(); b.setHours(12, 0, 0, 0); return Math.round((a - b) / 86400000); }
    function openOrder(id) { focusId = id; fStatus = 'all'; fPay = 'all'; fReview = 'all'; fRange = 'all'; fText = ''; show('orders'); }
    var focusId = null;

    /* ============================ DASHBOARD ============================ */
    function viewDashboard() {
        root.innerHTML = '<div class="adm-bar"><h2>Dashboard</h2><button class="adm-btn ghost" id="d-refresh">Refresh</button></div><div id="d-box"><p class="adm-loading">Loading...</p></div>';
        $('#d-refresh').addEventListener('click', function () { loadOrders(); });
        loadOrders();
    }
    function drawDashboard() {
        var box = $('#d-box'); if (!box) return;
        var live = ORDERS.filter(function (o) { return o.status !== 'cancelled' && o.source !== 'admin-test'; });
        var now = new Date(), ms = new Date(now.getFullYear(), now.getMonth(), 1), ds = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var sum = function (a) { return a.reduce(function (t, o) { return t + Number(o.subtotal || 0); }, 0); };
        var newO = live.filter(function (o) { return o.status === 'new'; });
        var review = live.filter(function (o) { return reviewOf(o) === 'pending' && o.status !== 'delivered'; });
        var unpaid = live.filter(function (o) { return o.payment_status !== 'paid' && o.status !== 'delivered'; });
        var month = live.filter(function (o) { return new Date(o.created_at) >= ms; }), today = live.filter(function (o) { return new Date(o.created_at) >= ds; });
        var attn = live.filter(function (o) { return o.status === 'new' || reviewOf(o) === 'pending' && o.status !== 'delivered'; }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }).slice(0, 8);
        var up = live.filter(function (o) { var d = daysFromNow(o.delivery_date); return d != null && d >= 0 && d <= 7 && o.status !== 'delivered'; }).sort(function (a, b) { return String(a.delivery_date).localeCompare(String(b.delivery_date)); }).slice(0, 8);
        var late = live.filter(function (o) { var d = daysFromNow(o.delivery_date); return d != null && d < 0 && o.status !== 'delivered'; });
        var byStatus = STATUSES.map(function (s) { return '<span class="chip st-' + s[0] + '">' + esc(s[1]) + ' <b>' + ORDERS.filter(function (o) { return o.status === s[0]; }).length + '</b></span>'; }).join(' ');
        var src = {}; live.forEach(function (o) { var k = (o.source || 'direct').split(' / ')[0] || 'direct'; src[k] = (src[k] || 0) + 1; });
        var top = Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).slice(0, 5).map(function (k) { return esc(k) + ' <b>' + src[k] + '</b>'; }).join(' &nbsp;&middot;&nbsp; ');
        function row(o, extra) {
            return '<button type="button" class="adm-row-btn" data-open="' + esc(o.id) + '"><span class="o-no">#' + esc(o.order_no) + '</span><span class="grow"><strong>' + esc(o.name) + '</strong><small>' + esc(dt(o.created_at)) + (o.delivery_date ? ' &middot; deliver ' + esc(o.delivery_date) : '') + '</small></span>' + (extra || '') + '<span class="o-total">' + esc(money(o.subtotal)) + '</span></button>';
        }
        box.innerHTML = '<div class="adm-stats">' +
            statLink('New orders', newO.length, 'waiting for you', 'status=new') +
            statLink('Designs to review', review.length, 'check copyright and content', 'review=pending') +
            statLink('Not paid yet', unpaid.length, money(sum(unpaid)), 'pay=unpaid') +
            stat('Today', today.length, money(sum(today))) +
            stat('This month', month.length, money(sum(month))) +
            (late.length ? statLink('Late deliveries', late.length, 'delivery date has passed', 'late=1') : '') + '</div>' +
            '<div class="adm-two">' +
            '<section class="adm-card"><h3>Needs your attention</h3>' + (attn.length ? attn.map(function (o) { return row(o, (o.status === 'new' ? '<span class="chip st-new">New</span>' : '') + (reviewOf(o) === 'pending' ? '<span class="chip rv-pending">Review design</span>' : '')); }).join('') : '<p class="adm-empty">Nothing waiting. Nice work.</p>') + '</section>' +
            '<section class="adm-card"><h3>Deliveries in the next 7 days</h3>' + (up.length ? up.map(function (o) { var d = daysFromNow(o.delivery_date); return row(o, '<span class="chip">' + (d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days') + '</span>'); }).join('') : '<p class="adm-empty">No deliveries planned this week.</p>') + '</section></div>' +
            '<section class="adm-card"><h3>All orders by status</h3><div class="adm-chips">' + byStatus + '</div><p class="adm-fine">Where orders come from: ' + (top || 'no orders yet') + '</p></section>';
    }
    function statLink(l, v, s, f) { return '<button type="button" class="adm-stat link" data-filter="' + esc(f) + '"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong><small>' + esc(s) + '</small></button>'; }
    function stat(l, v, s, wide) { return '<div class="adm-stat' + (wide ? ' wide' : '') + '"><span>' + esc(l) + '</span>' + (v !== '' ? '<strong>' + esc(v) + '</strong>' : '') + '<small>' + (wide ? s : esc(s)) + '</small></div>'; }

    /* ============================ ORDERS ============================ */
    var fStatus = 'all', fText = '', fPay = 'all', fReview = 'all', fRange = 'all', fSort = 'new', fLate = false;
    function opts(list, cur) { return list.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === cur ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join(''); }
    function viewOrders() {
        root.innerHTML = '<div class="adm-bar wrap"><h2>Orders</h2><span class="grow"></span><button class="adm-btn ghost" id="o-csv">Download list (CSV)</button><button class="adm-btn ghost" id="o-refresh">Refresh</button></div>' +
            '<div class="adm-filters">' +
            '<input type="search" id="o-q" placeholder="Search name, phone, email or order number" aria-label="Search orders">' +
            '<select id="o-status" aria-label="Status">' + opts([['all', 'All statuses']].concat(STATUSES), fStatus) + '</select>' +
            '<select id="o-pay" aria-label="Payment">' + opts([['all', 'Any payment'], ['unpaid', 'Not paid'], ['paid', 'Paid']], fPay) + '</select>' +
            '<select id="o-review" aria-label="Design review">' + opts([['all', 'Any design review'], ['pending', 'Waiting for review'], ['approved', 'Approved'], ['changes', 'Needs change'], ['rejected', 'Rejected']], fReview) + '</select>' +
            '<select id="o-range" aria-label="Date">' + opts([['all', 'All dates'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']], fRange) + '</select>' +
            '<select id="o-sort" aria-label="Sort">' + opts([['new', 'Newest first'], ['old', 'Oldest first'], ['delivery', 'By delivery date']], fSort) + '</select></div>' +
            '<p class="adm-fine" id="o-count"></p><div id="o-list"><p class="adm-loading">Loading orders...</p></div>';
        $('#o-q').value = fText;
        [['o-status', 'fStatus'], ['o-pay', 'fPay'], ['o-review', 'fReview'], ['o-range', 'fRange'], ['o-sort', 'fSort']].forEach(function (p) {
            $('#' + p[0]).addEventListener('change', function () { var v = this.value; if (p[1] === 'fStatus') fStatus = v; else if (p[1] === 'fPay') fPay = v; else if (p[1] === 'fReview') fReview = v; else if (p[1] === 'fRange') fRange = v; else fSort = v; fLate = false; drawOrders(); });
        });
        $('#o-q').addEventListener('input', function () { fText = this.value; drawOrders(); });
        $('#o-refresh').addEventListener('click', loadOrders);
        $('#o-csv').addEventListener('click', exportCsv);
        loadOrders();
    }
    function loadOrders() {
        return B.client.from('orders').select('*').order('created_at', { ascending: false }).limit(1000).then(function (r) {
            if (r.error) throw r.error;
            ORDERS = r.data || [];
            var n = ORDERS.filter(function (o) { return o.status === 'new'; }).length, b = $('#adm-new');
            b.hidden = !n; b.textContent = n;
            if (tab === 'orders') drawOrders(); else if (tab === 'dashboard') drawDashboard();
        }).catch(function (e) { var l = $('#o-list') || $('#d-box'); if (l) l.innerHTML = '<p class="adm-err">Could not load orders: ' + esc(e.message || e) + '<br>If this is the first time after an update, run supabase/v9-update.sql in the Supabase SQL Editor.</p>'; });
    }
    function filtered() {
        var q = fText.trim().toLowerCase().replace(/^#/, '');
        var from = null; if (fRange === 'today') { from = new Date(); from.setHours(0, 0, 0, 0); } else if (fRange === '7' || fRange === '30') { from = new Date(Date.now() - (+fRange) * 86400000); }
        var list = ORDERS.filter(function (o) {
            if (fStatus !== 'all' && o.status !== fStatus) return false;
            if (fPay !== 'all' && (o.payment_status || 'unpaid') !== fPay) return false;
            if (fReview !== 'all' && reviewOf(o) !== fReview) return false;
            if (from && new Date(o.created_at) < from) return false;
            if (fLate) { var d = daysFromNow(o.delivery_date); if (!(d != null && d < 0 && o.status !== 'delivered' && o.status !== 'cancelled')) return false; }
            if (!q) return true;
            return String(o.order_no).indexOf(q) > -1 || (o.name || '').toLowerCase().indexOf(q) > -1 || (o.phone || '').toLowerCase().indexOf(q) > -1 || (o.email || '').toLowerCase().indexOf(q) > -1;
        });
        if (fSort === 'old') list.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        else if (fSort === 'delivery') list.sort(function (a, b) { return String(a.delivery_date || '9999').localeCompare(String(b.delivery_date || '9999')); });
        return list;
    }
    function chipsFor(o) {
        var rv = reviewOf(o);
        return '<span class="chip st-' + esc(o.status) + '">' + esc(STATUS_NAME[o.status] || o.status) + '</span>' +
            (rv !== 'na' ? '<span class="chip rv-' + rv + '">' + esc(REVIEW_NAME[rv]) + '</span>' : '') +
            (o.payment_status === 'paid' ? '<span class="chip paid">Paid</span>' : (o.status !== 'cancelled' ? '<span class="chip unpaid">Not paid</span>' : ''));
    }
    function drawOrders() {
        var list = filtered(), box = $('#o-list'); if (!box) return;
        $('#o-count').textContent = list.length + ' of ' + ORDERS.length + ' orders';
        if (!list.length) { box.innerHTML = '<div class="adm-empty">No orders match these filters.</div>'; return; }
        box.innerHTML = list.map(function (o) {
            return '<article class="adm-order" data-id="' + esc(o.id) + '">' +
                '<button type="button" class="o-head" aria-expanded="false"><span class="o-no">#' + esc(o.order_no) + (o.source === 'admin-test' ? ' <em class="testtag">TEST</em>' : '') + '</span>' +
                '<span class="o-who"><strong>' + esc(o.name) + '</strong><small>' + esc(dt(o.created_at)) + ' &middot; ' + esc(o.emirate) + (o.delivery_date ? ' &middot; deliver ' + esc(o.delivery_date) : '') + '</small></span>' +
                '<span class="o-total">' + esc(money(o.subtotal)) + (o.has_quote ? ' +' : '') + '</span><span class="o-chips">' + chipsFor(o) + '</span></button>' +
                '<div class="o-body" hidden></div></article>';
        }).join('');
        if (focusId) { var el = $('.adm-order[data-id="' + focusId + '"] .o-head'); focusId = null; if (el) { el.click(); el.scrollIntoView({ block: 'start' }); } }
    }
    function exportCsv() {
        var list = filtered();
        function q(v) { v = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(v) ? '"' + v + '"' : v; }
        var head = ['Order', 'Date', 'Status', 'Payment', 'Design review', 'Name', 'Phone', 'Email', 'Emirate', 'Address', 'Delivery date', 'Total (AED)', 'Items', 'Notes', 'Private note', 'Source'];
        var rows = list.map(function (o) {
            return [o.order_no, o.created_at, STATUS_NAME[o.status] || o.status, o.payment_status, REVIEW_NAME[reviewOf(o)] || '', o.name, o.phone, o.email, o.emirate, String(o.address || '').replace(/\n/g, ' '), o.delivery_date, o.subtotal,
                (o.items || []).map(function (l) { return l.name + ' x' + l.qty; }).join(' | '), o.notes, o.admin_note, o.source].map(q).join(',');
        });
        var blob = new Blob(['﻿' + [head.join(',')].concat(rows).join('\n')], { type: 'text/csv;charset=utf-8' });
        var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'grapetree-orders-' + ymd(new Date()) + '.csv'; doc.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 500);
        toast(list.length + ' orders downloaded');
    }

    /* design files (private storage: opened with a short-lived link) */
    var ART_LABELS = { print: 'Print file (PNG)', preview: 'Final design', cutline: 'Cut line (SVG)', orig: 'Customer original', spec: 'Spec (JSON)' };
    function artBlock(l) {
        var a = l.art; if (!a) return '';
        var out = '<div class="o-art">';
        var pc = a.piece ? ' <span class="chip">piece ' + esc(a.piece) + (a.pieces ? ' of ' + esc(a.pieces) : '') + '</span>' : '';
        if (a.designer) out += '<span class="chip">designer: create cartoon + send proof</span> ';
        if (a.failed || !a.folder) return out + pc + '<span class="chip">files were not uploaded: ask the customer on WhatsApp</span></div>';
        out += pc + '<div class="adm-thumbs">';
        [['orig', "Customer's upload"], ['preview', 'Final design they confirmed']].forEach(function (k) {
            if (a.files && a.files[k[0]]) out += '<figure><button type="button" data-art="' + esc(a.folder + '/' + a.files[k[0]]) + '" aria-label="Open ' + esc(k[1]) + ' full size"><img data-thumb="' + esc(a.folder + '/' + a.files[k[0]]) + '" alt="' + esc(k[1]) + '"></button><figcaption>' + esc(k[1]) + '</figcaption></figure>';
        });
        out += '</div><div class="adm-dl">';
        ['print', 'cutline', 'orig', 'preview', 'spec'].forEach(function (k) {
            if (a.files && a.files[k]) out += '<button type="button" class="o-artbtn" data-art="' + esc(a.folder + '/' + a.files[k]) + '">' + esc(ART_LABELS[k]) + '</button> ';
        });
        out += '</div>';
        if (a.legal && a.legal.accepted_at) out += '<p class="adm-fine ok">&#10003; Customer confirmed the rights and content statements for this design (' + esc(dt(a.legal.accepted_at)) + ')</p>';
        else out += '<p class="adm-fine warn">No rights confirmation was saved with this design (placed before the update).</p>';
        return out + '</div>';
    }
    function loadThumbs(scope) {
        $$('img[data-thumb]', scope).forEach(function (im) {
            if (im.getAttribute('data-done')) return; im.setAttribute('data-done', '1');
            B.client.storage.from('order-art').createSignedUrl(im.getAttribute('data-thumb'), 900).then(function (r) { if (r && r.data && r.data.signedUrl) im.src = r.data.signedUrl; else im.alt = 'not available'; });
        });
    }
    doc.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-art]') : null;
        if (!b) return;
        e.preventDefault();
        var w = window.open('', '_blank');
        B.client.storage.from('order-art').createSignedUrl(b.getAttribute('data-art'), 300).then(function (r) {
            if (r.error || !r.data) { if (w) w.close(); alert('Could not open the file: ' + ((r.error && r.error.message) || 'not found')); return; }
            if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl;
        });
    });

    /* quick messages to the customer (WhatsApp / email) */
    var TEMPLATES = [
        ['confirm', 'Order confirmed', function (o) { return 'Hello ' + o.name + ', thank you for your order #' + o.order_no + ' with Grape Tree. We have confirmed it' + (o.delivery_date ? ' for delivery on ' + o.delivery_date : '') + '. Total: ' + money(o.subtotal) + '. We will keep you updated.'; }],
        ['image', 'Please send a better image', function (o) { return 'Hello ' + o.name + ', this is Grape Tree about order #' + o.order_no + '. To print your design well we need a clearer, higher-resolution image (a PNG or JPG of at least 1000 px). Could you please send it here?'; }],
        ['proof', 'Design ready: please approve', function (o) { return 'Hello ' + o.name + ', your design for order #' + o.order_no + ' is ready. Please check the attached proof and reply "APPROVED" so we can start production. Production starts only after your approval.'; }],
        ['rights', 'We need proof of rights / permission', function (o) { return 'Hello ' + o.name + ', this is Grape Tree about order #' + o.order_no + '. Your design may include a logo, character or artwork that belongs to someone else. Before we can produce it, please send us the written permission or licence from the owner. Thank you for understanding.'; }],
        ['cannot', 'We cannot print this design', function (o) { return 'Hello ' + o.name + ', thank you for your order #' + o.order_no + '. Unfortunately we cannot produce this design because it does not meet our Content & Copyright Policy (copyright, trademark or content reasons). You are welcome to send us a different design and we will gladly continue. Any payment made will be refunded.'; }],
        ['payment', 'Payment reminder', function (o) { return 'Hello ' + o.name + ', a friendly reminder that order #' + o.order_no + ' (' + money(o.subtotal) + ') is waiting for payment. We start production once it is received. Thank you!'; }],
        ['delivering', 'Out for delivery', function (o) { return 'Hello ' + o.name + ', your Grape Tree order #' + o.order_no + ' is out for delivery today. Please keep your phone nearby.'; }],
        ['thanks', 'Delivered: thank you', function (o) { return 'Hello ' + o.name + ', thank you for choosing Grape Tree! We hope you love your order #' + o.order_no + '. We would be happy to see a photo of it.'; }]
    ];
    function tplText(o, id) { var t = TEMPLATES.filter(function (x) { return x[0] === id; })[0]; return t ? t[2](o) : ''; }

    function legalBlock(o) {
        var lg = o.legal || {};
        if (!lg.accepted) return '<div class="o-agree warn"><h4>Customer agreement</h4><p>&#9888; No agreement was recorded for this order (it was placed before this feature). Consider asking the customer to confirm the terms on WhatsApp.</p></div>';
        var st = (lg.statements || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
        return '<div class="o-agree ok"><h4>Customer agreement</h4><p>&#10003; Accepted the Terms, Content &amp; Copyright Policy and Privacy Policy (text version ' + esc(lg.version || '?') + ') on <strong>' + esc(dt(lg.server_time || lg.client_time)) + '</strong>.<br><small>Saved as proof: IP ' + esc(lg.ip || 'not available') + ' &middot; ' + esc(String(lg.user_agent || '').slice(0, 90)) + '</small></p>' + (st ? '<ul>' + st + '</ul>' : '') + '</div>';
    }
    function historyBlock(o) {
        var h = Array.isArray(o.history) ? o.history.slice().reverse() : [];
        if (!h.length) return '';
        return '<div class="o-hist"><h4>History</h4><ul>' + h.map(function (x) { return '<li><span>' + esc(dt(x.t)) + '</span> ' + esc(x.what) + (x.by ? ' <em>' + esc(x.by) + '</em>' : '') + '</li>'; }).join('') + '</ul></div>';
    }
    function orderBody(o) {
        var items = (o.items || []).map(function (l) {
            var meta = (l.meta || []).map(function (m) { return '<li>' + esc(m[0]) + ': ' + esc(m[1]) + '</li>'; }).join('');
            return '<li><div><strong>' + esc(l.name) + '</strong> <em>x ' + esc(l.qty) + '</em>' + (l.quote ? ' <span class="chip">quote needed</span>' : '') + (meta ? '<ul class="o-meta">' + meta + '</ul>' : '') + (l.note ? '<p class="o-note">' + esc(l.note) + '</p>' : '') + artBlock(l) + '</div><span>' + esc(money(l.total)) + '</span></li>';
        }).join('');
        var wa = 'https://wa.me/' + digits(o.phone) + '?text=' + encodeURIComponent(tplText(o, 'confirm'));
        var art = hasArt(o);
        return '<div class="o-grid"><div><h4>Items</h4><ul class="o-items">' + items + '</ul>' +
            '<p class="o-sum"><span>Estimated total</span><strong>' + esc(money(o.subtotal)) + (o.has_quote ? ' + quoted items' : '') + '</strong></p></div>' +
            '<div><h4>Customer</h4><p><strong>' + esc(o.name) + '</strong><br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a>' + (o.email ? '<br><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a>' : '') + '</p>' +
            '<h4>Delivery</h4><p>' + esc(o.emirate) + '<br>' + esc(o.address).replace(/\n/g, '<br>') + '<br><strong>' + (o.delivery_date ? esc(o.delivery_date) : 'No date') + '</strong></p>' +
            (o.notes ? '<h4>Customer notes</h4><p>' + esc(o.notes) + '</p>' : '') +
            '<h4>Payment</h4><p>' + esc(PAY_NAME[o.payment_method] || o.payment_method) + (o.source ? '<br><small>Came from: ' + esc(o.source) + '</small>' : '') + '</p></div></div>' +
            legalBlock(o) +
            '<div class="o-actions o-pub"><label class="grow">Message to the customer (shown on their order tracking page, optional)<input type="text" data-pubmsg maxlength="300" placeholder="e.g. Your design is approved and printing starts tomorrow"></label>' +
            '<button class="adm-btn ghost" type="button" data-post>Post message only</button></div>' +
            '<div class="o-actions"><label>Order status (the customer sees it on the tracking page)<select data-f="status">' + opts(STATUSES, o.status) + '</select></label>' +
            '<label>Payment<select data-f="payment_status">' + opts([['unpaid', 'Not paid'], ['paid', 'Paid']], o.payment_status || 'unpaid') + '</select></label>' +
            (art ? '<label>Design review<select data-f="art_review">' + opts(REVIEWS, o.art_review || 'pending') + '</select></label><label class="grow">Review note (reason / what to change)<input type="text" data-f="art_review_note" value="' + esc(o.art_review_note || '') + '"></label>' : '') +
            '<label class="grow">Private note (only you see this)<input type="text" data-f="admin_note" value="' + esc(o.admin_note || '') + '"></label></div>' +
            '<div class="o-msg"><label class="grow">Message the customer<select data-tpl>' + TEMPLATES.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('') + '</select></label>' +
            '<a class="adm-btn" data-wa href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' + (o.email ? '<a class="adm-btn ghost" data-mail href="mailto:' + esc(o.email) + '?subject=' + encodeURIComponent('Grape Tree order #' + o.order_no) + '&body=' + encodeURIComponent(tplText(o, 'confirm')) + '">Email</a>' : '') + '<button class="adm-btn ghost" data-print>Print</button>' + (B.isAdmin() ? '<button class="adm-btn danger" data-del-order type="button">Delete order</button>' : '') + '</div>' +
            historyBlock(o);
    }
    function renderBody(artEl, o) { var body = $('.o-body', artEl); body.innerHTML = orderBody(o); loadThumbs(body); var h = $('.o-head', artEl); $('.o-chips', h).innerHTML = chipsFor(o); }
    doc.addEventListener('click', function (e) {
        var head = e.target.closest('.o-head');
        if (head) {
            var art = head.parentNode, body = $('.o-body', art), open = head.getAttribute('aria-expanded') === 'true';
            head.setAttribute('aria-expanded', open ? 'false' : 'true'); body.hidden = open;
            if (!open && !body.innerHTML) { body.innerHTML = orderBody(ORDERS.filter(function (o) { return o.id === art.getAttribute('data-id'); })[0]); }
            if (!open) loadThumbs(body);
            return;
        }
        var pr = e.target.closest('[data-print]');
        if (pr) { printOrder(ORDERS.filter(function (o) { return o.id === pr.closest('.adm-order').getAttribute('data-id'); })[0]); return; }
        var op = e.target.closest('[data-open]'); if (op) { openOrder(op.getAttribute('data-open')); return; }
        var dl = e.target.closest('[data-del-order]');
        if (dl) {
            var da = dl.closest('.adm-order'), dord = ORDERS.filter(function (x) { return x.id === da.getAttribute('data-id'); })[0];
            confirmBox('Delete order #' + dord.order_no + ' for good? The order and its design files are removed and this cannot be undone.', 'Delete order').then(function (yes) {
                if (!yes) return;
                var paths = []; (dord.items || []).forEach(function (l) { if (l.art && l.art.folder && l.art.files) Object.keys(l.art.files).forEach(function (k) { paths.push(l.art.folder + '/' + l.art.files[k]); }); });
                var rm = paths.length ? B.client.storage.from('order-art').remove(paths).then(function () {}, function () {}) : Promise.resolve();
                rm.then(function () { return B.client.from('orders').delete().eq('id', dord.id).select(); }).then(function (r) {
                    if (r.error) throw r.error;
                    if (!r.data || !r.data.length) throw new Error('The database did not allow it. Run supabase/v11-update.sql in the Supabase SQL Editor first.');
                    ORDERS = ORDERS.filter(function (x) { return x.id !== dord.id; }); toast('Order deleted'); if (tab === 'orders') drawOrders(); else show(tab);
                    var n = ORDERS.filter(function (x) { return x.status === 'new'; }).length, b = $('#adm-new'); b.hidden = !n; b.textContent = n;
                }).catch(fail);
            });
            return;
        }
        var po = e.target.closest('[data-post]');
        if (po) {
            var pa = po.closest('.adm-order'), pi = $('[data-pubmsg]', pa), po_o = ORDERS.filter(function (x) { return x.id === pa.getAttribute('data-id'); })[0];
            if (!pi.value.trim()) { toast('Type the message first.', true); return; }
            saveOrder(po_o, {}, 'Message to customer: ' + pi.value.trim(), pa, { pub: true, msg: pi.value.trim() });
            return;
        }
        var fl = e.target.closest('[data-filter]');
        if (fl) {
            var kv = fl.getAttribute('data-filter').split('='); fStatus = 'all'; fPay = 'all'; fReview = 'all'; fRange = 'all'; fText = ''; fLate = false;
            if (kv[0] === 'status') fStatus = kv[1]; else if (kv[0] === 'pay') fPay = kv[1]; else if (kv[0] === 'review') fReview = kv[1]; else if (kv[0] === 'late') fLate = true;
            show('orders');
        }
    });
    function saveOrder(o, patch, what, artEl, extra) {
        var entry = { t: new Date().toISOString(), by: (B.user() && B.user().email) || 'admin', what: what };
        if (extra) Object.keys(extra).forEach(function (k) { entry[k] = extra[k]; });
        var hist = (Array.isArray(o.history) ? o.history : []).concat([entry]);
        var upd = JSON.parse(JSON.stringify(patch)); upd.history = hist;
        return B.client.from('orders').update(upd).eq('id', o.id).then(function (r) {
            if (r.error) throw r.error;
            Object.keys(upd).forEach(function (k) { o[k] = upd[k]; });
            toast('Saved'); if (artEl) renderBody(artEl, o);
            var n = ORDERS.filter(function (x) { return x.status === 'new'; }).length, b = $('#adm-new'); b.hidden = !n; b.textContent = n;
        }).catch(fail);
    }
    doc.addEventListener('change', function (e) {
        var tp = e.target.closest('[data-tpl]');
        if (tp) {
            var a0 = tp.closest('.adm-order'), o0 = ORDERS.filter(function (x) { return x.id === a0.getAttribute('data-id'); })[0], txt = tplText(o0, tp.value);
            $('[data-wa]', a0).href = 'https://wa.me/' + digits(o0.phone) + '?text=' + encodeURIComponent(txt);
            var m = $('[data-mail]', a0); if (m) m.href = 'mailto:' + o0.email + '?subject=' + encodeURIComponent('Grape Tree order #' + o0.order_no) + '&body=' + encodeURIComponent(txt);
            return;
        }
        var f = e.target.closest('[data-f]'); if (!f) return;
        var art = f.closest('.adm-order'); if (!art) return;
        var o = ORDERS.filter(function (x) { return x.id === art.getAttribute('data-id'); })[0], patch = {}, key = f.getAttribute('data-f');
        patch[key] = f.value;
        var what = key === 'status' ? 'Status: ' + (STATUS_NAME[f.value] || f.value) : key === 'payment_status' ? 'Payment: ' + (f.value === 'paid' ? 'Paid' : 'Not paid') :
            key === 'art_review' ? 'Design review: ' + (REVIEW_NAME[f.value] || f.value) : key === 'art_review_note' ? 'Review note: ' + f.value : 'Private note: ' + f.value;
        var extra = null, pm = $('[data-pubmsg]', art), msg = pm ? pm.value.trim() : '';
        if (key === 'status') extra = { pub: true, status: f.value, msg: msg };                       // every status change shows on the customer's tracking page
        else if (key === 'art_review' && (f.value === 'approved' || f.value === 'changes' || f.value === 'rejected'))
            extra = { pub: true, msg: f.value === 'approved' ? 'Your design is approved for production.' : (f.value === 'changes' ? 'We need a change to your design.' : 'We cannot produce this design.') + ((o.art_review_note || '') ? ' ' + o.art_review_note : '') };
        saveOrder(o, patch, what, art, extra);
    });
    function printOrder(o) {
        var w = window.open('', '_blank'); if (!w) return toast('Please allow pop-ups to print.', true);
        var rows = (o.items || []).map(function (l) {
            return '<tr><td>' + esc(l.name) + ((l.meta || []).map(function (m) { return '<br><small>' + esc(m[0]) + ': ' + esc(m[1]) + '</small>'; }).join('')) + (l.note ? '<br><small>' + esc(l.note) + '</small>' : '') + '</td><td>' + esc(l.qty) + '</td><td>' + esc(money(l.total)) + '</td></tr>';
        }).join('');
        w.document.write('<!doctype html><title>Order #' + esc(o.order_no) + '</title><style>body{font:14px/1.5 Arial,sans-serif;margin:30px;color:#222}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}small{color:#666}</style>' +
            '<h1>Grape Tree - Order #' + esc(o.order_no) + '</h1><div>' + esc(dt(o.created_at)) + '</div><p><strong>' + esc(o.name) + '</strong><br>' + esc(o.phone) + '<br>' + esc(o.emirate) + ', ' + esc(o.address) + '<br><strong>Deliver: ' + esc(o.delivery_date || '-') + '</strong></p>' +
            '<table><tr><th>Item</th><th>Qty</th><th>Total</th></tr>' + rows + '</table><p><strong>Total: ' + esc(money(o.subtotal)) + (o.has_quote ? ' + quoted items' : '') + '</strong> (' + esc(o.payment_status) + ')</p>' + (o.notes ? '<p>Notes: ' + esc(o.notes) + '</p>' : '') + '<script>onload=function(){print()}<\/script>');
        w.document.close();
    }

    /* ============================ PRODUCTS ============================ */
    function viewProducts() {
        root.innerHTML = '<div class="adm-bar"><h2>Products</h2><button class="adm-btn" id="p-add">+ Add product</button></div><div id="p-list"><p class="adm-loading">Loading...</p></div>';
        $('#p-add').addEventListener('click', function () { editProduct(null); });
        loadProducts();
    }
    function loadProducts() {
        B.allProductsAdmin().then(function (rows) { PRODUCTS = rows; drawProducts(); }).catch(function (e) { $('#p-list').innerHTML = '<p class="adm-err">Could not load products: ' + esc(e.message || e) + '</p>'; });
    }
    function drawProducts() {
        var box = $('#p-list'); if (!box) return;
        if (!PRODUCTS.length) { box.innerHTML = '<div class="adm-empty">No products yet. Click "Add product".</div>'; return; }
        box.innerHTML = '<div class="adm-products">' + PRODUCTS.map(function (p) {
            return '<article class="adm-prod' + (p.active ? '' : ' off') + '" data-id="' + esc(p.id) + '"><img src="' + esc(p.img) + '" alt="" loading="lazy">' +
                '<div class="p-info"><span class="chip">' + esc(p.brand === 'gildart' ? 'GildArt' : 'Katanukiya') + '</span>' + (p.active ? '' : '<span class="chip st-cancelled">Hidden</span>') + '<h3>' + esc(p.name) + '</h3><p>' + esc(money(p.price)) + '</p></div>' +
                '<div class="p-act"><button class="adm-btn ghost" data-feat title="Show on the home page under Ready to Gift">' + (p.featured ? '\u2605 On home page' : '\u2606 Home page') + '</button><button class="adm-btn ghost" data-edit>Edit</button><button class="adm-btn ghost" data-toggle>' + (p.active ? 'Hide' : 'Show') + '</button></div></article>';
        }).join('') + '</div>';
        $$('.adm-prod', box).forEach(function (el) {
            var p = PRODUCTS.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
            $('[data-edit]', el).addEventListener('click', function () { editProduct(p); });
            $('[data-feat]', el).addEventListener('click', function () {
                var on = !p.featured; B.setFeatured(p.id, on).then(function () { p.featured = on; toast(on ? 'Shown on the home page' : 'Removed from the home page'); drawProducts(); B.products(true); }).catch(fail);
            });
            $('[data-toggle]', el).addEventListener('click', function () {
                p.active = !p.active; B.saveProduct(p, false).then(function () { toast(p.active ? 'Product is visible' : 'Product hidden'); drawProducts(); }).catch(function (e) { p.active = !p.active; fail(e); });
            });
        });
    }

    /* ============================ TEST STUDIO ============================ */
    function viewTest() {
        root.innerHTML = '<div class="adm-card"><h3>Test the design studio</h3>' +
            '<p>You are signed in as admin, so any order you place from the studios is marked <b>TEST</b>. The customer email is not sent for test orders, and you can delete them below.</p>' +
            '<p><a class="adm-btn" href="cake-studio.html" target="_blank" rel="noopener">Open cake studio</a> <a class="adm-btn" href="chocolate-studio.html" target="_blank" rel="noopener">Open chocolate studio</a></p>' +
            '<p class="adm-note">Tip: on each studio page use "Try the sample character" so you do not need a file. Go through all 4 steps and place the order with the sample.</p></div>' +
            '<div class="adm-card"><h3>System check</h3><p>Checks that each part is connected.</p><div id="t-checks"></div><p><button class="adm-btn" id="t-run">Run all checks</button></p></div>' +
            '<div class="adm-card"><h3>Test orders</h3><div id="t-orders"><p class="adm-loading">Loading...</p></div></div>';
        $('#t-run').addEventListener('click', runChecks);
        drawChecks([]); loadTestOrders();
    }
    var CHECKS = [
        ['Database connection', function () { return B.client.from('products').select('id', { count: 'exact', head: true }).then(function (r) { if (r.error) throw r.error; return 'Connected (' + (r.count || 0) + ' products)'; }); }],
        ['Order files storage (order-art)', function () { return B.client.storage.from('order-art').list('', { limit: 1 }).then(function (r) { if (r.error) throw r.error; return 'Bucket is reachable'; }); }],
        ['Featured products column', function () { return B.client.from('products').select('featured').limit(1).then(function (r) { if (r.error) throw new Error('Run supabase/v7-update.sql in Supabase'); return 'OK'; }); }],
        ['AI function (studio-ai)', function () { return B.client.functions.invoke('studio-ai', { body: { kind: 'ping' } }).then(function (r) { if (r.error) throw new Error('Not deployed or not reachable: ' + (r.error.message || r.error)); var d = r.data || {}; if (!d.ok) throw new Error(d.error || 'No answer'); return d.key ? 'Working. OpenAI key is set' + (d.model ? ' (' + d.model + ')' : '') : 'Deployed, but OPENAI_API_KEY is not set'; }); }]
    ];
    function drawChecks(res) {
        $('#t-checks').innerHTML = '<ul class="adm-checklist">' + CHECKS.map(function (c, i) {
            var r = res[i];
            return '<li class="' + (r ? (r.ok ? 'ok' : 'bad') : '') + '"><b>' + esc(c[0]) + '</b><span>' + esc(r ? r.msg : 'Not run yet') + '</span></li>';
        }).join('') + '</ul>';
    }
    function runChecks() {
        var res = []; drawChecks(res);
        CHECKS.reduce(function (chain, c, i) {
            return chain.then(function () {
                return Promise.resolve().then(c[1]).then(function (m) { res[i] = { ok: true, msg: m }; }, function (e) { res[i] = { ok: false, msg: e.message || String(e) }; }).then(function () { drawChecks(res); });
            });
        }, Promise.resolve());
    }
    function loadTestOrders() {
        B.client.from('orders').select('*').eq('source', 'admin-test').order('created_at', { ascending: false }).limit(100).then(function (r) {
            if (r.error) throw r.error;
            var rows = r.data || [], box = $('#t-orders'); if (!box) return;
            if (!rows.length) { box.innerHTML = '<p>No test orders yet.</p>'; return; }
            box.innerHTML = '<ul class="adm-checklist">' + rows.map(function (o) { return '<li><b>#' + esc(o.order_no) + '</b><span>' + esc(new Date(o.created_at).toLocaleString()) + ' \u00b7 ' + esc(money(o.subtotal)) + '</span></li>'; }).join('') + '</ul>' +
                '<p><button class="adm-btn ghost" id="t-del">Delete all test orders</button></p>';
            $('#t-del').addEventListener('click', function () {
                if (!confirm('Delete all ' + rows.length + ' test orders? Their design files stay in storage.')) return;
                B.client.from('orders').delete().eq('source', 'admin-test').then(function (x) { if (x.error) throw x.error; toast('Test orders deleted'); loadTestOrders(); }).catch(fail);
            });
        }).catch(function (e) { var b = $('#t-orders'); if (b) b.innerHTML = '<p class="adm-err">' + esc(e.message || e) + '</p>'; });
    }


    /* ============================ STUDIO PRICES & TEXT ============================ */
    var SC = {}, sp = 'cake';
    function stDefaults(p) { return (window.GT_DATA && GT_DATA.studio && GT_DATA.studio[p]) || {}; }
    function stVal(p) { var d = stDefaults(p), o = SC[p] || {}, r = {}, k; for (k in d) r[k] = d[k]; for (k in o) if (o[k] != null && o[k] !== '') r[k] = o[k]; return r; }
    function viewStudio() {
        root.innerHTML = '<div class="adm-card"><h3>Studio prices &amp; page text</h3><p>Change prices, minimum order, options and the words on the two design pages. Changes go live as soon as you save.</p>' +
            '<div class="adm-seg" id="s-seg"><button type="button" data-p="cake">Katanukiya cake studio</button><button type="button" data-p="chocolate">GildArt chocolate studio</button></div><div id="s-form"><p class="adm-loading">Loading...</p></div></div>';
        $('#s-seg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { sp = b.dataset.p; drawStudio(); } });
        B.content().then(function (c) { SC = (c && c.studio) || {}; drawStudio(); });
    }
    function drawStudio() {
        $$('#s-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === sp); });
        var v = stVal(sp), cake = sp === 'cake', h = '';
        h += '<h4>Page text</h4><label class="adm-f">Headline<input id="s-title" value="' + esc(v.title || '') + '"></label>' +
            '<label class="adm-f">Introduction<textarea id="s-lead" rows="3">' + esc(v.lead || '') + '</textarea></label>' +
            '<label class="adm-f">Three short highlights (one per line)<textarea id="s-chips" rows="3">' + esc((v.chips || []).join('\n')) + '</textarea></label>';
        if (cake) h += '<h4>Prices by quantity</h4><p class="adm-note">The smallest quantity (first row) is the <b>minimum order</b>. Price is the total for that quantity, in AED.</p><div id="s-tiers"></div><p><button type="button" class="adm-btn ghost" id="s-addtier">Add a row</button></p>';
        else {
            h += '<h4>Box prices</h4><p class="adm-note">Price of one box in AED. Every piece in a box can carry a different print.</p><div id="s-bsets">' + (v.boxSets || []).map(function (b, i) { return '<div class="adm-row"><input data-bsl="' + i + '" value="' + esc(b.label) + '" aria-label="Box name"> <span>' + esc(b.pieces) + ' piece' + (b.pieces > 1 ? 's' : '') + '</span> <label>Price per box <input type="number" min="0" step="0.5" data-bsp="' + i + '" value="' + esc(b.price) + '"></label></div>'; }).join('') + '</div>' +
                '<label class="adm-f">Minimum number of boxes per order<input type="number" min="1" id="s-minbox" value="' + esc(v.minBoxes || 1) + '"></label>' +
                '<h4>Quantity discounts</h4><p class="adm-note">Percent off the price per box, from this number of boxes. Leave the first row at 0%.</p><div id="s-disc"></div><p><button type="button" class="adm-btn ghost" id="s-adddisc">Add a row</button></p>';
        }
        if (cake) {
            h += '<h4>Box colours</h4><div id="s-boxes">' + (v.boxes || []).map(function (b, i) { return '<div class="adm-row"><input data-bl="' + i + '" value="' + esc(b.label) + '" aria-label="Colour name"> <label>extra AED per piece <input type="number" min="0" step="0.5" data-be="' + i + '" value="' + esc(b.extra) + '"></label></div>'; }).join('') + '</div>';
        } else {
            h += '<h4>Thickness</h4><div id="s-thick">' + (v.thickness || []).map(function (t, i) { return '<div class="adm-row"><input data-tl="' + i + '" value="' + esc(t.label) + '" aria-label="Thickness"> <label>extra AED per piece <input type="number" min="0" step="0.5" data-te="' + i + '" value="' + esc(t.extra) + '"></label></div>'; }).join('') + '</div>';
            h += '<label class="adm-f">Minimum quantity for custom flavour and custom box<input type="number" min="1" id="s-moq" value="' + esc(v.customMinQty || 300) + '"></label>' +
                '<label class="adm-f">Flavours customers can choose (one per line)<textarea id="s-flav" rows="5">' + esc((v.flavours || []).join('\n')) + '</textarea></label>';
        }
        h += '<h4>Other</h4><div class="adm-row"><label>Delivery time (business days) <input type="number" min="1" id="s-lead-d" value="' + esc(v.leadBusinessDays || 14) + '"></label> <label>Designer fee AED (0 = free) <input type="number" min="0" id="s-fee" value="' + esc(v.designerFee || 0) + '"></label></div>';
        h += '<p class="adm-err" id="s-err" hidden></p><p><button type="button" class="adm-btn" id="s-save">Save changes</button> <button type="button" class="adm-btn ghost" id="s-reset">Back to website defaults</button></p>';
        $('#s-form').innerHTML = h;
        var disc = (v.discounts || []).map(function (d) { return { min: d.min, off: d.off }; });
        function drawDisc() {
            var el = $('#s-disc'); if (!el) return;
            el.innerHTML = disc.map(function (d, i) { return '<div class="adm-row"><label>From boxes <input type="number" min="1" data-dm="' + i + '" value="' + esc(d.min) + '"></label> <label>Discount % <input type="number" min="0" max="90" step="0.5" data-do="' + i + '" value="' + esc(d.off) + '"></label> <button type="button" class="adm-btn ghost" data-dd="' + i + '">Remove</button></div>'; }).join('');
        }
        if (!cake) {
            drawDisc();
            $('#s-disc').addEventListener('input', function (e) { var d = e.target.dataset; if (d.dm != null) disc[+d.dm].min = +e.target.value; if (d.do != null) disc[+d.do].off = +e.target.value; });
            $('#s-disc').addEventListener('click', function (e) { var b = e.target.closest('[data-dd]'); if (b && disc.length > 1) { disc.splice(+b.dataset.dd, 1); drawDisc(); } });
            $('#s-adddisc').addEventListener('click', function () { var l = disc[disc.length - 1] || { min: 1, off: 0 }; disc.push({ min: l.min * 2, off: l.off + 5 }); drawDisc(); });
        }
        var tiers = (v.tiers || []).map(function (t) { return { qty: t.qty, price: t.price, popular: !!t.popular }; });
        function drawTiers() {
            $('#s-tiers').innerHTML = tiers.map(function (t, i) {
                return '<div class="adm-row"><label>Quantity <input type="number" min="1" data-tq="' + i + '" value="' + esc(t.qty) + '"></label> <label>Total price <input type="number" min="0" data-tp="' + i + '" value="' + esc(t.price) + '"></label> <label class="check"><input type="radio" name="pop" data-pp="' + i + '"' + (t.popular ? ' checked' : '') + '> Popular</label> <button type="button" class="adm-btn ghost" data-td="' + i + '">Remove</button></div>';
            }).join('');
        }
        if (cake) drawTiers();
        if (cake) $('#s-tiers').addEventListener('input', function (e) { var d = e.target.dataset; if (d.tq != null) tiers[+d.tq].qty = +e.target.value; if (d.tp != null) tiers[+d.tp].price = +e.target.value; });
        if (cake) $('#s-tiers').addEventListener('change', function (e) { if (e.target.dataset.pp != null) tiers.forEach(function (t, i) { t.popular = i === +e.target.dataset.pp; }); });
        if (cake) $('#s-tiers').addEventListener('click', function (e) { var b = e.target.closest('[data-td]'); if (b && tiers.length > 1) { tiers.splice(+b.dataset.td, 1); drawTiers(); } });
        if (cake) $('#s-addtier').addEventListener('click', function () { var l = tiers[tiers.length - 1] || { qty: 100, price: 1000 }; tiers.push({ qty: l.qty * 2, price: l.price * 2 }); drawTiers(); });
        $('#s-save').addEventListener('click', function () {
            var err = $('#s-err'); err.hidden = true;
            function bad(m) { err.textContent = m; err.hidden = false; }
            var out = { title: $('#s-title').value.trim(), lead: $('#s-lead').value.trim(), chips: $('#s-chips').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4) };
            if (cake) {
                tiers.sort(function (a, b) { return a.qty - b.qty; });
                for (var i = 0; i < tiers.length; i++) { if (!(tiers[i].qty >= 1) || !(tiers[i].price >= 0)) return bad('Please check the quantities and prices.'); if (i && tiers[i].qty === tiers[i - 1].qty) return bad('Two rows have the same quantity.'); }
                out.tiers = tiers.map(function (t) { var o = { qty: Math.round(t.qty), price: Number(t.price) }; if (t.popular) o.popular = true; return o; });
            } else {
                out.boxSets = (v.boxSets || []).map(function (b, i) { var o = {}; for (var k in b) o[k] = b[k]; o.label = $('[data-bsl="' + i + '"]').value.trim() || b.label; o.price = Math.max(0, Number($('[data-bsp="' + i + '"]').value) || 0); return o; });
                out.minBoxes = Math.max(1, parseInt($('#s-minbox').value, 10) || 1);
                disc.sort(function (a, b) { return a.min - b.min; });
                for (var j = 0; j < disc.length; j++) { if (!(disc[j].min >= 1) || !(disc[j].off >= 0 && disc[j].off <= 90)) return bad('Please check the discount rows.'); if (j && disc[j].min === disc[j - 1].min) return bad('Two discount rows start at the same number of boxes.'); }
                out.discounts = disc.map(function (d) { return { min: Math.round(d.min), off: Number(d.off) }; });
            }
            if (cake) out.boxes = (v.boxes || []).map(function (b, i) { var o = {}; for (var k in b) o[k] = b[k]; o.label = $('[data-bl="' + i + '"]').value.trim() || b.label; o.extra = Number($('[data-be="' + i + '"]').value) || 0; return o; });
            else {
                out.thickness = (v.thickness || []).map(function (t, i) { var o = {}; for (var k in t) o[k] = t[k]; o.label = $('[data-tl="' + i + '"]').value.trim() || t.label; o.extra = Number($('[data-te="' + i + '"]').value) || 0; return o; });
                out.customMinQty = Math.max(1, parseInt($('#s-moq').value, 10) || 300);
                out.flavours = $('#s-flav').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
                if (!out.flavours.length) return bad('Please add at least one flavour.');
            }
            out.leadBusinessDays = Math.max(1, parseInt($('#s-lead-d').value, 10) || 14);
            out.designerFee = Math.max(0, Number($('#s-fee').value) || 0);
            SC[sp] = out;
            B.saveContent('studio', SC).then(function () { toast('Saved. The studio page is updated.'); }).catch(fail);
        });
        $('#s-reset').addEventListener('click', function () {
            if (!confirm('Go back to the prices and texts in the website files?')) return;
            delete SC[sp]; B.saveContent('studio', SC).then(function () { toast('Back to defaults'); drawStudio(); }).catch(fail);
        });
    }

    function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'; }

    function editProduct(p) {
        var isNew = !p; p = p || { brand: 'katanukiya', name: '', short: '', desc: '', details: [], price: 0, img: '', active: true, sort: (PRODUCTS.length + 1) * 10 + 10, customize: null };
        var d = doc.createElement('div'); d.className = 'adm-modal open'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
        d.innerHTML = '<form class="adm-dialog" novalidate><h2>' + (isNew ? 'Add a product' : 'Edit product') + '</h2>' +
            '<div class="adm-form">' +
            '<label class="full">Name<input name="name" value="' + esc(p.name) + '" required></label>' +
            '<label>Brand<select name="brand"><option value="katanukiya">Katanukiya</option><option value="gildart">GildArt</option></select></label>' +
            '<label>Price (AED)<input name="price" type="number" min="0" step="0.5" value="' + esc(p.price) + '" required></label>' +
            '<label class="full">Short line (shown on the card)<input name="short" value="' + esc(p.short) + '"></label>' +
            '<label class="full">Full description<textarea name="desc" rows="3">' + esc(p.desc) + '</textarea></label>' +
            '<label class="full">Highlights (one per line)<textarea name="details" rows="3">' + esc((p.details || []).join('\n')) + '</textarea></label>' +
            '<div class="full pic"><img id="pe-img" src="' + esc(p.img) + '" alt=""><div><label class="adm-btn ghost file">Upload a photo<input type="file" accept="image/*" id="pe-file" hidden></label><p class="adm-hint" id="pe-hint">Square or landscape photos look best. They are resized for you.</p></div></div>' +
            '<label>Position in the list<input name="sort" type="number" step="1" value="' + esc(p.sort) + '"></label>' +
            '<label class="check"><input name="active" type="checkbox"' + (p.active ? ' checked' : '') + '> Visible in the shop</label>' +
            '<label class="check"><input name="feat" type="checkbox"' + (p.featured ? ' checked' : '') + '> Show on the home page (Ready to Gift)</label>' +
            '<label class="check full"><input name="cust" type="checkbox"' + (p.customize ? ' checked' : '') + '> Show a "Customize this" link</label>' +
            '</div><p class="adm-err" id="pe-err" role="alert"></p>' +
            '<div class="adm-row">' + (isNew ? '' : '<button type="button" class="adm-btn danger ghost" data-del>Delete</button>') +
            '<span class="grow"></span><button type="button" class="adm-btn ghost" data-close>Cancel</button><button type="submit" class="adm-btn">Save</button></div></form>';
        doc.body.appendChild(d);
        var f = $('form', d); f.brand.value = p.brand;
        var img = p.img;
        $('#pe-file', d).addEventListener('change', function () {
            var file = this.files[0]; if (!file) return;
            $('#pe-hint', d).textContent = 'Uploading...';
            B.uploadImage(file, 'products').then(function (url) { img = url; $('#pe-img', d).src = url; $('#pe-hint', d).textContent = 'Photo uploaded.'; })
                .catch(function (e) { $('#pe-hint', d).textContent = 'Upload failed: ' + (e.message || e); });
        });
        d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.remove(); });
        var del = $('[data-del]', d);
        if (del) del.addEventListener('click', function () {
            confirmBox('Delete "' + p.name + '" for good? Customers will no longer see it. Past orders are kept.').then(function (yes) {
                if (!yes) return;
                B.deleteProduct(p.id).then(function () { d.remove(); toast('Deleted'); loadProducts(); }).catch(fail);
            });
        });
        f.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = f.name.value.trim(), price = parseFloat(f.price.value);
            if (!name) return ($('#pe-err', d).textContent = 'Please enter a name.');
            if (!(price >= 0)) return ($('#pe-err', d).textContent = 'Please enter a price.');
            if (!img) return ($('#pe-err', d).textContent = 'Please upload a photo.');
            var id = p.id;
            if (isNew) { var base = f.brand.value.charAt(0) + '-' + slug(name), n = 1; id = base; while (PRODUCTS.some(function (x) { return x.id === id; })) id = base + '-' + (++n); }
            var out = {
                id: id, brand: f.brand.value, name: name, short: f.short.value.trim(), desc: f.desc.value.trim(),
                details: f.details.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean), price: price, img: img,
                active: f.active.checked, featured: f.feat.checked, sort: parseInt(f.sort.value, 10) || 100,
                customize: f.cust.checked ? (p.customize || { builder: f.brand.value }) : null
            };
            var b = $('button[type=submit]', f); b.disabled = true;
            B.saveProduct(out, isNew).then(function () { d.remove(); toast('Saved'); loadProducts(); B.products(true); }).catch(function (err) { b.disabled = false; $('#pe-err', d).textContent = 'Could not save: ' + (err.message || err); });
        });
        $('input[name=name]', d).focus();
    }

    /* ============================ WEBSITE IMAGES ============================ */
    function viewWebsite() {
        root.innerHTML = '<div class="adm-bar"><h2>Website: texts, fonts and pictures</h2></div>' +
            '<div class="adm-card"><h3>1. Change the words on any page</h3><p class="adm-lead">Open a page, then tap or click any text (for example "Japanese craftsmanship. UAE luxury.") to change the words, the font and the size, or to delete it. The "Fonts" button in the bar changes the font of the whole website. Everything is saved for every visitor. To change the Arabic, Turkish, Chinese, Russian or Japanese version, switch the language button on that page first.</p>' +
            '<div class="adm-pages">' + [['Home page', 'index.html'], ['Katanukiya', 'katanukiya.html'], ['GildArt', 'gildart.html'], ['Shop', 'shop.html'], ['Contact', 'contact.html'], ['Cake designer', 'cake-studio.html'], ['Chocolate designer', 'chocolate-studio.html'], ['Track order', 'order-track.html'], ['My account', 'account.html'], ['Checkout', 'checkout.html']].map(function (p) { return '<a class="adm-btn ghost" target="_blank" rel="noopener" href="' + p[1] + '?edit=1">' + p[0] + '</a>'; }).join('') + '</div>' +
            '<p class="adm-hint">The page opens in a new tab with a dark bar at the bottom. Press <b>Finish</b> when you are done.</p></div>' +
            '<div class="adm-card" id="w-texts"><h3>Your text changes</h3><p class="adm-loading">Loading...</p></div>' +
            '<div class="adm-card" id="w-fonts"><h3>2. Fonts</h3><p class="adm-loading">Loading...</p></div>' +
            '<div class="adm-card"><h3>3. Big pictures on the home page</h3><p class="adm-lead">Upload a new photo and it goes live straight away. "Use original" puts the first photo back.</p><div id="w-grid"><p class="adm-loading">Loading...</p></div></div>';
        B.content().then(function (c) { CONTENT = c || {}; drawWebsite(); drawTexts(); drawFonts(); });
    }

    /* ---- your text changes (made with ?edit=1 on any page) ---- */
    var LN = { en: 'English', ar: 'Arabic', tr: 'Turkish', zh: 'Chinese', ru: 'Russian', ja: 'Japanese' };
    function drawTexts() {
        var box = $('#w-texts'); if (!box) return;
        var texts = CONTENT.texts || {}, rows = [];
        Object.keys(texts).forEach(function (k) { Object.keys(texts[k] || {}).forEach(function (l) { rows.push([k, l, texts[k][l], 'text']); }); });
        var sty = CONTENT.styles || {};
        Object.keys(sty).forEach(function (k) { var v = sty[k] || {}; rows.push([k, '', (v.font ? 'Font: ' + v.font + '. ' : '') + (v.size && +v.size !== 100 ? 'Size: ' + v.size + '%' : ''), 'style']); });
        if (!rows.length) { box.innerHTML = '<h3>Your text changes</h3><p class="adm-lead">Nothing changed yet. Every text on the website is still the original.</p>'; return; }
        box.innerHTML = '<h3>Your text changes</h3><div class="adm-tbl"><table><thead><tr><th>Language</th><th>Original</th><th>Your text</th><th></th></tr></thead><tbody>' + rows.map(function (r, i) {
            var hid = r[2] === '\u0001hide';
            return '<tr><td>' + esc(r[3] === 'style' ? 'Font / size' : (r[1] === '*' ? 'All languages' : (LN[r[1]] || r[1]))) + '</td><td>' + esc(r[0].length > 90 ? r[0].slice(0, 90) + '...' : r[0]) + '</td><td>' + (hid ? '<i>Deleted (hidden)</i>' : esc(r[2])) + '</td><td><button class="adm-btn ghost" data-undo="' + i + '">Back to original</button></td></tr>';
        }).join('') + '</tbody></table></div>';
        $$('[data-undo]', box).forEach(function (b) {
            b.addEventListener('click', function () {
                var r = rows[+b.getAttribute('data-undo')], t = JSON.parse(JSON.stringify(CONTENT.texts || {})), sy = JSON.parse(JSON.stringify(CONTENT.styles || {}));
                var job;
                if (r[3] === 'style') { delete sy[r[0]]; job = B.saveContent('styles', sy).then(function () { CONTENT.styles = sy; }); }
                else { if (t[r[0]]) { delete t[r[0]][r[1]]; if (!Object.keys(t[r[0]]).length) delete t[r[0]]; } job = B.saveContent('texts', t).then(function () { CONTENT.texts = t; }); }
                job.then(function () { try { localStorage.removeItem('gt-content-v1'); } catch (x) {} toast('Original restored'); drawTexts(); }).catch(fail);
            });
        });
    }
    /* ---- fonts ---- */
    var HEAD_FONTS = ['Cormorant Garamond', 'Playfair Display', 'Lora', 'Cinzel', 'Libre Baskerville', 'DM Serif Display', 'Marcellus', 'Bodoni Moda', 'EB Garamond', 'Cormorant'];
    var BODY_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Lato', 'Nunito Sans', 'Open Sans', 'DM Sans', 'Raleway'];
    function drawFonts() {
        var box = $('#w-fonts'); if (!box) return;
        var f = CONTENT.fonts || {}, h = f.heading || 'Cormorant Garamond', b = f.body || 'Inter';
        function opts(list, cur) { return list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
        box.innerHTML = '<h3>2. Fonts</h3><p class="adm-lead">Pick the letter style for headings and for normal text. The preview below shows how it looks. Arabic, Chinese and Japanese keep their own fonts.</p>' +
            '<div class="adm-grid2"><label>Headings (big titles)<select id="f-h">' + opts(HEAD_FONTS, h) + '</select></label><label>Normal text<select id="f-b">' + opts(BODY_FONTS, b) + '</select></label></div>' +
            '<div class="adm-fontprev"><div id="fp-h">Japanese craftsmanship. UAE luxury.</div><div id="fp-b">Premium layered cakes, precisely cut into playful shapes made for gifting. Order online and track it with your order number.</div></div>' +
            '<div class="adm-row"><button class="adm-btn ghost" id="f-reset" type="button">Use the original fonts</button><span class="grow"></span><button class="adm-btn" id="f-save" type="button">Save fonts</button></div>';
        var link = document.getElementById('adm-font-prev');
        function prev() {
            var hv = $('#f-h').value, bv = $('#f-b').value;
            if (!link) { link = document.createElement('link'); link.id = 'adm-font-prev'; link.rel = 'stylesheet'; document.head.appendChild(link); }
            link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(hv).replace(/%20/g, '+') + ':wght@400;600&family=' + encodeURIComponent(bv).replace(/%20/g, '+') + ':wght@400;600&display=swap';
            $('#fp-h').style.fontFamily = '"' + hv + '",serif'; $('#fp-b').style.fontFamily = '"' + bv + '",sans-serif';
        }
        $('#f-h').addEventListener('change', prev); $('#f-b').addEventListener('change', prev); prev();
        function put(v) {
            B.saveContent('fonts', v).then(function () { CONTENT.fonts = v; try { localStorage.removeItem('gt-content-v1'); } catch (x) {} toast(v.heading ? 'Fonts saved. Refresh the website to see them.' : 'Original fonts restored'); drawFonts(); }).catch(fail);
        }
        $('#f-save').addEventListener('click', function () { put({ heading: $('#f-h').value, body: $('#f-b').value }); });
        $('#f-reset').addEventListener('click', function () { put({}); });
    }
    function currentSrc(slot) {
        var el = doc.createElement('div');
        return ((CONTENT.images || {})[slot]) || '';
    }
    var ORIGINAL = { hero_kat: 'images/hero1.jpg', hero_gild: 'images/gildart-hero.jpg' };
    function drawWebsite() {
        var imgs = CONTENT.images || {};
        $('#w-grid').innerHTML = '<div class="adm-slots">' + B.SLOTS.map(function (s) {
            var src = imgs[s.key] || ORIGINAL[s.key];
            return '<article class="adm-slot" data-slot="' + s.key + '"><img src="' + esc(src) + '" alt=""><div><h3>' + esc(s.label) + '</h3><p>' + esc(s.where) + '</p>' +
                '<div class="adm-row"><label class="adm-btn file">Change photo<input type="file" accept="image/*" hidden></label>' + (imgs[s.key] ? '<button class="adm-btn ghost" data-reset>Use original</button>' : '') + '</div></div></article>';
        }).join('') + '</div>';
        $$('.adm-slot').forEach(function (el) {
            var key = el.getAttribute('data-slot');
            $('input[type=file]', el).addEventListener('change', function () {
                var file = this.files[0]; if (!file) return;
                toast('Uploading...');
                B.uploadImage(file, 'site').then(function (url) { return saveImages(key, url); }).then(function () { toast('Photo changed'); drawWebsite(); }).catch(fail);
            });
            var r = $('[data-reset]', el); if (r) r.addEventListener('click', function () { saveImages(key, null).then(function () { toast('Original restored'); drawWebsite(); }).catch(fail); });
        });
    }
    function saveImages(key, url) {
        var imgs = JSON.parse(JSON.stringify(CONTENT.images || {}));
        if (url) imgs[key] = url; else delete imgs[key];
        return B.saveContent('images', imgs).then(function () { CONTENT.images = imgs; try { localStorage.removeItem('gt-content-v1'); } catch (e) {} });
    }

    /* ============================ SETTINGS ============================ */
    function viewSettings() {
        root.innerHTML = '<div class="adm-bar"><h2>Settings</h2></div><div id="s-box"><p class="adm-loading">Loading...</p></div>';
        B.content().then(function (c) {
            CONTENT = c || {}; var st = CONTENT.settings || {};
            $('#s-box').innerHTML = '<form class="adm-card" id="s-form"><div class="adm-form">' +
                '<label class="full">Announcement bar (shown at the top of every page, leave empty for none)<input name="announcement" maxlength="140" value="' + esc(st.announcement || '') + '" placeholder="e.g. Free delivery in Dubai on orders over AED 300"></label>' +
                '<label class="full">Bank details (shown to customers who choose bank transfer, leave empty to hide that option)<textarea name="bank" rows="5" placeholder="Bank name&#10;Account name&#10;IBAN&#10;Swift">' + esc(st.bank_details || '') + '</textarea></label>' +
                '</div><div class="adm-row"><span class="grow"></span><button class="adm-btn" type="submit">Save settings</button></div></form>' +
                '<div class="adm-card"><h3>Admin team</h3><p>Admins are the emails listed in your database (table <code>admin_emails</code>). To add a person, run this in Supabase SQL Editor, then ask them to create an account with that email:</p><pre>insert into public.admin_emails values (\'name@grapetree.ae\');</pre></div>';
            $('#s-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var f = e.target;
                B.saveContent('settings', { announcement: f.announcement.value.trim(), bank_details: f.bank.value.trim() }).then(function () { try { localStorage.removeItem('gt-content-v1'); } catch (x) {} toast('Settings saved'); }).catch(fail);
            });
        });
    }

    /* ============================ BUSINESS INFO ============================ */
    var BIZ_FIELDS = [
        ['Contact details shown on the whole website', [
            ['whatsapp', 'WhatsApp number (digits only, country code first)', 'e.g. 971555577478', 'Used by the green WhatsApp button, the footer and "Order on WhatsApp".'],
            ['phone', 'Phone number (optional)', 'e.g. +971 4 000 0000', 'Shown in the footer.'],
            ['email', 'Public email address', 'e.g. hello@grapetree.ae', 'Shown in the footer so customers can write to you.'],
            ['address', 'Address', 'Office / shop address', 'Shown in the footer.'],
            ['mapQuery', 'Map search (optional)', 'e.g. Grape Tree FZE, SAIF Zone, Sharjah', 'What the footer map shows. Leave empty to use the address.'],
            ['hours', 'Opening hours', 'e.g. Sun to Thu, 9:00 to 18:00', 'Shown in the footer.']]],
        ['Social links (leave empty to hide)', [
            ['instagramKatanukiya', 'Katanukiya Instagram link', 'https://instagram.com/...', ''],
            ['instagramGildart', 'GildArt Instagram link', 'https://instagram.com/...', ''],
            ['tiktok', 'TikTok link', 'https://tiktok.com/@...', ''],
            ['facebook', 'Facebook link', 'https://facebook.com/...', '']]],
        ['Order emails', [
            ['notify_emails', 'Email addresses that receive every new order (separate with commas)', 'you@gmail.com, partner@gmail.com', 'The order email with design files is sent here. If empty, the ADMIN_EMAILS secret in Supabase is used.'],
            ['reply_to', 'Reply-to email for customers', 'support@grapetree.ae', 'When a customer replies to the confirmation email, it goes here.']]]
    ];
    function viewBusiness() {
        root.innerHTML = '<div class="adm-bar"><h2>Business info</h2></div><p class="adm-lead">Change your contact details here and the whole website updates: footer, WhatsApp buttons, order messages and order emails. No code needed.</p><div id="b-box"><p class="adm-loading">Loading...</p></div>';
        B.content().then(function (c) {
            CONTENT = c || {};
            var cur = CONTENT.business || {}, co = CFG.company || {}, so = CFG.social || {};
            var def = { whatsapp: CFG.whatsapp, phone: co.phone, email: co.email, address: co.address, mapQuery: co.mapQuery, hours: co.hours, instagramKatanukiya: so.instagramKatanukiya, instagramGildart: so.instagramGildart, tiktok: so.tiktok, facebook: so.facebook };
            var html = '<form class="adm-card" id="b-form">';
            BIZ_FIELDS.forEach(function (g) {
                html += '<h3>' + esc(g[0]) + '</h3><div class="adm-form">';
                g[1].forEach(function (f) {
                    var v = cur[f[0]] != null ? cur[f[0]] : (def[f[0]] || '');
                    html += '<label class="full">' + esc(f[1]) + '<input name="' + f[0] + '" value="' + esc(v) + '" placeholder="' + esc(f[2]) + '" autocomplete="off">' + (f[3] ? '<small>' + esc(f[3]) + '</small>' : '') + '</label>';
                });
                html += '</div>';
            });
            var hasPin = isFinite(parseFloat(cur.lat)) && isFinite(parseFloat(cur.lng));
            html += '<h3>Our location on the map</h3><div class="adm-map">' +
                '<p class="adm-hint">Click the map or drag the pin to the exact spot. This is the map customers see at the bottom of every page, and "Get directions" opens this exact pin.</p>' +
                '<div class="adm-map-tools"><input id="m-q" type="search" placeholder="Search a place or address, e.g. SAIF Zone, Sharjah" autocomplete="off"><button type="button" class="adm-btn ghost" id="m-find">Search</button><button type="button" class="adm-btn ghost" id="m-me">Use my current location</button></div>' +
                '<div class="adm-map-tools"><input id="m-link" type="url" placeholder="Or paste a Google Maps link here (the long link with @25.3,55.4)" autocomplete="off"><button type="button" class="adm-btn ghost" id="m-use">Use link</button></div>' +
                '<div id="m-map" class="adm-map-box" aria-label="Map"><p class="adm-hint" style="padding:18px">Loading the map...</p></div>' +
                '<div class="adm-grid2"><label>Latitude<input name="lat" id="m-lat" inputmode="decimal" value="' + esc(hasPin ? cur.lat : '') + '" placeholder="e.g. 25.3463"></label><label>Longitude<input name="lng" id="m-lng" inputmode="decimal" value="' + esc(hasPin ? cur.lng : '') + '" placeholder="e.g. 55.4209"></label></div>' +
                '<div class="adm-row"><span class="adm-hint" id="m-state">' + (hasPin ? 'Pin is set.' : 'No pin yet: the website uses the address text instead.') + '</span><span class="grow"></span><button type="button" class="adm-btn ghost" id="m-clear">Remove pin</button></div></div>';
            html += '<p class="adm-err" id="b-err" role="alert"></p><div class="adm-row"><span class="grow"></span><button class="adm-btn" type="submit">Save business info</button></div></form>';
            $('#b-box').innerHTML = html;
            initMapPicker();
            $('#b-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var f = e.target, v = {}, err = '';
                BIZ_FIELDS.forEach(function (g) { g[1].forEach(function (x) { v[x[0]] = f[x[0]].value.trim(); }); });
                v.whatsapp = digits(v.whatsapp);
                var la = f.lat.value.trim().replace(',', '.'), ln = f.lng.value.trim().replace(',', '.');
                if (la || ln) {
                    if (!isFinite(parseFloat(la)) || !isFinite(parseFloat(ln)) || Math.abs(la) > 90 || Math.abs(ln) > 180) err = 'The map pin is not valid. Click the map to place it again, or press "Remove pin".';
                    else { v.lat = Math.round(parseFloat(la) * 1e6) / 1e6; v.lng = Math.round(parseFloat(ln) * 1e6) / 1e6; }
                } else { v.lat = ''; v.lng = ''; }
                if (!err && v.whatsapp && v.whatsapp.length < 9) err = 'The WhatsApp number looks too short. Use digits only, with the country code (for example 971555577478).';
                var mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
                if (!err && v.email && !mail.test(v.email)) err = 'The public email address is not valid.';
                if (!err && v.reply_to && !mail.test(v.reply_to)) err = 'The reply-to email address is not valid.';
                if (!err && v.notify_emails && !v.notify_emails.split(',').every(function (x) { return mail.test(x.trim()); })) err = 'One of the order notification emails is not valid. Separate several with commas.';
                ['instagramKatanukiya', 'instagramGildart', 'tiktok', 'facebook'].forEach(function (k) { if (!err && v[k] && !/^https?:\/\//i.test(v[k])) err = 'Social links must start with https://'; });
                $('#b-err').textContent = err; if (err) return;
                B.saveContent('business', v).then(function () {
                    return B.client.from('site_content').select('value').eq('key', 'business').maybeSingle();          // read it back to be sure it really is saved
                }).then(function (r) {
                    var got = r && r.data && r.data.value;
                    if (!got || got.email !== v.email || got.address !== v.address) throw new Error('The database did not keep the change. Please try again, or tell your developer.');
                    CONTENT.business = v; cacheSet('business', v); toast('Saved and live. Visitors see the new details when they open or refresh a page.');
                }).catch(fail);
            });
        });
    }


    /* ---- map location picker (Leaflet + OpenStreetMap, free, no key) ---- */
    function loadLeaflet(cb) {
        if (window.L && window.L.map) return cb();
        if (!document.getElementById('lf-css')) { var l = document.createElement('link'); l.id = 'lf-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
        var sc = document.createElement('script'); sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        sc.onload = function () { cb(); }; sc.onerror = function () { cb(new Error('x')); }; document.head.appendChild(sc);
    }
    function initMapPicker() {
        var box = $('#m-map'); if (!box) return;
        var la = $('#m-lat'), ln = $('#m-lng'), state = $('#m-state'), map = null, pin = null;
        function say(t) { if (state) state.textContent = t; }
        function setPin(lat, lng, fly) {
            lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6;
            la.value = lat; ln.value = lng; say('Pin is set. Press "Save business info" to publish it.');
            if (!map) return;
            if (!pin) {
                pin = L.marker([lat, lng], { draggable: true }).addTo(map);
                pin.on('dragend', function () { var p = pin.getLatLng(); setPin(p.lat, p.lng); });
            } else pin.setLatLng([lat, lng]);
            if (fly) map.setView([lat, lng], Math.max(map.getZoom(), 16));
        }
        function fromInputs() {
            var a = parseFloat(la.value.replace(',', '.')), b = parseFloat(ln.value.replace(',', '.'));
            if (isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) setPin(a, b, true);
        }
        la.addEventListener('change', fromInputs); ln.addEventListener('change', fromInputs);
        $('#m-clear').addEventListener('click', function () { la.value = ''; ln.value = ''; if (pin && map) { map.removeLayer(pin); pin = null; } say('Pin removed. Press "Save business info" so the website uses the address text again.'); });
        $('#m-use').addEventListener('click', function () {
            var t = decodeURIComponent($('#m-link').value || ''), m = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
            if (m) setPin(parseFloat(m[1]), parseFloat(m[2]), true);
            else say('I could not find the position in that link. Open the place in Google Maps, copy the full address-bar link (not the short maps.app.goo.gl link), or just click the map.');
        });
        function find() {
            var q = $('#m-q').value.trim(); if (!q) return;
            say('Searching...');
            fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ae&q=' + encodeURIComponent(q), { headers: { 'Accept': 'application/json' } })
                .then(function (r) { return r.json(); })
                .then(function (j) { if (j && j[0]) { setPin(parseFloat(j[0].lat), parseFloat(j[0].lon), true); } else say('Nothing found. Try a simpler name, or click the map yourself.'); })
                .catch(function () { say('Search is not available now. Click the map to place the pin.'); });
        }
        $('#m-find').addEventListener('click', find);
        $('#m-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } });
        $('#m-me').addEventListener('click', function () {
            if (!navigator.geolocation) return say('Your browser cannot share its location.');
            say('Asking your device for its location...');
            navigator.geolocation.getCurrentPosition(function (p) { setPin(p.coords.latitude, p.coords.longitude, true); }, function () { say('Location was not allowed. Click the map instead.'); }, { enableHighAccuracy: true, timeout: 10000 });
        });
        loadLeaflet(function (err) {
            if (err || !window.L) { box.innerHTML = '<p class="adm-hint" style="padding:18px">The map could not load (check your internet). You can still type the latitude and longitude below.</p>'; return; }
            box.innerHTML = '';
            var a = parseFloat(la.value), b = parseFloat(ln.value), has = isFinite(a) && isFinite(b);
            map = L.map(box, { scrollWheelZoom: false, tap: true }).setView(has ? [a, b] : [25.2048, 55.2708], has ? 16 : 10);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
            map.on('click', function (e) { setPin(e.latlng.lat, e.latlng.lng); });
            map.on('focus', function () { map.scrollWheelZoom.enable(); }); map.on('blur', function () { map.scrollWheelZoom.disable(); });
            if (has) setPin(a, b);
            setTimeout(function () { map.invalidateSize(); }, 200);
        });
    }

    /* ============================ TEAM (admin only) ============================ */
    function team(body) {
        return B.client.functions.invoke('team-admin', { body: body }).then(function (r) {
            var d = r.data || {};
            if (d.error) throw new Error(d.error + (d.detail ? ' (' + d.detail + ')' : ''));
            if (r.error) {
                var m = r.error.message || String(r.error);
                if (r.error.context && r.error.context.json) return r.error.context.json().then(function (j) { throw new Error((j && j.error) || m); }, function () { throw new Error(m); });
                throw new Error(/not found|404|Failed to send|fetch/i.test(m) ? 'The team-admin function is not deployed yet (see supabase/functions/team-admin/index.ts).' : m);
            }
            return d;
        });
    }
    function askPassword(title, email) {
        return new Promise(function (resolve) {
            var d = doc.createElement('div'); d.className = 'adm-modal open';
            d.innerHTML = '<div class="adm-dialog small"><h3 style="margin:0 0 6px">' + esc(title) + '</h3><p class="adm-fine">' + esc(email) + '</p>' +
                '<label>New password (at least 8 characters)<input type="text" id="pw-new" autocomplete="off" spellcheck="false"></label><p class="adm-err" id="pw-err" role="alert"></p>' +
                '<div class="adm-row end"><button class="adm-btn ghost" data-no>Cancel</button><button class="adm-btn" data-yes>Save password</button></div></div>';
            doc.body.appendChild(d); $('#pw-new', d).focus();
            d.addEventListener('click', function (e) {
                if (e.target.closest('[data-yes]')) {
                    var v = $('#pw-new', d).value; if (v.length < 8) { $('#pw-err', d).textContent = 'Please use at least 8 characters.'; return; }
                    d.remove(); resolve(v);
                } else if (e.target.closest('[data-no]') || e.target === d) { d.remove(); resolve(null); }
            });
        });
    }
    function viewTeam() {
        root.innerHTML = '<div class="adm-bar"><h2>Team</h2></div>' +
            '<section class="adm-card"><h3>Create a staff account</h3>' +
            '<p class="adm-fine">You choose the email and the password, then give both to your staff member. Staff can see and update orders and customer designs only. They cannot change products, prices, website content, business info or legal texts, delete orders, or add other staff.</p>' +
            '<form id="t-form" novalidate><div class="adm-grid2"><label>Name<input type="text" id="t-name" autocomplete="off"></label>' +
            '<label>Email (their sign-in)<input type="email" id="t-email" placeholder="name@example.com" autocomplete="off" required></label></div>' +
            '<label>Password (at least 8 characters)<input type="text" id="t-pass" autocomplete="off" spellcheck="false" required></label>' +
            '<p class="adm-err" id="t-err" role="alert"></p><div class="adm-row"><button class="adm-btn" type="submit">Create staff account</button><span class="grow"></span></div></form>' +
            '<p class="adm-fine">They sign in at <strong>grapetree.ae/admin.html</strong> with this email and password, and see the Orders page only.</p></section>' +
            '<section class="adm-card"><h3>People with access</h3><div id="t-list"><p class="adm-loading">Loading...</p></div></section>';
        function draw() {
            B.teamList().then(function (rows) {
                $('#t-list').innerHTML = (rows && rows.length) ? '<ul class="adm-team">' + rows.map(function (p) {
                    var staff = p.role === 'staff';
                    return '<li><div><strong>' + esc(p.name || p.email) + '</strong>' + (p.name ? '<br><small>' + esc(p.email) + '</small>' : '') + '</div>' +
                        '<span class="chip ' + (staff ? 'st-confirmed' : 'st-preparing') + '">' + (staff ? (p.pending ? 'Staff - not signed up yet' : 'Staff') : 'Admin') + '</span>' +
                        (staff ? '<span class="adm-row">' + (p.pending ? '' : '<button class="adm-btn ghost" type="button" data-pw="' + esc(p.email) + '">Change password</button>') + '<button class="adm-btn danger" type="button" data-rm="' + esc(p.email) + '">Delete</button></span>' : '<span></span>') + '</li>';
                }).join('') + '</ul>' : '<p class="adm-empty">No one yet.</p>';
                $$('[data-pw]', $('#t-list')).forEach(function (b) {
                    b.addEventListener('click', function () {
                        var em = b.getAttribute('data-pw');
                        askPassword('Change password', em).then(function (pw) { if (pw) team({ action: 'password', email: em, password: pw }).then(function () { toast('Password changed for ' + em); }).catch(fail); });
                    });
                });
                $$('[data-rm]', $('#t-list')).forEach(function (b) {
                    b.addEventListener('click', function () {
                        var em = b.getAttribute('data-rm');
                        confirmBox('Delete the staff account ' + em + '? They will not be able to sign in any more. Orders they handled are kept.', 'Delete account').then(function (yes) {
                            if (yes) team({ action: 'delete', email: em }).then(function () { toast('Account deleted'); draw(); }).catch(fail);
                        });
                    });
                });
            }).catch(function (e) { $('#t-list').innerHTML = '<p class="adm-err">Could not load the team: ' + esc(e.message || e) + '<br>Run supabase/v10-update.sql in the Supabase SQL Editor first.</p>'; });
        }
        $('#t-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var em = $('#t-email').value.trim(), pw = $('#t-pass').value, err = $('#t-err'), btn = $('button', e.target); err.textContent = '';
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = 'Please type a valid email address.'; return; }
            if (pw.length < 8) { err.textContent = 'The password needs at least 8 characters.'; return; }
            btn.disabled = true;
            team({ action: 'create', email: em, password: pw, name: $('#t-name').value.trim() }).then(function () {
                toast('Staff account created for ' + em); $('#t-email').value = ''; $('#t-pass').value = ''; $('#t-name').value = ''; draw();
            }).catch(function (x) { err.textContent = x.message || String(x); }).then(function () { btn.disabled = false; });
        });
        draw();
    }

    /* ============================ LEGAL TEXTS ============================ */
    function viewLegal() {
        root.innerHTML = '<div class="adm-bar"><h2>Legal &amp; copyright protection</h2></div>' +
            '<p class="adm-lead">These texts appear on your Terms, Content &amp; Copyright and Privacy pages, in the reminder customers see before uploading, and in the agreements they must tick before ordering. Every order saves which version the customer accepted, with the date, time and IP address, as proof.</p>' +
            '<div class="adm-note"><b>Please have a UAE lawyer review these texts once.</b> They are a careful starting point, not legal advice. Tip: start a line with <code># </code> for a heading and <code>- </code> for a bullet point.</div><div id="g-box"><p class="adm-loading">Loading...</p></div>';
        B.content().then(function (c) {
            CONTENT = c || {};
            if (!window.GTLegal) { $('#g-box').innerHTML = '<p class="adm-err">legal.js is missing. Please upload it with the website files.</p>'; return; }
            cacheSet('legal', CONTENT.legal || undefined);
            var L = GTLegal.merge(GTLegal.DEFAULTS, CONTENT.legal || null), D = GTLegal.DEFAULTS;
            function ta(name, label, val, rows, hint) { return '<label class="full">' + esc(label) + '<textarea name="' + name + '" rows="' + rows + '">' + esc(val) + '</textarea>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>'; }
            function inp(name, label, val, hint) { return '<label class="full">' + esc(label) + '<input name="' + name + '" value="' + esc(val) + '">' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>'; }
            $('#g-box').innerHTML = '<form class="adm-card" id="g-form"><p class="adm-fine">Current text version: <strong>' + esc(L.version) + '</strong>. It goes up by one each time you save a change.</p>' +
                '<h3>Reminders and agreements</h3><div class="adm-form">' +
                ta('reminder', 'Reminder shown before a customer uploads or writes anything (one point per line)', L.reminder.join('\n'), 5, '') +
                inp('c_upload', 'Tick-box before uploading', L.consent.upload, 'Use {content} to link to the Content & Copyright page.') +
                ta('c_studio', 'Tick-boxes on the final step of the studio (one per line)', L.consent.studio.join('\n'), 5, 'Each line becomes a separate tick-box the customer must accept.') +
                inp('c_checkout', 'Tick-box at checkout', L.consent.checkout, 'Use {terms}, {content} and {privacy} to create links to the three pages.') + '</div>' +
                '<h3>Terms of Sale &amp; Custom Orders</h3><div class="adm-form">' + inp('t_title', 'Page title', L.docs.terms.title) + ta('t_text', 'Text', L.docs.terms.text, 16) + '</div>' +
                '<h3>Content &amp; Copyright Policy</h3><div class="adm-form">' + inp('p_title', 'Page title', L.docs.content.title) + ta('p_text', 'Text', L.docs.content.text, 16) + '</div>' +
                '<h3>Privacy Policy</h3><div class="adm-form">' + inp('v_title', 'Page title', L.docs.privacy.title) + ta('v_text', 'Text', L.docs.privacy.text, 12) + '</div>' +
                '<div class="adm-row"><a class="adm-btn ghost" href="terms.html" target="_blank" rel="noopener">View Terms</a><a class="adm-btn ghost" href="content-policy.html" target="_blank" rel="noopener">View Content policy</a><a class="adm-btn ghost" href="privacy.html" target="_blank" rel="noopener">View Privacy</a><span class="grow"></span><button class="adm-btn ghost" type="button" id="g-reset">Restore the original texts</button><button class="adm-btn" type="submit">Save legal texts</button></div></form>';
            $('#g-reset').addEventListener('click', function () {
                confirmBox('Restore all legal texts to the original version? Your changes will be replaced.', 'Restore').then(function (yes) {
                    if (!yes) return;
                    var nv = (L.version || 1) + 1, o = JSON.parse(JSON.stringify(D)); o.version = nv;
                    B.saveContent('legal', o).then(function () { CONTENT.legal = o; cacheSet('legal', o); toast('Original texts restored'); viewLegal(); }).catch(fail);
                });
            });
            $('#g-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var f = e.target, lines = function (v) { return v.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); };
                var o = { version: L.version, docs: { terms: { title: f.t_title.value.trim() || D.docs.terms.title, text: f.t_text.value.trim() }, content: { title: f.p_title.value.trim() || D.docs.content.title, text: f.p_text.value.trim() }, privacy: { title: f.v_title.value.trim() || D.docs.privacy.title, text: f.v_text.value.trim() } },
                    reminder: lines(f.reminder.value), consent: { upload: f.c_upload.value.trim(), studio: lines(f.c_studio.value), checkout: f.c_checkout.value.trim() } };
                if (!o.reminder.length || !o.consent.studio.length || !o.consent.upload || !o.consent.checkout) { toast('The reminder and the tick-box texts cannot be empty.', true); return; }
                var same = JSON.stringify([o.docs, o.reminder, o.consent]) === JSON.stringify([L.docs, L.reminder, L.consent]);
                if (!same) o.version = (L.version || 1) + 1;
                B.saveContent('legal', o).then(function () { CONTENT.legal = o; cacheSet('legal', o); toast(same ? 'Nothing changed' : 'Saved. New text version: ' + o.version); if (!same) viewLegal(); }).catch(fail);
            });
        });
    }

    /* ------------------------------ start ------------------------------ */
    B.ready.then(function () { gate(); if (B.isStaff()) loadOrders(); });
    B.onAuth(function () { gate(); if (B.isStaff() && tab !== 'orders') loadOrders(); else if (B.isStaff()) { /* orders view loads itself */ } });
    setInterval(function () { if (B.isStaff() && !doc.hidden && (tab === 'orders' || tab === 'dashboard') && !$('.adm-order [aria-expanded=true]')) loadOrders(); }, 90000);
})();
