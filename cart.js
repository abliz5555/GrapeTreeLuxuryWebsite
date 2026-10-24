/* =====================================================================
   GRAPE TREE - CART  (loaded on every page)
   Keeps the cart in the visitor's browser (localStorage), updates the
   header cart badge, and shows the slide-in cart drawer + small toast.
   Nothing here talks to a server.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {}, products: [] };
    var CFG = DATA.config || {};
    var CURRENCY = CFG.currency || 'AED';
    var KEY = 'gt-cart-v1';

    /* ------------------------------ helpers ------------------------------ */
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(n) {
        n = Number(n) || 0;
        return n % 1 ? n.toFixed(2) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function money(n) {
        if (CFG.showPrices === false) return 'Price on request';
        return CURRENCY + ' ' + num(n);
    }
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

    /* ------------------------------ storage ------------------------------ */
    var cart = load();

    function load() {
        try {
            var v = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
        changed();
    }
    var listeners = [];
    function changed() {
        renderBadge();
        renderDrawer();
        listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    }
    window.addEventListener('storage', function (e) {
        if (e.key === KEY) { cart = load(); changed(); }
    });

    /* ------------------------------ cart API ------------------------------ */
    function lineTotal(l) { return (l.unit || 0) * l.qty + (l.fee || 0); }

    function totals() {
        var t = { subtotal: 0, count: 0, hasQuote: false };
        cart.forEach(function (l) {
            t.subtotal += lineTotal(l);
            t.count += l.qty;
            if (l.quote) t.hasQuote = true;
        });
        return t;
    }

    function add(line) {
        line.qty = Math.max(1, parseInt(line.qty, 10) || 1);
        line.sig = line.sig || [line.id, JSON.stringify(line.meta || []), line.note || ''].join('|');
        var same = cart.filter(function (l) { return l.sig === line.sig; })[0];
        if (same) {
            same.qty = Math.min(same.qty + line.qty, 999);
        } else {
            line.key = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            cart.push(line);
        }
        save();
    }
    function setQty(key, qty) {
        cart.forEach(function (l) { if (l.key === key) l.qty = Math.max(1, Math.min(999, qty)); });
        save();
    }
    function remove(key) {
        var gone = cart.filter(function (l) { return l.key === key; })[0], grp = gone && gone.group;
        cart = cart.filter(function (l) { return l.key !== key && !(grp && l.group === grp); });   // a multi-piece box set is removed as one
        save();
    }
    function clear() { cart = []; save(); }

    /* ------------------------------ header badge ------------------------------ */
    function renderBadge() {
        var n = totals().count;
        $$('[data-cart-count]').forEach(function (b) {
            b.textContent = n > 99 ? '99+' : n;
            b.classList.toggle('has-items', n > 0);
        });
    }

    /* ------------------------------ drawer ------------------------------ */
    var drawer, backdrop, lastFocus = null;

    function buildDrawer() {
        backdrop = doc.createElement('div');
        backdrop.className = 'gt-drawer-backdrop';
        backdrop.addEventListener('click', closeCart);

        drawer = doc.createElement('aside');
        drawer.className = 'gt-drawer';
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-label', 'Your cart');
        drawer.innerHTML =
            '<div class="gt-drawer-head"><h3>Your Cart</h3>' +
            '<button type="button" class="gt-x" aria-label="Close cart">&times;</button></div>' +
            '<div class="gt-drawer-body"></div>' +
            '<div class="gt-drawer-foot"></div>';

        doc.body.appendChild(backdrop);
        doc.body.appendChild(drawer);

        $('.gt-x', drawer).addEventListener('click', closeCart);
        drawer.addEventListener('click', function (e) {
            var t = e.target.closest('[data-act]');
            if (!t) return;
            var key = t.getAttribute('data-key');
            var line = cart.filter(function (l) { return l.key === key; })[0];
            var act = t.getAttribute('data-act');
            if (act === 'rm') remove(key);
            else if (line && act === 'inc') setQty(key, line.qty + 1);
            else if (line && act === 'dec') {
                if (line.qty > 1) setQty(key, line.qty - 1); else remove(key);
            } else if (act === 'close') closeCart();
        });
        doc.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart();
        });
    }

    function renderDrawer() {
        if (!drawer) return;
        var body = $('.gt-drawer-body', drawer);
        var foot = $('.gt-drawer-foot', drawer);

        if (!cart.length) {
            body.innerHTML =
                '<div class="gt-empty"><p>Your cart is empty.</p>' +
                '<a class="gt-btn" href="shop.html">Browse the shop</a></div>';
            foot.innerHTML = '';
            foot.style.display = 'none';
            return;
        }

        body.innerHTML = cart.map(function (l) {
            var meta = (l.meta || []).map(function (m) {
                return '<li><span>' + esc(m[0]) + '</span> ' + esc(m[1]) + '</li>';
            }).join('');
            var price = l.included ? 'Included' : (l.quote && !l.unit && !l.fee ? 'Quoted' : money(lineTotal(l)));
            return '<div class="gt-line-item">' +
                '<img src="' + esc(l.img) + '" alt="">' +
                '<div class="gt-li-main">' +
                '<h4>' + esc(l.name) + '</h4>' +
                (meta ? '<ul class="gt-li-meta">' + meta + '</ul>' : '') +
                '<div class="gt-li-row">' +
                (l.fixed ? '<span class="gt-fixedqty">' + (l.included ? 'in box set' : '1 order') + '</span>' :
                '<div class="gt-qty" role="group" aria-label="Quantity">' +
                '<button type="button" data-act="dec" data-key="' + l.key + '" aria-label="Decrease">&minus;</button>' +
                '<span>' + l.qty + '</span>' +
                '<button type="button" data-act="inc" data-key="' + l.key + '" aria-label="Increase">+</button>' +
                '</div>') +
                '<strong>' + price + '</strong>' +
                '</div>' +
                '<button type="button" class="gt-rm" data-act="rm" data-key="' + l.key + '">Remove</button>' +
                '</div></div>';
        }).join('');

        var t = totals();
        foot.style.display = '';
        foot.innerHTML =
            '<div class="gt-sum"><span>Subtotal' + (t.hasQuote ? ' <em>(quoted items extra)</em>' : '') + '</span>' +
            '<strong>' + money(t.subtotal) + '</strong></div>' +
            '<p class="gt-fine">Final price and delivery are confirmed with you before payment.</p>' +
            '<a class="gt-btn gt-btn-block" href="checkout.html">Checkout</a>' +
            '<button type="button" class="gt-link" data-act="close">Continue shopping</button>';
    }

    function openCart() {
        if (!drawer) buildDrawer();
        renderDrawer();
        lastFocus = doc.activeElement;
        drawer.classList.add('open');
        backdrop.classList.add('open');
        doc.documentElement.classList.add('gt-drawer-open');
        var x = $('.gt-x', drawer);
        if (x) x.focus();
    }
    function closeCart() {
        if (!drawer) return;
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        doc.documentElement.classList.remove('gt-drawer-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* ------------------------------ toast ------------------------------ */
    var toastTimer;
    function toast(message, withCartLink) {
        var t = $('.gt-toast');
        if (!t) {
            t = doc.createElement('div');
            t.className = 'gt-toast';
            t.setAttribute('role', 'status');
            doc.body.appendChild(t);
        }
        t.innerHTML = '<span>' + esc(message) + '</span>' +
            (withCartLink ? '<button type="button" data-open-cart>View cart</button>' : '');
        void t.offsetWidth;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3600);
    }

    /* ------------------------------ preview banner ------------------------------ */
    function previewBanner() {
        if (!CFG.previewBanner || !doc.body.hasAttribute('data-shop')) return;
        var bar = doc.createElement('div');
        bar.className = 'gt-preview-bar';
        bar.textContent = 'Preview: products, prices and options on this page are samples. Edit shop-data.js, then set previewBanner to false.';
        var header = $('.gt-hdr') || $('header');
        if (header && header.nextSibling) header.parentNode.insertBefore(bar, header.nextSibling);
        else doc.body.insertBefore(bar, doc.body.firstChild);
    }

    /* ------------------------------ wiring ------------------------------ */
    function init() {
        renderBadge();
        previewBanner();

        doc.addEventListener('click', function (e) {
            var openBtn = e.target.closest('[data-open-cart]');
            if (openBtn) { e.preventDefault(); openCart(); return; }
            var cartBtn = e.target.closest('.cart-btn');
            if (cartBtn && !doc.body.hasAttribute('data-checkout')) {
                e.preventDefault();
                openCart();
            }
        });

        if (location.search.indexOf('cart=open') > -1) openCart();
    }

    window.GT = window.GT || {};
    window.GT.cart = {
        items: function () { return cart.slice(); },
        add: add, setQty: setQty, remove: remove, clear: clear,
        totals: totals, lineTotal: lineTotal,
        onChange: function (fn) { listeners.push(fn); },
        open: openCart, close: closeCart
    };
    window.GT.money = money;
    window.GT.esc = esc;
    window.GT.toast = toast;

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})();
