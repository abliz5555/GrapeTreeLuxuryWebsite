/* =====================================================================
   GRAPE TREE - CUSTOMER ACCOUNT PAGE
   Sign in / create account / forgot password / my orders / my details.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document, B = window.GT.backend, CFG = (window.GT_DATA || {}).config || {};
    var root = doc.getElementById('acct-root'), title = doc.getElementById('acct-title');
    var esc = function (s) { return window.GT.esc(s); };
    var money = function (n) { return window.GT.money(n); };
    var tab = 'in';

    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
    function T(s) { return window.GT.lang ? window.GT.lang.t(s) : s; }

    /* friendly messages instead of technical ones */
    function friendly(e) {
        var m = String((e && (e.message || e.error_description)) || e || '');
        if (/invalid login/i.test(m)) return 'The email or password is not right.';
        if (/not confirmed/i.test(m)) return 'Please confirm your email first. We sent you a link.';
        if (/already registered|already been registered/i.test(m)) return 'This email already has an account. Please sign in.';
        if (/password.*(6|short|weak)|at least/i.test(m)) return 'Please use a password with at least 8 characters.';
        if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Please wait a few minutes and try again.';
        if (/network|fetch|timeout|failed/i.test(m)) return 'We could not reach the server. Please check your internet and try again.';
        if (/valid email|invalid.*email/i.test(m)) return 'That email address does not look right.';
        return 'Something went wrong. Please try again.';
    }
    function msg(box, text, good) {
        var n = $('.acct-msg', box || root);
        if (!n) return;
        n.textContent = text ? T(text) : '';
        n.className = 'acct-msg' + (good ? ' good' : '') + (text ? ' show' : '');
    }
    function busy(btn, on, label) {
        if (!btn) return;
        if (on) { btn.dataset.old = btn.textContent; btn.textContent = T(label || 'Please wait...'); btn.disabled = true; }
        else { btn.textContent = btn.dataset.old || btn.textContent; btn.disabled = false; }
    }
    function dateText(s) { try { return new Date(s).toLocaleDateString(({ar:'ar-AE',tr:'tr-TR',zh:'zh-CN',ru:'ru-RU',ja:'ja-JP'}[document.documentElement.lang]||'en-GB'), { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

    var STATUS = { new: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready for delivery', delivering: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

    /* ------------------------------ views ------------------------------ */
    function viewOff() {
        title.textContent = 'My Account';
        root.innerHTML = '<div class="acct-card"><h2>Accounts are not available yet</h2><p>Sign-in could not connect. Please check your internet and reload the page. If you are looking at a preview copy of the website, sign-in only works on the live website. You can still order through the shop, or send us a message on WhatsApp.</p>' +
            '<a class="gt-btn" href="shop.html">Browse the shop</a></div>';
    }

    function viewAuth() {
        title.textContent = 'Welcome';
        root.innerHTML =
            '<div class="acct-card acct-auth">' +
            '<div class="acct-tabs" role="tablist">' +
            '<button type="button" role="tab" data-tab="in" class="' + (tab === 'in' ? 'on' : '') + '">Sign in</button>' +
            '<button type="button" role="tab" data-tab="up" class="' + (tab === 'up' ? 'on' : '') + '">Create account</button></div>' +
            (tab === 'in' ? formIn() : tab === 'up' ? formUp() : formForgot()) +
            '</div>';
        $$('.acct-tabs button').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); viewAuth(); }); });
        var f = $('form', root);
        if (tab === 'in') f.addEventListener('submit', doIn);
        else if (tab === 'up') f.addEventListener('submit', doUp);
        else f.addEventListener('submit', doForgot);
        var fl = $('[data-forgot]', root); if (fl) fl.addEventListener('click', function () { tab = 'forgot'; viewAuth(); });
        var bk = $('[data-back]', root); if (bk) bk.addEventListener('click', function () { tab = 'in'; viewAuth(); });
    }
    function formIn() {
        return '<form novalidate>' +
            '<div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required></div>' +
            '<div class="field"><label for="a-pass">Password</label><input id="a-pass" type="password" autocomplete="current-password" required></div>' +
            '<p class="acct-msg" role="alert"></p>' +
            '<button class="gt-btn gt-btn-block" type="submit">Sign in</button>' +
            '<button type="button" class="acct-link" data-forgot>Forgot your password?</button></form>';
    }
    function formUp() {
        return '<form novalidate>' +
            '<div class="field"><label for="a-name">Full name</label><input id="a-name" type="text" autocomplete="name" required></div>' +
            '<div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required></div>' +
            '<div class="field"><label for="a-phone">Phone / WhatsApp <span class="opt">(optional)</span></label><input id="a-phone" type="tel" autocomplete="tel"></div>' +
            '<div class="field"><label for="a-pass">Password</label><input id="a-pass" type="password" autocomplete="new-password" minlength="8" required><p class="hint">At least 8 characters.</p></div>' +
            '<p class="acct-msg" role="alert"></p>' +
            '<button class="gt-btn gt-btn-block" type="submit">Create account</button></form>';
    }
    function formForgot() {
        return '<form novalidate><p class="acct-lead">Enter your email and we will send you a link to choose a new password.</p>' +
            '<div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required></div>' +
            '<p class="acct-msg" role="alert"></p>' +
            '<button class="gt-btn gt-btn-block" type="submit">Send reset link</button>' +
            '<button type="button" class="acct-link" data-back>Back to sign in</button></form>';
    }

    function doIn(e) {
        e.preventDefault();
        var btn = $('button[type=submit]', root), em = $('#a-email').value.trim(), pw = $('#a-pass').value;
        if (!em || !pw) return msg(root, 'Please enter your email and password.');
        msg(root, ''); busy(btn, true, 'Signing in...');
        B.signIn(em, pw).then(function () { /* onAuth redraws */ }).catch(function (err) { busy(btn, false); msg(root, friendly(err)); });
    }
    function doUp(e) {
        e.preventDefault();
        var btn = $('button[type=submit]', root), n = $('#a-name').value.trim(), em = $('#a-email').value.trim(), ph = $('#a-phone').value.trim(), pw = $('#a-pass').value;
        if (!n) return msg(root, 'Please enter your name.');
        if (!/^\S+@\S+\.\S+$/.test(em)) return msg(root, 'That email address does not look right.');
        if (pw.length < 8) return msg(root, 'Please use a password with at least 8 characters.');
        msg(root, ''); busy(btn, true, 'Creating...');
        B.signUp(em, pw, n, ph).then(function (d) {
            var u = d && d.user;
            if (u && u.identities && u.identities.length === 0) { busy(btn, false); return msg(root, 'This email already has an account. Please sign in.'); }
            if (d && d.session) return;                             /* confirmation switched off: already signed in */
            root.innerHTML = '<div class="acct-card acct-done"><div class="tick" aria-hidden="true"></div><h2>Check your email</h2>' +
                '<p>We sent a confirmation link to <strong dir="ltr">' + esc(em) + '</strong>. Open it to finish creating your account, then sign in.</p>' +
                '<button class="gt-btn" type="button" id="a-go">Go to sign in</button></div>';
            $('#a-go').addEventListener('click', function () { tab = 'in'; viewAuth(); });
        }).catch(function (err) { busy(btn, false); msg(root, friendly(err)); });
    }
    function doForgot(e) {
        e.preventDefault();
        var btn = $('button[type=submit]', root), em = $('#a-email').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(em)) return msg(root, 'That email address does not look right.');
        msg(root, ''); busy(btn, true, 'Sending...');
        B.resetPassword(em).then(function () { busy(btn, false); msg(root, 'If that email has an account, a reset link is on its way.', true); })
            .catch(function (err) { busy(btn, false); msg(root, friendly(err)); });
    }

    function viewRecovery() {
        title.textContent = 'New password';
        root.innerHTML = '<div class="acct-card acct-auth"><form novalidate><p class="acct-lead">Choose a new password for your account.</p>' +
            '<div class="field"><label for="a-pass">New password</label><input id="a-pass" type="password" autocomplete="new-password" minlength="8" required><p class="hint">At least 8 characters.</p></div>' +
            '<p class="acct-msg" role="alert"></p><button class="gt-btn gt-btn-block" type="submit">Save new password</button></form></div>';
        $('form', root).addEventListener('submit', function (e) {
            e.preventDefault();
            var pw = $('#a-pass').value, btn = $('button[type=submit]', root);
            if (pw.length < 8) return msg(root, 'Please use a password with at least 8 characters.');
            busy(btn, true, 'Saving...');
            B.setPassword(pw).then(function () { B.recovery = false; try { history.replaceState(null, '', location.pathname); } catch (x) {} viewAccount(); })
                .catch(function (err) { busy(btn, false); msg(root, friendly(err)); });
        });
    }

    /* ------------------------------ signed in ------------------------------ */
    function viewAccount() {
        var p = B.profile || {}, u = B.user();
        var first = String(p.full_name || '').split(' ')[0];
        title.textContent = first ? 'Hello, ' + first : 'My Account';
        root.innerHTML =
            '<div class="acct-grid">' +
            '<section class="acct-card acct-orders"><h2>My orders</h2><div id="a-orders"><p class="acct-loading">Loading...</p></div></section>' +
            '<aside class="acct-side">' +
            (B.isAdmin() ? '<a class="acct-card acct-admin" href="admin.html"><strong>Open the admin dashboard</strong><span>Manage products, orders and website images</span></a>' : (B.isStaff() ? '<a class="acct-card acct-admin" href="admin.html"><strong>Open the orders page</strong><span>See, track and update customer orders</span></a>' : '')) +
            '<section class="acct-card"><h2>My details</h2><form id="a-prof" novalidate>' +
            '<div class="field"><label for="p-name">Full name</label><input id="p-name" type="text" value="' + esc(p.full_name || '') + '"></div>' +
            '<div class="field"><label for="p-phone">Phone / WhatsApp</label><input id="p-phone" type="tel" value="' + esc(p.phone || '') + '"></div>' +
            '<div class="field"><label>Email</label><input type="email" value="' + esc(u ? u.email : '') + '" disabled></div>' +
            '<p class="acct-msg" role="status"></p><button class="gt-btn" type="submit">Save details</button></form></section>' +
            '<section class="acct-card"><h2>Saved addresses</h2><div id="a-addrs"></div>' +
            '<form id="a-addr" novalidate><div class="field"><label for="ad-em">Emirate</label><select id="ad-em"></select></div>' +
            '<div class="field"><label for="ad-text">Address</label><textarea id="ad-text" rows="2" placeholder="Building, street, area, landmark"></textarea></div>' +
            '<p class="acct-msg" role="status"></p><button class="gt-btn gt-btn-outline" type="submit">Add address</button></form></section>' +
            '<button type="button" class="acct-link acct-out" id="a-out">Sign out</button>' +
            '</aside></div>';

        $('#ad-em').innerHTML = '<option value="">Choose an emirate</option>' + (CFG.emirates || []).map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('');
        $('#a-out').addEventListener('click', function () { B.signOut(); });
        $('#a-prof').addEventListener('submit', function (e) {
            e.preventDefault();
            var box = $('#a-prof'), btn = $('button', box);
            busy(btn, true, 'Saving...');
            B.saveProfile($('#p-name').value.trim(), $('#p-phone').value.trim()).then(function () { busy(btn, false); msg(box, 'Saved.', true); })
                .catch(function (err) { busy(btn, false); msg(box, friendly(err)); });
        });
        $('#a-addr').addEventListener('submit', function (e) {
            e.preventDefault();
            var box = $('#a-addr'), em = $('#ad-em').value, tx = $('#ad-text').value.trim();
            if (!em || !tx) return msg(box, 'Please choose an emirate and enter the address.');
            B.addAddress({ emirate: em, address: tx, phone: $('#p-phone').value.trim() }).then(function () { $('#ad-text').value = ''; msg(box, 'Address saved.', true); loadAddrs(); })
                .catch(function (err) { msg(box, friendly(err)); });
        });
        loadOrders(); loadAddrs();
    }

    function loadAddrs() {
        B.myAddresses().then(function (rows) {
            var box = $('#a-addrs'); if (!box) return;
            box.innerHTML = rows.length ? rows.map(function (a) {
                return '<div class="addr"><div><strong>' + esc(T(a.emirate)) + '</strong><p>' + esc(a.address) + '</p></div>' +
                    '<button type="button" class="acct-link" data-del="' + esc(a.id) + '">Delete</button></div>';
            }).join('') : '<p class="acct-muted">No saved addresses yet.</p>';
            $$('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () { B.deleteAddress(b.getAttribute('data-del')).then(loadAddrs); }); });
        }).catch(function () { var box = $('#a-addrs'); if (box) box.innerHTML = ''; });
    }

    function loadOrders() {
        Promise.all([B.myOrders(), B.products()]).then(function (r) {
            var rows = r[0], prods = r[1], box = $('#a-orders'); if (!box) return;
            if (!rows.length) { box.innerHTML = '<p class="acct-muted">You have not placed an order yet.</p><a class="gt-btn" href="shop.html">Browse the shop</a>'; return; }
            box.innerHTML = rows.map(function (o) {
                var items = (o.items || []).map(function (l) {
                    return '<li><span>' + esc(l.name) + '</span><em>x ' + esc(l.qty) + '</em></li>';
                }).join('');
                var canRe = (o.items || []).some(function (l) { return !l.custom && prods.some(function (p) { return p.id === l.id; }); });
                return '<article class="ord"><header><div><strong>Order #' + esc(o.order_no) + '</strong><span>' + esc(dateText(o.created_at)) + '</span></div>' +
                    '<span class="chip st-' + esc(o.status) + '">' + esc(T(STATUS[o.status] || o.status)) + '</span></header>' +
                    '<ul>' + items + '</ul>' +
                    '<footer><span>' + (o.has_quote ? esc(money(o.subtotal)) + ' + ' + esc(T('quoted items')) : esc(money(o.subtotal))) + '</span>' +
                    '<a class="acct-link" href="order-track.html?no=' + esc(o.order_no) + '">' + esc(T('Track order')) + '</a>' +
                    '<a class="acct-link" href="invoice.html?no=' + esc(o.order_no) + '&print=1" target="_blank" rel="noopener">Download PDF</a>' +
                    (canRe ? '<button type="button" class="acct-link" data-re="' + esc(o.id) + '">Order again</button>' : '') + '</footer></article>';
            }).join('');
            $$('[data-re]', box).forEach(function (b) {
                b.addEventListener('click', function () {
                    var o = rows.filter(function (x) { return x.id === b.getAttribute('data-re'); })[0], n = 0;
                    (o.items || []).forEach(function (l) {
                        var p = !l.custom && prods.filter(function (q) { return q.id === l.id; })[0];
                        if (p) { window.GT.cart.add({ id: p.id, name: p.name, img: p.img, unit: p.price, qty: l.qty, meta: [] }); n++; }
                    });
                    if (n) window.GT.cart.open();
                });
            });
        }).catch(function () { var box = $('#a-orders'); if (box) box.innerHTML = '<p class="acct-muted">We could not load your orders. Please refresh the page.</p>'; });
    }

    /* ------------------------------ email links (confirm / reset) ------------------------------
       The email contains a link to this page with ?token_hash=...&type=... The person must press a button,
       so mail programs that "pre-open" links can no longer use up the one-time link. */
    var QS = new URLSearchParams(location.search), TH = QS.get('token_hash'), TT = QS.get('type');
    function viewEmailLink() {
        var rec = TT === 'recovery';
        title.textContent = rec ? 'Reset your password' : 'Confirm your email';
        root.innerHTML = '<div class="acct-card acct-auth"><p class="acct-lead">' + (rec ? 'Press the button to choose a new password for your Grape Tree account.' : 'Press the button to confirm your email address and open your Grape Tree account.') + '</p>' +
            '<p class="acct-msg" role="alert"></p><button class="gt-btn gt-btn-block" type="button" id="a-go">' + (rec ? 'Choose a new password' : 'Confirm my email') + '</button></div>';
        $('#a-go').addEventListener('click', function () {
            var btn = this; busy(btn, true, 'One moment...');
            B.client.auth.verifyOtp({ token_hash: TH, type: TT }).then(function (r) {
                if (r.error) throw r.error;
                try { history.replaceState(null, '', location.pathname); } catch (x) {}
                TH = null;
                if (rec) { B.recovery = true; viewRecovery(); } else { route(); }
            }).catch(function () {
                busy(btn, false);
                msg(root, 'This link has expired or was already used. Please request a new one' + (rec ? ' with "Forgot password".' : ' by signing in again.'));
                var a = document.createElement('p'); a.innerHTML = '<a class="acct-link" href="account.html">Back to sign in</a>'; root.firstChild.appendChild(a);
            });
        });
    }

    /* ------------------------------ route ------------------------------ */
    function route() {
        if (!B.enabled) return viewOff();
        if (TH && /^(recovery|signup|email|email_change|invite|magiclink)$/.test(TT || '')) return viewEmailLink();
        if (B.recovery) return viewRecovery();
        if (B.session) return viewAccount();
        viewAuth();
    }
    B.ready.then(function () { route(); });
    var last = '';
    B.onAuth(function (session) {
        var now = session ? session.user.id : '';
        if (B.recovery) { viewRecovery(); last = now; return; }
        if (TH) return;
        if (now !== last) { last = now; route(); }
    });
    /* after a confirmation or reset link, clean the address bar */
    if (/access_token|type=recovery|type=signup/.test(location.hash)) setTimeout(function () { try { history.replaceState(null, '', location.pathname); } catch (e) {} }, 1500);
})();
