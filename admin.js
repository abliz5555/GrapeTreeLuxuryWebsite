/* =====================================================================
   GRAPE TREE - ADMIN DASHBOARD
   Orders, products, website images and settings.
   Only people listed as admins (see supabase/setup.sql) can open this.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document, B = window.GT.backend, CFG = (window.GT_DATA || {}).config || {};
    var root = doc.getElementById('adm-root'), tabsEl = doc.getElementById('adm-tabs'), outBtn = doc.getElementById('adm-out'), menuBtn = doc.getElementById('adm-menu');
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
    function otot(o) { return o.total != null && o.total !== '' ? Number(o.total) : Number(o.subtotal || 0); }
    function dt(s) { try { return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    function digits(s) { return String(s || '').replace(/\D/g, ''); }

    /* ------------------------------ gate ------------------------------ */
    function gate() {
        tabsEl.hidden = true; menuBtn.hidden = true; outBtn.hidden = !B.session;
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
        $$('.adm-grp', tabsEl).forEach(function (g) { g.hidden = !B.isAdmin(); });
        tabsEl.hidden = false; menuBtn.hidden = false; show(tab);
    }
    function card(html) { return '<div class="adm-card narrow">' + html + '</div>'; }

    outBtn.addEventListener('click', function () { B.signOut(); });
    doc.addEventListener('click', function (e) { var g = e.target.closest ? e.target.closest('[data-go]') : null; if (g) show(g.getAttribute('data-go')); });
    tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) { show(b.getAttribute('data-tab')); closeMenu(); } });
    function closeMenu() { var t = doc.querySelector('.adm-top'); t.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
    menuBtn.addEventListener('click', function () { var t = doc.querySelector('.adm-top'), on = !t.classList.contains('open'); t.classList.toggle('open', on); menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    function show(t) {
        if (!B.isAdmin()) t = 'orders';
        tab = t;
        $$('[data-tab]', tabsEl).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
        ({ dashboard: viewDashboard, customers: viewCustomers, team: viewTeam, business: viewBusiness, legal: viewLegal, orders: viewOrders, products: viewProducts, website: viewWebsite, studio: viewStudio, test: viewTest, settings: viewSettings })[t]();
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
        var sum = function (a) { return a.reduce(function (t, o) { return t + Number(otot(o) || 0); }, 0); };
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
            return '<button type="button" class="adm-row-btn" data-open="' + esc(o.id) + '"><span class="o-no">#' + esc(o.order_no) + '</span><span class="grow"><strong>' + esc(o.name) + '</strong><small>' + esc(dt(o.created_at)) + (o.delivery_date ? ' &middot; deliver ' + esc(o.delivery_date) : '') + '</small></span>' + (extra || '') + '<span class="o-total">' + esc(money(otot(o))) + '</span></button>';
        }
        var quick = '<div class="adm-quick"><h3>Quick actions</h3><div class="adm-qgrid">' +
            [['orders', 'See all orders'], ['products', 'Add or edit a product'], ['business', 'Delivery prices, TRN and VAT'], ['website', 'Edit website texts and photos'], ['settings', 'Announcement and bank details'], ['test', 'Test the studio']].map(function (q) { return '<button type="button" class="adm-qbtn" data-go="' + q[0] + '">' + esc(q[1]) + ' <span aria-hidden="true">&rarr;</span></button>'; }).join('') + '</div></div>';
        box.innerHTML = quick + '<div class="adm-stats">' +
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
                '<span class="o-total">' + esc(money(otot(o))) + (o.has_quote ? ' +' : '') + '</span><span class="o-chips">' + chipsFor(o) + '</span></button>' +
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
        ['confirm', 'Order confirmed', function (o) { return 'Hello ' + o.name + ', thank you for your order #' + o.order_no + ' with Grape Tree. We have confirmed it' + (o.delivery_date ? ' for delivery on ' + o.delivery_date : '') + '. Total: ' + money(otot(o)) + '. We will keep you updated.'; }],
        ['image', 'Please send a better image', function (o) { return 'Hello ' + o.name + ', this is Grape Tree about order #' + o.order_no + '. To print your design well we need a clearer, higher-resolution image (a PNG or JPG of at least 1000 px). Could you please send it here?'; }],
        ['proof', 'Design ready: please approve', function (o) { return 'Hello ' + o.name + ', your design for order #' + o.order_no + ' is ready. Please check the attached proof and reply "APPROVED" so we can start production. Production starts only after your approval.'; }],
        ['rights', 'We need proof of rights / permission', function (o) { return 'Hello ' + o.name + ', this is Grape Tree about order #' + o.order_no + '. Your design may include a logo, character or artwork that belongs to someone else. Before we can produce it, please send us the written permission or licence from the owner. Thank you for understanding.'; }],
        ['cannot', 'We cannot print this design', function (o) { return 'Hello ' + o.name + ', thank you for your order #' + o.order_no + '. Unfortunately we cannot produce this design because it does not meet our Content & Copyright Policy (copyright, trademark or content reasons). You are welcome to send us a different design and we will gladly continue. Any payment made will be refunded.'; }],
        ['payment', 'Payment reminder', function (o) { return 'Hello ' + o.name + ', a friendly reminder that order #' + o.order_no + ' (' + money(otot(o)) + ') is waiting for payment. We start production once it is received. Thank you!'; }],
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
            (o.total != null && o.total !== '' ? '<p class="adm-fine">Items ' + esc(money(o.subtotal)) + ' &middot; Delivery ' + (Number(o.delivery_fee) > 0 ? esc(money(o.delivery_fee)) : 'FREE') + ' &middot; VAT ' + esc(o.vat_rate) + '% ' + esc(money(o.vat_amount)) + (o.prices_include_vat ? ' (included)' : '') + (o.trn ? ' &middot; TRN ' + esc(o.trn) : '') + '</p>' : '') +
            '<p class="o-sum"><span>' + (o.total != null && o.total !== '' ? 'Order total' : 'Estimated total') + '</span><strong>' + esc(money(otot(o))) + (o.has_quote ? ' + quoted items' : '') + '</strong></p></div>' +
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
            '<a class="adm-btn" data-wa href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' + (o.email ? '<a class="adm-btn ghost" data-mail href="mailto:' + esc(o.email) + '?subject=' + encodeURIComponent('Grape Tree order #' + o.order_no) + '&body=' + encodeURIComponent(tplText(o, 'confirm')) + '">Email</a>' : '') + '<button class="adm-btn ghost" data-print>Job sheet (PDF)</button><button class="adm-btn ghost" data-printc>Customer confirmation (PDF)</button>' + (B.isAdmin() ? '<button class="adm-btn danger" data-del-order type="button">Delete order</button>' : '') + '</div>' +
            cancelBlock(o) +
            historyBlock(o);
    }
    var CANCEL_REASONS = ['Customer asked to cancel', 'Design cannot be produced', 'Item or date not available', 'Delivery not possible to this address', 'Payment not received', 'Duplicate order', 'Other'];
    function cancelBlock(o) {
        if (o.status === 'cancelled') {
            return '<div class="o-cancel done"><h4>Order cancelled</h4><p><strong>Reason:</strong> ' + esc(o.cancel_reason || 'Not recorded') + (o.cancelled_at ? '<br><small>' + esc(dt(o.cancelled_at)) + '</small>' : '') + '</p>' +
                '<button type="button" class="adm-btn ghost" data-reopen>Reopen this order</button></div>';
        }
        return '<div class="o-cancel"><button type="button" class="adm-btn danger ghost" data-cancel-open>Cancel this order</button>' +
            '<div class="o-cancel-form" hidden><h4>Cancel order #' + esc(o.order_no) + '</h4>' +
            '<label>Reason<select data-c-reason>' + CANCEL_REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></label>' +
            '<label>Details for the customer (optional)<input type="text" data-c-detail maxlength="300" placeholder="e.g. The design uses a protected brand, so we cannot print it"></label>' +
            (o.email ? '<label class="chk"><input type="checkbox" data-c-mail checked> Email the customer with this reason (' + esc(o.email) + ')</label>' : '<p class="adm-fine">This customer left no email, so they will see the reason in their account only.</p>') +
            '<div class="adm-row"><button type="button" class="adm-btn danger" data-cancel-go>Yes, cancel the order</button><button type="button" class="adm-btn ghost" data-cancel-close>Keep the order</button></div></div></div>';
    }
    function doCancel(o, artEl, reason, detail, sendMail) {
        var full = reason + (detail ? ': ' + detail : '');
        var patch = { status: 'cancelled', cancel_reason: full, cancelled_at: new Date().toISOString() };
        return saveOrder(o, patch, 'Order cancelled. Reason: ' + full, artEl, { pub: true, status: 'cancelled', msg: 'Your order was cancelled. Reason: ' + full }).then(function () {
            if (o.status !== 'cancelled' || !o.email || !sendMail) return;
            return B.client.functions.invoke('smart-endpoint', { body: { action: 'cancel', order_id: o.id } }).then(function (r) {
                if (r && r.error) throw r.error;
                toast('Cancelled. The customer was emailed.');
            }).catch(function () { toast('Order cancelled, but the email could not be sent. Please tell the customer on WhatsApp.', true); });
        });
    }
    function renderBody(artEl, o) { var body = $('.o-body', artEl); body.innerHTML = orderBody(o); loadThumbs(body); var h = $('.o-head', artEl); $('.o-chips', h).innerHTML = chipsFor(o); }
    doc.addEventListener('click', function (e) {
        var cb = e.target.closest('[data-cancel-open],[data-cancel-close],[data-cancel-go],[data-reopen]');
        if (cb) {
            var ca = cb.closest('.adm-order'), co = ORDERS.filter(function (x) { return x.id === ca.getAttribute('data-id'); })[0], form = $('.o-cancel-form', ca);
            if (cb.hasAttribute('data-cancel-open')) { form.hidden = false; cb.hidden = true; }
            else if (cb.hasAttribute('data-cancel-close')) { form.hidden = true; $('[data-cancel-open]', ca).hidden = false; }
            else if (cb.hasAttribute('data-cancel-go')) {
                cb.disabled = true;
                doCancel(co, ca, $('[data-c-reason]', ca).value, $('[data-c-detail]', ca).value.trim(), !!($('[data-c-mail]', ca) && $('[data-c-mail]', ca).checked)).then(function () { cb.disabled = false; });
            } else if (cb.hasAttribute('data-reopen')) {
                if (!window.confirm('Reopen order #' + co.order_no + '? It will go back to Confirmed.')) return;
                saveOrder(co, { status: 'confirmed', cancel_reason: null, cancelled_at: null }, 'Order reopened', ca, { pub: true, status: 'confirmed', msg: 'Your order is active again.' });
            }
            return;
        }
        var head = e.target.closest('.o-head');
        if (head) {
            var art = head.parentNode, body = $('.o-body', art), open = head.getAttribute('aria-expanded') === 'true';
            head.setAttribute('aria-expanded', open ? 'false' : 'true'); body.hidden = open;
            if (!open && !body.innerHTML) { body.innerHTML = orderBody(ORDERS.filter(function (o) { return o.id === art.getAttribute('data-id'); })[0]); }
            if (!open) loadThumbs(body);
            return;
        }
        var pr = e.target.closest('[data-print]');
        if (pr) { printOrder(ORDERS.filter(function (o) { return o.id === pr.closest('.adm-order').getAttribute('data-id'); })[0], 'job'); return; }
        var prc = e.target.closest('[data-printc]');
        if (prc) { printOrder(ORDERS.filter(function (o) { return o.id === prc.closest('.adm-order').getAttribute('data-id'); })[0], 'customer'); return; }
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
        if (key === 'status' && f.value === 'cancelled' && o.status !== 'cancelled') {          // a cancellation always needs a reason
            f.value = o.status; var cf = $('.o-cancel-form', art), co2 = $('[data-cancel-open]', art);
            if (cf) { cf.hidden = false; if (co2) co2.hidden = true; cf.scrollIntoView({ block: 'center' }); }
            toast('Please choose the reason to cancel this order.', true); return;
        }
        patch[key] = f.value;
        if (key === 'status' && o.status === 'cancelled' && f.value !== 'cancelled') { patch.cancel_reason = null; patch.cancelled_at = null; }
        var what = key === 'status' ? 'Status: ' + (STATUS_NAME[f.value] || f.value) : key === 'payment_status' ? 'Payment: ' + (f.value === 'paid' ? 'Paid' : 'Not paid') :
            key === 'art_review' ? 'Design review: ' + (REVIEW_NAME[f.value] || f.value) : key === 'art_review_note' ? 'Review note: ' + f.value : 'Private note: ' + f.value;
        var extra = null, pm = $('[data-pubmsg]', art), msg = pm ? pm.value.trim() : '';
        if (key === 'status') extra = { pub: true, status: f.value, msg: msg };                       // every status change shows on the customer's tracking page
        else if (key === 'art_review' && (f.value === 'approved' || f.value === 'changes' || f.value === 'rejected'))
            extra = { pub: true, msg: f.value === 'approved' ? 'Your design is approved for production.' : (f.value === 'changes' ? 'We need a change to your design.' : 'We cannot produce this design.') + ((o.art_review_note || '') ? ' ' + o.art_review_note : '') };
        saveOrder(o, patch, what, art, extra);
    });
    function printOrder(o, mode) {
        var w = window.open('', '_blank'); if (!w) return toast('Please allow pop-ups to print.', true);
        w.document.write('<!doctype html><title>Preparing...</title><p style="font:16px Arial;padding:30px">Preparing the document...</p>');
        var jobs = [], thumbs = {};
        if (mode === 'job') (o.items || []).forEach(function (l) {
            var a = l.art; if (!a || !a.folder || !a.files) return;
            ['orig', 'preview'].forEach(function (k) {
                if (!a.files[k]) return; var path = a.folder + '/' + a.files[k];
                jobs.push(B.client.storage.from('order-art').createSignedUrl(path, 3600).then(function (r) { if (r && r.data && r.data.signedUrl) thumbs[path] = r.data.signedUrl; }).catch(function () { }));
            });
        });
        var bankP = B.content().then(function (c) { return { bank: (c.settings || {}).bank_details || '', biz: c.business || {} }; }).catch(function () { return { bank: '', biz: {} }; });
        Promise.all(jobs.concat([bankP])).then(function (r) {
            var bk = r[r.length - 1], bank = mode === 'job' ? '' : bk.bank, base = location.href.replace(/[^\/]*$/, '');
            w.document.open();
            w.document.write('<!doctype html><html><head><meta charset="utf-8"><base href="' + base + '"><title>' + (mode === 'job' ? 'Job sheet' : 'Order') + ' #' + esc(o.order_no) + '</title>' +
                '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="invoice.css?v=17"></head><body>' +
                '<div class="inv-bar no-print"><span class="inv-hint" style="margin:0">Choose "Save as PDF" in the print window to download</span><button type="button" class="inv-btn" onclick="print()">Print / Save PDF</button></div>' +
                '<div id="d"></div><script src="shop-data.js?v=17"><\/script><script src="pricing.js?v=17"><\/script><script src="orderdoc.js?v=17"><\/script><script>document.getElementById("d").innerHTML=GTOrderDoc.build(' + JSON.stringify(o).replace(/</g, '\\u003c') + ',' + JSON.stringify({ mode: mode, bank: bank, thumbs: thumbs, biz: bk.biz }).replace(/</g, '\\u003c') + ');setTimeout(function(){print()},900)<\/script></body></html>');
            w.document.close();
        });
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
        root.innerHTML = '<div class="adm-card"><h2>Test and checks</h2><h3>Test the design studio</h3>' +
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
            box.innerHTML = '<ul class="adm-checklist">' + rows.map(function (o) { return '<li><b>#' + esc(o.order_no) + '</b><span>' + esc(new Date(o.created_at).toLocaleString()) + ' \u00b7 ' + esc(money(otot(o))) + '</span></li>'; }).join('') + '</ul>' +
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
        root.innerHTML = '<div class="adm-card"><h3>Custom design: prices, minimum order and options</h3><p class="adm-lead">Choose a product, change what you need, and press <b>Save changes</b> at the bottom. Customers see the new prices and rules straight away.</p>' +
            '<div class="adm-seg" id="s-seg"><button type="button" data-p="cake">Katanukiya cake studio</button><button type="button" data-p="chocolate">GildArt chocolate studio</button></div><div id="s-form"><p class="adm-loading">Loading...</p></div></div>';
        $('#s-seg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { sp = b.dataset.p; drawStudio(); } });
        B.content().then(function (c) { SC = (c && c.studio) || {}; drawStudio(); });
    }
    function drawStudio() {
        $$('#s-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === sp); });
        var v = stVal(sp), cake = sp === 'cake', form = $('#s-form');
        function cp(a) { return JSON.parse(JSON.stringify(a || [])); }
        var ST = {
            tiers: cp(v.tiers), boxes: cp(v.boxes), bsets: cp(v.boxSets), thick: cp(v.thickness)
        };
        var OLDD = (v.discounts && v.discounts.length ? v.discounts : [{ min: 1, off: 0 }, { min: 10, off: 5 }, { min: 25, off: 10 }, { min: 50, off: 15 }, { min: 100, off: 20 }]);
        ST.bsets.forEach(function (b) {            // older settings: price per box + percent discounts -> quantity options
            if (!b.tiers || !b.tiers.length) b.tiers = OLDD.map(function (d) { var q = Math.max(1, n(d.min)); return { qty: q, price: Math.round(q * n(b.price) * (1 - n(d.off) / 100)) }; });
        });
        function n(x) { x = Number(x); return isFinite(x) ? x : 0; }
        function aed(x) { return 'AED ' + (Math.round(x * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 }); }
        function num(a, i, f, attrs) { return '<input type="number" inputmode="decimal" data-a="' + a + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(ST[a][i][f]) + '" ' + (attrs || '') + '>'; }
        function txt(a, i, f, label) { return '<input type="text" data-a="' + a + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(ST[a][i][f] || '') + '" aria-label="' + esc(label) + '">'; }
        function rm(a, i) { return '<button type="button" class="adm-btn ghost sm" data-rm="' + a + '" data-i="' + i + '" aria-label="Remove this row">Remove</button>'; }
        function sec(no, title, help, body) { return '<section class="st-sec"><h4><span>' + no + '</span>' + title + '</h4>' + (help ? '<p class="st-help">' + help + '</p>' : '') + body + '</section>'; }
        function field(label, hint, input) { return '<label class="st-fld"><span class="st-lb">' + label + '</span>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }

        function summary() {
            var s;
            if (cake) {
                var ts = ST.tiers.slice().sort(function (a, b) { return a.qty - b.qty; }), lo = ts[0];
                s = lo ? 'Customers must order <b>at least ' + lo.qty + ' pieces</b>, from <b>' + aed(lo.price) + '</b>. They can choose ' + ts.length + ' quantit' + (ts.length === 1 ? 'y' : 'ies') + ' (up to ' + ts[ts.length - 1].qty + ' pieces).' : 'Add at least one quantity.';
            } else {
                s = '';
            }
            return '<div class="st-live" id="s-live">' + s + '</div>';
        }
        function cardsHtml(kind, bi, arr, unit) {
            var P = kind === 'btiers' ? ' data-b="' + bi + '"' : '';
            return '<div class="st-cards">' + arr.map(function (t, i) {
                return '<div class="st-qc' + (t.popular ? ' pop' : '') + '"' + P + '>' +
                    '<div class="st-qc-top"><label class="check"><input type="radio" name="pop' + kind + bi + '" data-pop="' + i + '"' + P + ' data-k="' + kind + '"' + (t.popular ? ' checked' : '') + '> Popular tag</label>' +
                    (arr.length > 1 ? '<button type="button" class="st-x" data-rm="' + kind + '" data-i="' + i + '"' + P + ' aria-label="Remove this option">&times;</button>' : '') + '</div>' +
                    '<div class="st-qc-q"><input type="number" inputmode="numeric" min="1" step="1" data-a="' + kind + '"' + P + ' data-i="' + i + '" data-f="qty" value="' + esc(t.qty) + '" aria-label="Quantity"><small>' + unit + '</small></div>' +
                    '<div class="st-qc-p"><span>AED</span><input type="number" inputmode="decimal" min="0" step="1" data-a="' + kind + '"' + P + ' data-i="' + i + '" data-f="price" value="' + esc(t.price) + '" aria-label="Total price"></div>' +
                    '<div class="st-qc-e st-calc" data-ce="' + kind + '|' + bi + '|' + i + '">' + (n(t.qty) > 0 ? aed(n(t.price) / n(t.qty)) + ' each' : '-') + '</div></div>';
            }).join('') + '<button type="button" class="st-qc st-qadd" data-add="' + kind + '"' + P + '><b>+</b><span>Add a quantity option</span></button></div>';
        }
        function tiersHtml() { return cardsHtml('tiers', 0, ST.tiers, 'pcs'); }
        function boxesHtml() {
            return '<div class="st-tbl st-t-col"><div class="st-th">Colour</div><div class="st-th">Name shown to customer</div><div class="st-th">Extra price (AED per piece)</div><div class="st-th"></div>' +
                ST.boxes.map(function (b, i) {
                    return '<div class="st-row"><div class="st-td" data-l="Colour"><input type="color" data-a="boxes" data-i="' + i + '" data-f="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#cccccc') + '" aria-label="Colour"></div><div class="st-td" data-l="Name">' + txt('boxes', i, 'label', 'Colour name') + '</div>' +
                        '<div class="st-td" data-l="Extra (AED per piece)">' + num('boxes', i, 'extra', 'min="0" step="0.5"') + '</div><div class="st-td">' + (ST.boxes.length > 1 ? rm('boxes', i) : '') + '</div></div>';
                }).join('') + '</div><p><button type="button" class="adm-btn ghost" data-add="boxes">+ Add a colour</button></p>';
        }
        function bsetsHtml() {
            return ST.bsets.map(function (b, i) {
                var ts = b.tiers.slice().sort(function (x, y) { return n(x.qty) - n(y.qty); }), lo = ts[0] || { qty: 0, price: 0 };
                return '<div class="st-box-panel"><div class="st-bp-head">' +
                    '<label class="st-fld"><span class="st-lb">Box name</span>' + txt('bsets', i, 'label', 'Box name') + '</label>' +
                    '<label class="st-fld st-narrow"><span class="st-lb">Pieces in the box</span>' + num('bsets', i, 'pieces', 'min="1" max="12" step="1"') + '</label>' +
                    (ST.bsets.length > 1 ? '<button type="button" class="adm-btn ghost sm danger" data-rm="bsets" data-i="' + i + '">Remove this box</button>' : '') + '</div>' +
                    '<div class="st-live" data-bl="' + i + '"></div>' +
                    '<p class="st-help">Quantity options customers can choose for this box. Quantity = number of boxes. Price = total for that quantity. The smallest quantity is the minimum order.</p>' +
                    cardsHtml('btiers', i, b.tiers, n(b.pieces) === 1 ? 'pcs' : 'boxes') + '</div>';
            }).join('') + '<p><button type="button" class="adm-btn ghost" data-add="bsets">+ Add a box type</button></p>';
        }
        function blLive(i) {
            var b = ST.bsets[i]; if (!b) return '';
            var ts = b.tiers.slice().sort(function (x, y) { return n(x.qty) - n(y.qty); }), lo = ts[0];
            return lo ? 'Minimum order: <b>' + n(lo.qty) + ' ' + (n(b.pieces) === 1 ? 'pcs' : 'boxes') + '</b>' + (n(b.pieces) > 1 ? ' (' + n(lo.qty) * n(b.pieces) + ' pieces)' : '') + ' &middot; from <b>' + aed(n(lo.price)) + '</b> &middot; ' + ts.length + ' option' + (ts.length === 1 ? '' : 's') : 'Add at least one quantity option.';
        }
        function thickHtml() {
            return '<div class="st-tbl st-t-th"><div class="st-th">Name shown to customer</div><div class="st-th">Thickness (mm)</div><div class="st-th">Extra price (AED per piece)</div><div class="st-th"></div>' +
                ST.thick.map(function (t, i) {
                    return '<div class="st-row"><div class="st-td" data-l="Name">' + txt('thick', i, 'label', 'Thickness name') + '</div><div class="st-td" data-l="Thickness (mm)">' + num('thick', i, 'mm', 'min="1" max="40" step="1"') + '</div>' +
                        '<div class="st-td" data-l="Extra (AED per piece)">' + num('thick', i, 'extra', 'min="0" step="0.5"') + '</div><div class="st-td">' + (ST.thick.length > 1 ? rm('thick', i) : '') + '</div></div>';
                }).join('') + '</div><p><button type="button" class="adm-btn ghost" data-add="thick">+ Add a thickness</button></p>';
        }
        ST.thick.forEach(function (t) { if (t.mm == null) t.mm = parseInt(t.id, 10) || parseInt(t.label, 10) || 5; });

        var h = '<p class="st-help st-top">' + (cake ? 'This is the page customers use to design a <b>Katanukiya cut-out cake</b>.' : 'This is the page customers use to design <b>GildArt printed chocolates</b>.') + ' Everything below can be changed. Press <b>Save changes</b> at the bottom when you finish. It goes live straight away.</p>';
        if (cake) {
            h += sec(1, 'Minimum order and prices', 'Each card below is one choice the customer sees on the order page. The <b>smallest quantity is the minimum order</b>. The price is the <b>total</b> for that quantity (it includes the first die setup and delivery in the UAE).', summary() + '<div id="s-tiers">' + tiersHtml() + '</div>');
            h += sec(2, 'Box colours', 'The boxes the customer can pick. If a colour costs more, type the extra price for each piece (use 0 for no extra charge).', '<div id="s-boxes">' + boxesHtml() + '</div>');
        } else {
            h += sec(1, 'Box types, minimum order and quantity options', 'Customers pick a box, then one of the quantity options below it (like the cake page). <b>The smallest quantity is the minimum order</b> for that box. For example: single chocolate from 50 pieces, 3-piece set from 20 boxes. Prices include delivery in the UAE.', '<div id="s-bsets">' + bsetsHtml() + '</div>');
            h += sec(2, 'Thickness', 'The chocolate thickness options. The extra price is added for <b>each piece</b>. Use 0 for the standard thickness.', '<div id="s-thick">' + thickHtml() + '</div>');
            h += sec(3, 'Custom flavour and custom box', 'Small orders get the standard flavour and box. From the number of pieces below, the customer can ask for their own flavour and a custom box.',
                field('Unlocks from this many pieces in total', 'Example: 300.', '<input type="number" min="1" step="1" id="s-moq" value="' + esc(v.customMinQty || 300) + '">') +
                field('Flavours customers can choose (one per line)', 'The first line is the standard flavour. The others need the quantity above.', '<textarea id="s-flav" rows="5">' + esc((v.flavours || []).join('\n')) + '</textarea>'));
        }
        h += sec(cake ? 3 : 4, 'Words on the page', 'The headline, introduction and short highlights at the top of the design page.',
            field('Headline', 'Big title at the top.', '<input id="s-title" value="' + esc(v.title || '') + '">') +
            field('Introduction', 'Two or three sentences under the headline.', '<textarea id="s-lead" rows="3">' + esc(v.lead || '') + '</textarea>') +
            field('Short highlights (one per line, up to 4)', 'Small tags, for example the size or the minimum order.', '<textarea id="s-chips" rows="3">' + esc((v.chips || []).join('\n')) + '</textarea>'));
        h += sec(cake ? 4 : 5, 'Delivery time and designer help', '',
            '<div class="st-two">' + field('Delivery time (business days)', 'Shown to customers as the estimated shipping date.', '<input type="number" min="1" id="s-lead-d" value="' + esc(v.leadBusinessDays || 14) + '">') +
            field('Designer fee (AED)', 'Extra charge when the customer asks our designer to create the artwork. 0 = free.', '<input type="number" min="0" id="s-fee" value="' + esc(v.designerFee || 0) + '">') + '</div>');
        var sf = v.surface || (cake ? { w: 63, h: 48 } : { w: 50, h: 50 });
        h += '<details class="st-sec st-adv"><summary>Technical settings (only change if the size of your product changes)</summary>' +
            '<div class="st-two">' + field(cake ? 'Cake surface width (mm)' : 'Chocolate surface width (mm)', 'Size of the printed area.', '<input type="number" min="10" step="0.5" id="s-sw" value="' + esc(sf.w) + '">') +
            field(cake ? 'Cake surface height (mm)' : 'Chocolate surface height (mm)', 'Size of the printed area.', '<input type="number" min="10" step="0.5" id="s-sh" value="' + esc(sf.h) + '">') +
            field('Print and cut tolerance (mm)', 'Shown to customers as the allowed difference.', '<input type="number" min="0" step="0.1" id="s-tol" value="' + esc(v.tolerance || 1.5) + '">') +
            (cake ? field('Clear zone around the edge (mm)', 'Nothing may go past this edge.', '<input type="number" min="0" step="0.5" id="s-mar" value="' + esc(v.margin != null ? v.margin : 5) + '">') : '') + '</div></details>';
        h += '<p class="adm-err" id="s-err" hidden></p><div class="st-savebar"><button type="button" class="adm-btn" id="s-save">Save changes</button> <button type="button" class="adm-btn ghost" id="s-reset">Back to website defaults</button></div>';
        form.innerHTML = h;

        function arrOf(kind, bi) { return kind === 'btiers' ? (ST.bsets[bi] ? ST.bsets[bi].tiers : []) : ST.tiers; }
        function refresh() {   // update the calculated numbers without redrawing the cards
            $$('[data-ce]', form).forEach(function (el) { var p = el.dataset.ce.split('|'), t = arrOf(p[0], +p[1])[+p[2]]; el.textContent = t && n(t.qty) > 0 ? aed(n(t.price) / n(t.qty)) + ' each' : '-'; });
            $$('[data-bl]', form).forEach(function (el) { el.innerHTML = blLive(+el.dataset.bl); });
            var lv = $('#s-live'); if (lv) lv.outerHTML = summary();
        }
        function redraw(id, fn) { var el = $(id); if (el) el.innerHTML = fn(); refresh(); }
        var REDRAW = { tiers: ['#s-tiers', tiersHtml], boxes: ['#s-boxes', boxesHtml], bsets: ['#s-bsets', bsetsHtml], btiers: ['#s-bsets', bsetsHtml], thick: ['#s-thick', thickHtml] };
        refresh();
        form.oninput = function (e) {
            var d = e.target.dataset;
            if (d.a) { var arr = d.b != null ? arrOf(d.a, +d.b) : ST[d.a], r = arr[+d.i], val = e.target.value; r[d.f] = (e.target.type === 'number') ? (val === '' ? '' : Number(val)) : val; if (d.a === 'bsets' && d.f === 'pieces') redraw('#s-bsets', bsetsHtml); else refresh(); }
        };
        form.onchange = function (e) {
            var d = e.target.dataset;
            if (d.pop != null) { var arr = d.b != null ? arrOf(d.k, +d.b) : ST.tiers; arr.forEach(function (t, i) { t.popular = i === +d.pop; }); }
        };
        form.onclick = function (e) {
            var a = e.target.closest('[data-add]'), r = e.target.closest('[data-rm]');
            if (a) {
                var k = a.dataset.add, arr = k === 'btiers' ? arrOf(k, +a.dataset.b) : ST[k], L = arr[arr.length - 1] || {};
                if (k === 'tiers' || k === 'btiers') arr.push({ qty: Math.round(n(L.qty || 50) * 2), price: Math.round(n(L.price || 1000) * 1.9) });
                if (k === 'boxes') ST.boxes.push({ id: 'colour-' + (ST.boxes.length + 1), label: 'New colour', extra: 3, color: '#cccccc' });
                if (k === 'bsets') ST.bsets.push({ id: 'b' + (ST.bsets.length + 1) + '-' + Date.now().toString(36).slice(-3), pieces: 6, label: '6-piece gift box', price: 180, tiers: [{ qty: 20, price: 3200 }, { qty: 50, price: 7500, popular: true }, { qty: 100, price: 14000 }] });
                if (k === 'thick') ST.thick.push({ id: '8', mm: 8, label: '8 mm', extra: 0.5 });
                redraw(REDRAW[k][0], REDRAW[k][1]);
            } else if (r) { var kk = r.dataset.rm, ar = kk === 'btiers' ? arrOf(kk, +r.dataset.b) : ST[kk]; ar.splice(+r.dataset.i, 1); redraw(REDRAW[kk][0], REDRAW[kk][1]); }
        };
        $('#s-save').onclick = function () {
            var err = $('#s-err'); err.hidden = true;
            function bad(m) { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); }
            var out = { title: $('#s-title').value.trim(), lead: $('#s-lead').value.trim(), chips: $('#s-chips').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4) };
            if (cake) {
                var ts = ST.tiers.slice().sort(function (a, b) { return n(a.qty) - n(b.qty); });
                for (var i = 0; i < ts.length; i++) { if (!(n(ts[i].qty) >= 1) || !(n(ts[i].price) >= 0) || ts[i].price === '') return bad('Please check the quantities and prices in "Minimum order and prices".'); if (i && n(ts[i].qty) === n(ts[i - 1].qty)) return bad('Two rows have the same quantity.'); }
                out.tiers = ts.map(function (t) { var o = { qty: Math.round(n(t.qty)), price: n(t.price) }; if (t.popular) o.popular = true; return o; });
                var used = {};
                out.boxes = ST.boxes.map(function (b, i) { var o = {}; for (var k in b) o[k] = b[k]; o.label = String(b.label || '').trim() || 'Colour ' + (i + 1); o.extra = Math.max(0, n(b.extra)); o.color = b.color || '#cccccc'; var id = String(b.id || '').trim() || slug(o.label); while (used[id]) id += '-x'; used[id] = 1; o.id = id; return o; });
                if (!out.boxes.length) return bad('Please keep at least one box colour.');
                if (!out.boxes.some(function (b) { return b.standard; })) out.boxes[0].standard = true;
                out.margin = Math.max(0, n($('#s-mar').value));
            } else {
                var ids = {};
                out.boxSets = ST.bsets.map(function (b, i) {
                    var o = {}; for (var k in b) o[k] = b[k];
                    o.label = String(b.label || '').trim() || 'Box ' + (i + 1); o.pieces = Math.min(12, Math.max(1, Math.round(n(b.pieces))));
                    var id = String(b.id || '') || String(o.pieces); while (ids[id]) id += 'x'; ids[id] = 1; o.id = id;
                    var ts = (b.tiers || []).slice().sort(function (x, y) { return n(x.qty) - n(y.qty); });
                    o.tiers = ts.map(function (t) { var q = { qty: Math.round(n(t.qty)), price: Math.max(0, n(t.price)) }; if (t.popular) q.popular = true; return q; });
                    o.price = o.tiers.length ? Math.round(o.tiers[0].price / Math.max(1, o.tiers[0].qty) * 100) / 100 : 0;   // price per box at the minimum order
                    return o;
                });
                if (!out.boxSets.length) return bad('Please keep at least one box type.');
                for (var bi = 0; bi < out.boxSets.length; bi++) {
                    var tl = out.boxSets[bi].tiers, nm = out.boxSets[bi].label;
                    if (!tl.length) return bad('"' + nm + '" needs at least one quantity option.');
                    for (var ti = 0; ti < tl.length; ti++) { if (!(tl[ti].qty >= 1)) return bad('Please check the quantities for "' + nm + '".'); if (ti && tl[ti].qty === tl[ti - 1].qty) return bad('"' + nm + '" has two options with the same quantity.'); }
                }
                var tids = {};
                out.thickness = ST.thick.map(function (t, i) { var mm = Math.max(1, Math.round(n(t.mm) || 5)); var id = String(mm); while (tids[id]) id += '0'; tids[id] = 1; return { id: id, label: String(t.label || '').trim() || mm + ' mm', extra: Math.max(0, n(t.extra)) }; });
                if (!out.thickness.length) return bad('Please keep at least one thickness.');
                out.customMinQty = Math.max(1, parseInt($('#s-moq').value, 10) || 300);
                out.flavours = $('#s-flav').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
                if (!out.flavours.length) return bad('Please add at least one flavour.');
            }
            out.surface = { w: Math.max(10, n($('#s-sw').value) || sf.w), h: Math.max(10, n($('#s-sh').value) || sf.h) };
            out.tolerance = Math.max(0, n($('#s-tol').value)) || 1.5;
            out.leadBusinessDays = Math.max(1, parseInt($('#s-lead-d').value, 10) || 14);
            out.designerFee = Math.max(0, n($('#s-fee').value));
            SC[sp] = out;
            B.saveContent('studio', SC).then(function () { toast('Saved. The ' + (cake ? 'cake' : 'chocolate') + ' design page is updated.'); }).catch(fail);
        };
        $('#s-reset').onclick = function () {
            confirmBox('Go back to the prices and texts that are in the website files? Your changes on this page will be replaced.', 'Go back').then(function (yes) {
                if (!yes) return; delete SC[sp]; B.saveContent('studio', SC).then(function () { toast('Back to defaults'); drawStudio(); }).catch(fail);
            });
        };
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
        root.innerHTML = '<div class="adm-bar"><h2>Edit website</h2></div>' +
            '<div class="adm-card"><h3>Edit the website</h3><p class="adm-lead">Open the website in edit mode. Then tap or click any text to change the words, the font and the size, or to delete it. The bar at the bottom has <b>Fonts</b> (font of the whole website), <b>Pages</b> (go to another page) and <b>Finish</b>. It works on phone, iPad and computer, and everything is saved for every visitor.</p>' +
            '<div class="adm-row"><a class="adm-btn" target="_blank" rel="noopener" href="index.html?edit=1">Go to edit mode</a></div></div>' +
            '<div class="adm-card" id="w-texts"><h3>Your text changes</h3><p class="adm-loading">Loading...</p></div>' +
            '<div class="adm-card"><h3>Big pictures on the home page</h3><p class="adm-lead">Upload a new photo and it goes live straight away. "Use original" puts the first photo back.</p><div id="w-grid"><p class="adm-loading">Loading...</p></div></div>';
        B.content().then(function (c) { CONTENT = c || {}; drawWebsite(); drawTexts(); });
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
        root.innerHTML = '<div class="adm-bar"><h2>Top bar and bank details</h2></div><div id="s-box"><p class="adm-loading">Loading...</p></div>';
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
        ['Tax and delivery (printed on every invoice, receipt and order email)', [
            ['trn', 'Tax Registration Number (TRN)', '15 digits, e.g. 100123456700003', 'Printed on invoices and receipts. Leave empty until you have it.'],
            ['vat_percent', 'VAT rate (%)', '5', 'UAE standard rate is 5.'],
            ['prices_include_vat', 'Are your shop prices VAT-inclusive?', '', 'Choose "No" if VAT is added on top at checkout (shown as a separate line).', [['no', 'No: add VAT on top of the prices'], ['yes', 'Yes: prices already include VAT']]],
            ['delivery_fee', 'Standard delivery charge (AED)', '25', 'Used for any emirate that has no price of its own below.'],
            ['free_over', 'Free delivery when the order is over (AED)', '200', 'Orders above this amount get FREE delivery. Enter 0 to switch this off.'],
            ['fee_abu_dhabi', 'Delivery to Abu Dhabi (AED)', 'empty = standard charge', 'Farther places can cost more. Leave empty to use the standard charge.'],
            ['fee_ajman', 'Delivery to Ajman (AED)', 'empty = standard charge', ''],
            ['fee_dubai', 'Delivery to Dubai (AED)', 'empty = standard charge', ''],
            ['fee_fujairah', 'Delivery to Fujairah (AED)', 'empty = standard charge', ''],
            ['fee_ras_al_khaimah', 'Delivery to Ras Al Khaimah (AED)', 'empty = standard charge', ''],
            ['fee_sharjah', 'Delivery to Sharjah (AED)', 'empty = standard charge', ''],
            ['fee_umm_al_quwain', 'Delivery to Umm Al Quwain (AED)', 'empty = standard charge', ''],
            ['free_delivery', 'Free delivery offer for everyone right now?', '', 'Switch to "Yes" during a promotion. Customers then see FREE delivery. Switch back when it ends.', [['no', 'No: charge delivery as normal'], ['yes', 'Yes: FREE delivery offer is on']]]]],
        ['Order emails', [
            ['notify_emails', 'Email addresses that receive every new order (separate with commas)', 'you@gmail.com, partner@gmail.com', 'The order email with design files is sent here. If empty, the ADMIN_EMAILS secret in Supabase is used.'],
            ['reply_to', 'Reply-to email for customers', 'support@grapetree.ae', 'When a customer replies to the confirmation email, it goes here.']]]
    ];
    function viewBusiness() {
        root.innerHTML = '<div class="adm-bar"><h2>Business info</h2></div><p class="adm-lead">Change your contact details here and the whole website updates: footer, WhatsApp buttons, order messages and order emails. No code needed.</p><div id="b-box"><p class="adm-loading">Loading...</p></div>';
        B.content().then(function (c) {
            CONTENT = c || {};
            var cur = CONTENT.business || {}, co = CFG.company || {}, so = CFG.social || {};
            var def = { vat_percent: '5', delivery_fee: '25', free_over: '200', prices_include_vat: 'no', free_delivery: 'no', whatsapp: CFG.whatsapp, phone: co.phone, email: co.email, address: co.address, mapQuery: co.mapQuery, hours: co.hours, instagramKatanukiya: so.instagramKatanukiya, instagramGildart: so.instagramGildart, tiktok: so.tiktok, facebook: so.facebook };
            var html = '<form class="adm-card" id="b-form">';
            BIZ_FIELDS.forEach(function (g) {
                html += '<h3>' + esc(g[0]) + '</h3><div class="adm-form">';
                g[1].forEach(function (f) {
                    var v = cur[f[0]] != null ? cur[f[0]] : (def[f[0]] || '');
                    html += '<label class="full">' + esc(f[1]) + (f[4] ? '<select name="' + f[0] + '">' + f[4].map(function (op) { return '<option value="' + op[0] + '"' + (String(v || f[4][0][0]) === op[0] ? ' selected' : '') + '>' + esc(op[1]) + '</option>'; }).join('') + '</select>' : '<input name="' + f[0] + '" value="' + esc(v) + '" placeholder="' + esc(f[2]) + '" autocomplete="off">') + (f[3] ? '<small>' + esc(f[3]) + '</small>' : '') + '</label>';
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
                if (!err && v.trn && !/^\d{15}$/.test(v.trn.replace(/\s/g, ''))) err = 'The TRN should be exactly 15 digits.';
                if (v.trn) v.trn = v.trn.replace(/\s/g, '');
                if (!err && !/^\d+(\.\d+)?$/.test(v.vat_percent || '')) err = 'The VAT rate must be a number, for example 5.';
                if (!err && !/^\d+(\.\d+)?$/.test(v.delivery_fee || '')) err = 'The delivery charge must be a number, for example 25 (use 0 for free).';
                if (!err && v.free_over && !/^\d+(\.\d+)?$/.test(v.free_over)) err = 'The free-delivery amount must be a number, for example 200 (0 switches it off).';
                if (!err) Object.keys(v).forEach(function (k) { if (!err && /^fee_/.test(k) && v[k] && !/^\d+(\.\d+)?$/.test(v[k])) err = 'Each delivery price must be a number, for example 30 (or leave it empty).'; });
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

    /* ============================ CUSTOMERS (admin only) ============================ */
    function askTyped(title, text, word, yes) {
        return new Promise(function (resolve) {
            var d = doc.createElement('div'); d.className = 'adm-modal open';
            d.innerHTML = '<div class="adm-dialog small"><h3 style="margin:0 0 6px">' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
                '<label>Type <strong>' + esc(word) + '</strong> to confirm<input type="text" id="ty-in" autocomplete="off" spellcheck="false"></label>' +
                '<div class="adm-row end"><button class="adm-btn ghost" data-no>Cancel</button><button class="adm-btn danger" data-yes disabled>' + esc(yes) + '</button></div></div>';
            doc.body.appendChild(d); var inp = $('#ty-in', d), go = $('[data-yes]', d);
            inp.addEventListener('input', function () { go.disabled = inp.value.trim().toLowerCase() !== String(word).toLowerCase(); });
            d.addEventListener('click', function (e) {
                if (e.target.closest('[data-yes]') && !go.disabled) { d.remove(); resolve(true); }
                else if (e.target.closest('[data-no]') || e.target === d) { d.remove(); resolve(false); }
            });
        });
    }
    function viewCustomers() {
        root.innerHTML = '<div class="adm-bar"><h2>Customers</h2></div>' +
            '<p class="adm-lead">Everyone who created an account. Open a customer to see their details and orders, send a password reset link, set a temporary password, stop their sign-in, or delete the account.</p>' +
            '<div class="adm-row"><input type="search" id="cu-q" placeholder="Search name, email or phone" aria-label="Search customers" class="grow"></div><div id="cu-list"><p class="adm-loading">Loading...</p></div>';
        var CU = [], OR = {}, ST = {}, q = '';
        function load() {
            return Promise.all([
                B.client.from('profiles').select('id,email,full_name,phone,role,created_at').eq('role', 'customer').order('created_at', { ascending: false }).limit(1000).then(function (r) { if (r.error) throw r.error; return r.data || []; }),
                B.client.from('orders').select('id,order_no,user_id,status,total,subtotal,created_at,cancel_reason,cancelled_at').not('user_id', 'is', null).order('created_at', { ascending: false }).limit(5000).then(function (r) { if (r.error) throw r.error; return r.data || []; }),
                team({ action: 'c_status' }).then(function (d) { return d.users || {}; }, function () { return null; })
            ]).then(function (a) {
                CU = a[0]; OR = {}; a[1].forEach(function (o) { (OR[o.user_id] = OR[o.user_id] || []).push(o); }); ST = a[2] || {};
                draw();
            }).catch(function (e) { $('#cu-list').innerHTML = '<p class="adm-err">Could not load customers: ' + esc(e.message || e) + '</p>'; });
        }
        function money(n) { return 'AED ' + (Math.round(n * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
        function draw() {
            var t = q.toLowerCase(), rows = CU.filter(function (c) { return !t || [c.full_name, c.email, c.phone].join(' ').toLowerCase().indexOf(t) > -1; });
            var box = $('#cu-list');
            if (!rows.length) { box.innerHTML = '<p class="adm-empty">' + (CU.length ? 'No customer matches your search.' : 'No customers yet.') + '</p>'; return; }
            box.innerHTML = '<p class="adm-fine">' + rows.length + ' customer' + (rows.length === 1 ? '' : 's') + (ST && Object.keys(ST).length ? '' : ' (sign-in information needs the updated team-admin function)') + '</p>' + rows.map(function (c) {
                var os = (OR[c.id] || []).filter(function (o) { return o.status !== 'cancelled'; }), sp = ST[c.id] || {}, spent = os.reduce(function (s, o) { return s + otot(o); }, 0);
                return '<article class="adm-order cu-item" data-cid="' + esc(c.id) + '"><button type="button" class="cu-head" aria-expanded="false"><span class="cu-no">' + esc(c.full_name || c.email || 'No name') + '</span>' +
                    '<span class="cu-chips">' + (sp.suspended ? '<span class="chip st-cancelled">Sign-in stopped</span>' : '') + '<span class="chip">' + (OR[c.id] || []).length + ' order' + ((OR[c.id] || []).length === 1 ? '' : 's') + '</span>' + (spent ? '<span class="chip st-confirmed">' + esc(money(spent)) + '</span>' : '') + '</span>' +
                    '<span class="cu-sub">' + esc(c.email || '') + (c.phone ? ' &middot; ' + esc(c.phone) : '') + '</span></button><div class="cu-body" hidden></div></article>';
            }).join('');
        }
        function detail(c) {
            var os = OR[c.id] || [], sp = ST[c.id] || {};
            return '<div class="cu-grid"><form class="cu-form"><h4>Details</h4>' +
                '<label>Name<input name="name" value="' + esc(c.full_name || '') + '" maxlength="120"></label>' +
                '<label>Phone<input name="phone" value="' + esc(c.phone || '') + '" maxlength="40"></label>' +
                '<label>Email (their sign-in)<input name="email" type="email" value="' + esc(c.email || '') + '"></label>' +
                '<p class="adm-fine">Joined ' + esc(dt(c.created_at)) + (sp.last ? ' &middot; Last signed in ' + esc(dt(sp.last)) : '') + '</p>' +
                '<p class="adm-err" data-err role="alert"></p><div class="adm-row"><button class="adm-btn" type="submit">Save details</button>' +
                (digits(c.phone) ? '<a class="adm-btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + digits(c.phone) + '">WhatsApp</a>' : '') + '</div></form>' +
                '<div class="cu-acts"><h4>Help this customer</h4>' +
                '<button type="button" class="adm-btn ghost" data-cu="reset">Send password reset link</button><small>Emails them a link to choose a new password.</small>' +
                '<button type="button" class="adm-btn ghost" data-cu="pw">Set a temporary password</button><small>You choose it and tell the customer. They can change it after signing in.</small>' +
                '<button type="button" class="adm-btn ghost" data-cu="suspend">' + (sp.suspended ? 'Allow sign-in again' : 'Stop sign-in') + '</button><small>' + (sp.suspended ? 'This customer cannot sign in now.' : 'Blocks sign-in. Their orders and data are kept. You can allow it again any time.') + '</small>' +
                '<button type="button" class="adm-btn danger" data-cu="delete">Delete account</button><small>Removes the account and saved addresses. Past orders stay in Orders for your records.</small></div></div>' +
                '<h4>Orders (' + os.length + ')</h4>' + (os.length ? '<ul class="cu-orders">' + os.map(function (o) {
                    return '<li><strong>#' + esc(o.order_no) + '</strong> <span class="chip st-' + esc(o.status) + '">' + esc(STATUS_NAME[o.status] || o.status) + '</span> ' + esc(money(otot(o))) + ' <small>' + esc(dt(o.created_at)) + '</small>' +
                        (o.status === 'cancelled' ? '<br><small>Cancelled' + (o.cancelled_at ? ' ' + esc(dt(o.cancelled_at)) : '') + ' &mdash; reason: ' + esc(o.cancel_reason || 'not recorded') + '</small>' : '') + '</li>';
                }).join('') + '</ul>' : '<p class="adm-empty">No orders yet.</p>');
        }
        function byId(id) { return CU.filter(function (c) { return c.id === id; })[0]; }
        var list = $('#cu-list');
        $('#cu-q').addEventListener('input', function (e) { q = e.target.value.trim(); draw(); });
        list.addEventListener('click', function (e) {
            var art = e.target.closest('.cu-item'); if (!art) return;
            var c = byId(art.getAttribute('data-cid')), body = $('.cu-body', art);
            var head = e.target.closest('.cu-head');
            if (head) { var open = head.getAttribute('aria-expanded') === 'true'; head.setAttribute('aria-expanded', open ? 'false' : 'true'); body.hidden = open; if (!open) body.innerHTML = detail(c); return; }
            var b = e.target.closest('[data-cu]'); if (!b || !c) return;
            var act = b.getAttribute('data-cu'), who = c.email;
            function done(msgText) { toast(msgText); return load().then(function () { var a = $('[data-cid="' + c.id + '"]'); if (a) { $('.cu-head', a).setAttribute('aria-expanded', 'true'); var bd = $('.cu-body', a); bd.hidden = false; bd.innerHTML = detail(byId(c.id) || c); } }); }
            if (act === 'reset') {
                confirmBox('Send a password reset email to ' + who + '?', 'Send link').then(function (yes) { if (yes) B.resetPassword(who).then(function () { toast('Reset link sent to ' + who); }).catch(fail); });
            } else if (act === 'pw') {
                askPassword('Set a temporary password', who).then(function (pw) { if (pw) team({ action: 'c_password', id: c.id, password: pw }).then(function () { toast('Password changed. Please tell the customer.'); }).catch(fail); });
            } else if (act === 'suspend') {
                var sus = !(ST[c.id] || {}).suspended;
                confirmBox(sus ? 'Stop ' + who + ' from signing in? Their orders are kept.' : 'Allow ' + who + ' to sign in again?', sus ? 'Stop sign-in' : 'Allow sign-in').then(function (yes) { if (yes) team({ action: 'c_suspend', id: c.id, suspend: sus }).then(function () { return done(sus ? 'Sign-in stopped' : 'Sign-in allowed again'); }).catch(fail); });
            } else if (act === 'delete') {
                askTyped('Delete this account?', 'This permanently deletes the account of ' + who + ' and their saved addresses. This cannot be undone. Their ' + (OR[c.id] || []).length + ' past order(s) stay in Orders.', 'DELETE', 'Delete account').then(function (yes) {
                    if (yes) team({ action: 'c_delete', id: c.id }).then(function () { toast('Account deleted'); return load(); }).catch(fail);
                });
            }
        });
        list.addEventListener('submit', function (e) {
            e.preventDefault();
            var art = e.target.closest('.cu-item'), c = byId(art.getAttribute('data-cid')), f = e.target, err = $('[data-err]', f), btn = $('button[type=submit]', f); err.textContent = '';
            btn.disabled = true;
            team({ action: 'c_update', id: c.id, name: f.name.value, phone: f.phone.value, email: f.email.value }).then(function () {
                toast('Customer details saved'); return load().then(function () { var a = $('[data-cid="' + c.id + '"]'); if (a) { $('.cu-head', a).setAttribute('aria-expanded', 'true'); var bd = $('.cu-body', a); bd.hidden = false; bd.innerHTML = detail(byId(c.id) || c); } });
            }).catch(function (x) { err.textContent = x.message || String(x); btn.disabled = false; });
        });
        load();
    }

    /* ============================ LEGAL TEXTS ============================ */
    function viewLegal() {
        root.innerHTML = '<div class="adm-bar"><h2>Legal pages</h2></div>' +
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
