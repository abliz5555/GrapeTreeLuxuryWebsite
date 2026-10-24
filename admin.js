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

    var STATUSES = [['new', 'New'], ['confirmed', 'Confirmed'], ['preparing', 'Preparing'], ['delivering', 'Out for delivery'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
    var STATUS_NAME = {}; STATUSES.forEach(function (s) { STATUS_NAME[s[0]] = s[1]; });
    var PAY_NAME = { whatsapp: 'WhatsApp', bank: 'Bank transfer', card: 'Card' };
    var tab = 'orders', ORDERS = [], PRODUCTS = [], CONTENT = {};

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
        if (!B.isAdmin()) {
            root.innerHTML = card('<h2>This account is not an admin</h2><p>You are signed in as <strong>' + esc(B.user().email) + '</strong>, which does not have admin access. Sign out and use the admin email.</p>');
            return;
        }
        tabsEl.hidden = false; show(tab);
    }
    function card(html) { return '<div class="adm-card narrow">' + html + '</div>'; }

    outBtn.addEventListener('click', function () { B.signOut(); });
    tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) show(b.getAttribute('data-tab')); });
    function show(t) {
        tab = t;
        $$('[data-tab]', tabsEl).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
        ({ orders: viewOrders, products: viewProducts, website: viewWebsite, studio: viewStudio, test: viewTest, settings: viewSettings })[t]();
    }

    /* ============================ ORDERS ============================ */
    var fStatus = 'all', fText = '';
    function viewOrders() {
        root.innerHTML = '<div class="adm-stats" id="o-stats"></div>' +
            '<div class="adm-bar"><select id="o-status" aria-label="Filter by status"><option value="all">All orders</option>' + STATUSES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
            '<input type="search" id="o-q" placeholder="Search name, phone or order number" aria-label="Search orders"><button class="adm-btn ghost" id="o-refresh">Refresh</button></div>' +
            '<div id="o-list"><p class="adm-loading">Loading orders...</p></div>';
        $('#o-status').value = fStatus; $('#o-q').value = fText;
        $('#o-status').addEventListener('change', function () { fStatus = this.value; drawOrders(); });
        $('#o-q').addEventListener('input', function () { fText = this.value; drawOrders(); });
        $('#o-refresh').addEventListener('click', loadOrders);
        loadOrders();
    }
    function loadOrders() {
        B.client.from('orders').select('*').order('created_at', { ascending: false }).limit(500).then(function (r) {
            if (r.error) throw r.error;
            ORDERS = r.data || [];
            var n = ORDERS.filter(function (o) { return o.status === 'new'; }).length, b = $('#adm-new');
            b.hidden = !n; b.textContent = n;
            if (tab === 'orders') { drawStats(); drawOrders(); }
        }).catch(function (e) { var l = $('#o-list'); if (l) l.innerHTML = '<p class="adm-err">Could not load orders: ' + esc(e.message || e) + '</p>'; });
    }
    function drawStats() {
        var now = new Date(), ms = new Date(now.getFullYear(), now.getMonth(), 1), ds = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var live = ORDERS.filter(function (o) { return o.status !== 'cancelled'; });
        var sum = function (a) { return a.reduce(function (t, o) { return t + Number(o.subtotal || 0); }, 0); };
        var month = live.filter(function (o) { return new Date(o.created_at) >= ms; }), today = live.filter(function (o) { return new Date(o.created_at) >= ds; });
        var src = {}; live.forEach(function (o) { var k = (o.source || 'direct').split(' / ')[0] || 'direct'; src[k] = (src[k] || 0) + 1; });
        var top = Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).slice(0, 4).map(function (k) { return esc(k) + ' <b>' + src[k] + '</b>'; }).join(' &nbsp;·&nbsp; ');
        $('#o-stats').innerHTML =
            stat('New orders', ORDERS.filter(function (o) { return o.status === 'new'; }).length, 'waiting for you') +
            stat('Today', today.length, money(sum(today))) +
            stat('This month', month.length, money(sum(month))) +
            stat('Where orders come from', '', top || 'No orders yet', true);
    }
    function stat(l, v, s, wide) { return '<div class="adm-stat' + (wide ? ' wide' : '') + '"><span>' + esc(l) + '</span>' + (v !== '' ? '<strong>' + esc(v) + '</strong>' : '') + '<small>' + (wide ? s : esc(s)) + '</small></div>'; }

    function drawOrders() {
        var q = fText.trim().toLowerCase().replace(/^#/, '');
        var list = ORDERS.filter(function (o) {
            if (fStatus !== 'all' && o.status !== fStatus) return false;
            if (!q) return true;
            return String(o.order_no).indexOf(q) > -1 || (o.name || '').toLowerCase().indexOf(q) > -1 || (o.phone || '').toLowerCase().indexOf(q) > -1 || (o.email || '').toLowerCase().indexOf(q) > -1;
        });
        var box = $('#o-list'); if (!box) return;
        if (!list.length) { box.innerHTML = '<div class="adm-empty">No orders here yet.</div>'; return; }
        box.innerHTML = list.map(function (o) {
            return '<article class="adm-order" data-id="' + esc(o.id) + '">' +
                '<button type="button" class="o-head" aria-expanded="false"><span class="o-no">#' + esc(o.order_no) + (o.source === 'admin-test' ? ' <em style="background:#fde8a8;color:#6b4b00;font-style:normal;font-size:11px;padding:1px 6px;border-radius:6px">TEST</em>' : '') + '</span>' +
                '<span class="o-who"><strong>' + esc(o.name) + '</strong><small>' + esc(dt(o.created_at)) + ' · ' + esc(o.emirate) + '</small></span>' +
                '<span class="o-total">' + esc(money(o.subtotal)) + (o.has_quote ? ' +' : '') + '</span>' +
                '<span class="chip st-' + esc(o.status) + '">' + esc(STATUS_NAME[o.status] || o.status) + '</span></button>' +
                '<div class="o-body" hidden></div></article>';
        }).join('');
    }

    /* design files from the cake studio (private storage: opened with a short-lived link) */
    var ART_LABELS = { print: 'Print file (PNG)', preview: 'Preview', cutline: 'Cut line (SVG)', orig: 'Customer original', spec: 'Spec (JSON)' };
    function artBlock(l) {
        var a = l.art; if (!a) return '';
        var out = '<div class="o-art">';
        if (a.designer) out += '<span class="chip">designer: create cartoon + send proof</span> ';
        if (a.failed || !a.folder) return out + '<span class="chip">files were not uploaded: ask the customer on WhatsApp</span></div>';
        ['print', 'preview', 'cutline', 'orig', 'spec'].forEach(function (k) {
            if (a.files && a.files[k]) out += '<button type="button" class="o-artbtn" data-art="' + esc(a.folder + '/' + a.files[k]) + '">' + esc(ART_LABELS[k]) + '</button> ';
        });
        return out + '</div>';
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-art]') : null;
        if (!b) return;
        e.preventDefault();
        var w = window.open('', '_blank');
        B.client.storage.from('order-art').createSignedUrl(b.getAttribute('data-art'), 300).then(function (r) {
            if (r.error || !r.data) { if (w) w.close(); alert('Could not open the file: ' + ((r.error && r.error.message) || 'not found')); return; }
            if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl;
        });
    });

    function orderBody(o) {
        var items = (o.items || []).map(function (l) {
            var meta = (l.meta || []).map(function (m) { return '<li>' + esc(m[0]) + ': ' + esc(m[1]) + '</li>'; }).join('');
            return '<li><div><strong>' + esc(l.name) + '</strong> <em>x ' + esc(l.qty) + '</em>' + (l.quote ? ' <span class="chip">quote needed</span>' : '') + (meta ? '<ul class="o-meta">' + meta + '</ul>' : '') + (l.note ? '<p class="o-note">' + esc(l.note) + '</p>' : '') + artBlock(l) + '</div><span>' + esc(money(l.total)) + '</span></li>';
        }).join('');
        var wa = 'https://wa.me/' + digits(o.phone) + '?text=' + encodeURIComponent('Hello ' + o.name + ', this is Grape Tree about your order #' + o.order_no + '.');
        return '<div class="o-grid"><div><h4>Items</h4><ul class="o-items">' + items + '</ul>' +
            '<p class="o-sum"><span>Estimated total</span><strong>' + esc(money(o.subtotal)) + (o.has_quote ? ' + quoted items' : '') + '</strong></p></div>' +
            '<div><h4>Customer</h4><p><strong>' + esc(o.name) + '</strong><br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a>' + (o.email ? '<br><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a>' : '') + '</p>' +
            '<h4>Delivery</h4><p>' + esc(o.emirate) + '<br>' + esc(o.address).replace(/\n/g, '<br>') + '<br><strong>' + (o.delivery_date ? esc(o.delivery_date) : 'No date') + '</strong></p>' +
            (o.notes ? '<h4>Customer notes</h4><p>' + esc(o.notes) + '</p>' : '') +
            '<h4>Payment</h4><p>' + esc(PAY_NAME[o.payment_method] || o.payment_method) + (o.source ? '<br><small>Came from: ' + esc(o.source) + '</small>' : '') + '</p></div></div>' +
            '<div class="o-actions"><label>Order status<select data-f="status">' + STATUSES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === o.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label>' +
            '<label>Payment<select data-f="payment_status"><option value="unpaid"' + (o.payment_status === 'unpaid' ? ' selected' : '') + '>Not paid</option><option value="paid"' + (o.payment_status === 'paid' ? ' selected' : '') + '>Paid</option><option value="refunded"' + (o.payment_status === 'refunded' ? ' selected' : '') + '>Refunded</option></select></label>' +
            '<label class="grow">Private note (only you see this)<input type="text" data-f="admin_note" value="' + esc(o.admin_note || '') + '"></label>' +
            '<div class="o-btns"><a class="adm-btn ghost" href="' + wa + '" target="_blank" rel="noopener">WhatsApp customer</a><button class="adm-btn ghost" data-print>Print</button></div></div>';
    }
    doc.addEventListener('click', function (e) {
        var head = e.target.closest('.o-head');
        if (head) {
            var art = head.parentNode, body = $('.o-body', art), open = head.getAttribute('aria-expanded') === 'true';
            head.setAttribute('aria-expanded', open ? 'false' : 'true'); body.hidden = open;
            if (!open && !body.innerHTML) body.innerHTML = orderBody(ORDERS.filter(function (o) { return o.id === art.getAttribute('data-id'); })[0]);
            return;
        }
        var pr = e.target.closest('[data-print]');
        if (pr) printOrder(ORDERS.filter(function (o) { return o.id === pr.closest('.adm-order').getAttribute('data-id'); })[0]);
    });
    doc.addEventListener('change', function (e) {
        var f = e.target.closest('[data-f]'); if (!f) return;
        var art = f.closest('.adm-order'); if (!art) return;
        var o = ORDERS.filter(function (x) { return x.id === art.getAttribute('data-id'); })[0], patch = {}, key = f.getAttribute('data-f');
        patch[key] = f.value;
        B.client.from('orders').update(patch).eq('id', o.id).then(function (r) {
            if (r.error) throw r.error;
            o[key] = f.value; toast('Saved');
            if (key === 'status') { var c = $('.chip', art); c.className = 'chip st-' + o.status; c.textContent = STATUS_NAME[o.status]; drawStats(); var n = ORDERS.filter(function (x) { return x.status === 'new'; }).length, b = $('#adm-new'); b.hidden = !n; b.textContent = n; }
        }).catch(fail);
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
        root.innerHTML = '<div class="adm-bar"><h2>Website images</h2></div><p class="adm-lead">Change the two big pictures on your home page. Upload a new photo and it goes live straight away. "Use original" puts the first photo back.</p><div id="w-grid"><p class="adm-loading">Loading...</p></div>';
        B.content().then(function (c) { CONTENT = c || {}; drawWebsite(); });
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

    /* ------------------------------ start ------------------------------ */
    B.ready.then(function () { gate(); if (B.isAdmin()) loadOrders(); });
    B.onAuth(function () { gate(); if (B.isAdmin() && tab !== 'orders') loadOrders(); else if (B.isAdmin()) { /* orders view loads itself */ } });
    setInterval(function () { if (B.isAdmin() && !doc.hidden && tab === 'orders' && !$('.adm-order [aria-expanded=true]')) loadOrders(); }, 90000);
})();
