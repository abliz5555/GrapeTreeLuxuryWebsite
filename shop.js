/* =====================================================================
   GRAPE TREE - SHOP PAGE
   Draws the product cards from shop-data.js, handles the brand filter,
   the quick-view window and "Add to cart".
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {}, products: [] };
    var CFG = DATA.config || {};
    var PRODUCTS = DATA.products || [];
    var BACKEND = window.GT && window.GT.backend;
    var BRAND = { katanukiya: 'Katanukiya', gildart: 'GildArt' };

    var esc = function (s) { return window.GT.esc(s); };
    var money = function (n) { return window.GT.money(n); };
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

    var grid, countEl, chips, filter = 'all';

    function customizeUrl(p) {
        /* every "Customize" button opens the live design studio of that brand */
        if (p.customize && p.customize.builder === 'gildart') return 'chocolate-studio.html';
        if (p.customize && p.customize.builder === 'katanukiya') return 'cake-studio.html';
        return 'shop.html#custom';
    }

    function priceText(p) {
        return CFG.showPrices === false ? 'Price on request' : money(p.price);
    }

    function cardHTML(p) {
        var brand = BRAND[p.brand] || p.brand;
        return '<article class="product-card" data-id="' + esc(p.id) + '">' +
            '<button type="button" class="pc-media" data-view="' + esc(p.id) + '" aria-label="View details: ' + esc(p.name) + '">' +
            '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">' +
            '<span class="pc-badge">' + esc(brand) + '</span>' +
            '<span class="pc-quick" aria-hidden="true">Quick view</span>' +
            '</button>' +
            '<div class="pc-body">' +
            '<h3>' + esc(p.name) + '</h3>' +
            '<p class="pc-short">' + esc(p.short) + '</p>' +
            '<div class="pc-foot">' +
            '<span class="pc-price">' + esc(priceText(p)) + '</span>' +
            '<button type="button" class="gt-btn" data-add="' + esc(p.id) + '">Add to cart</button>' +
            '</div>' +
            '<a class="pc-custom" href="' + esc(customizeUrl(p)) + '">Customize this</a>' +
            '</div></article>';
    }

    function render(animate) {
        var list = PRODUCTS.filter(function (p) { return filter === 'all' || p.brand === filter; });
        grid.innerHTML = list.map(cardHTML).join('');
        countEl.textContent = list.length + (list.length === 1 ? ' product' : ' products');
        chips.forEach(function (c) {
            var on = c.getAttribute('data-filter') === filter;
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (window.GT && window.GT.reveal) window.GT.reveal($$('.product-card', grid), false);
    }

    function setFilter(f, push) {
        if (f === filter) return;
        var cards = $$('.product-card', grid);
        cards.forEach(function (c) { c.classList.add('is-hiding'); });
        filter = f;
        setTimeout(function () { render(); }, cards.length ? 230 : 0);
        if (push) {
            try {
                var url = f === 'all' ? location.pathname : location.pathname + '?brand=' + f;
                history.replaceState(null, '', url);
            } catch (e) {}
        }
    }

    function addToCart(p, qty) {
        window.GT.cart.add({ id: p.id, name: p.name, img: p.img, unit: p.price || 0, qty: qty || 1, meta: [] });
        window.GT.toast('Added “' + p.name + '” to your cart', true);
    }

    function productById(id) {
        return PRODUCTS.filter(function (p) { return p.id === id; })[0];
    }

    /* ------------------------------ quick view ------------------------------ */
    var modal, modalProduct, modalQty = 1, lastFocus = null;

    function buildModal() {
        modal = doc.createElement('div');
        modal.className = 'gt-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Product details');
        modal.innerHTML =
            '<div class="gt-modal-card">' +
            '<button type="button" class="gt-modal-x" aria-label="Close">&times;</button>' +
            '<div class="gt-modal-media"><img src="" alt=""></div>' +
            '<div class="gt-modal-info"></div>' +
            '</div>';
        doc.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.closest('.gt-modal-x')) closeModal();
            var act = e.target.closest('[data-m]');
            if (!act) return;
            var m = act.getAttribute('data-m');
            if (m === 'inc') modalQty = Math.min(modalQty + 1, 99);
            if (m === 'dec') modalQty = Math.max(modalQty - 1, 1);
            if (m === 'inc' || m === 'dec') $('.gt-qty span', modal).textContent = modalQty;
            if (m === 'add') { addToCart(modalProduct, modalQty); closeModal(); }
            if (m === 'share') shareProduct(modalProduct);
        });

        doc.addEventListener('keydown', function (e) {
            if (!modal.classList.contains('open')) return;
            if (e.key === 'Escape') { closeModal(); return; }
            if (e.key !== 'Tab') return;
            var f = $$('button, a[href]', modal).filter(function (el) { return el.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    function openModal(id) {
        var p = productById(id);
        if (!p) return;
        if (!modal) buildModal();
        modalProduct = p;
        modalQty = 1;
        lastFocus = doc.activeElement;

        var img = $('.gt-modal-media img', modal);
        img.src = p.img;
        img.alt = p.name;

        $('.gt-modal-info', modal).innerHTML =
            '<p class="small-title">' + esc((BRAND[p.brand] || p.brand).toUpperCase()) + '</p>' +
            '<h3>' + esc(p.name) + '</h3>' +
            '<div class="gt-modal-price">' + esc(priceText(p)) + '</div>' +
            '<p class="gt-modal-desc">' + esc(p.desc || p.short) + '</p>' +
            ((p.details && p.details.length)
                ? '<ul class="gt-modal-list">' + p.details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>'
                : '') +
            '<div class="gt-modal-buy">' +
            '<div class="gt-qty" role="group" aria-label="Quantity">' +
            '<button type="button" data-m="dec" aria-label="Decrease">&minus;</button><span>1</span>' +
            '<button type="button" data-m="inc" aria-label="Increase">+</button></div>' +
            '<button type="button" class="gt-btn" data-m="add">Add to cart</button></div>' +
            '<a class="pc-custom" href="' + esc(customizeUrl(p)) + '">Customize this gift</a>' +
            '<button type="button" class="pc-share" data-m="share">Share this product</button>';

        modal.classList.add('open');
        doc.documentElement.style.overflow = 'hidden';
        $('.gt-modal-x', modal).focus();
    }

    /* Share link: p/<id>.html shows a rich preview (photo + name) on Instagram, WhatsApp, TikTok, then opens the product */
    function productLink(p) {
        return new URL('p/' + p.id + '.html', location.href).href;
    }
    function shareProduct(p) {
        var url = productLink(p);
        var data = { title: p.name + ' | Grape Tree', text: p.short || p.name, url: url };
        if (navigator.share) { navigator.share(data).catch(function () {}); return; }
        var done = function () { window.GT.toast('Link copied', false); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else { var t = doc.createElement('input'); t.value = url; doc.body.appendChild(t); t.select(); try { doc.execCommand('copy'); } catch (e) {} t.remove(); done(); }
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        doc.documentElement.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* ------------------------------ start ------------------------------ */
    function init() {
        grid = $('#product-grid');
        countEl = $('#shop-count');
        chips = $$('.chip[data-filter]');
        if (!grid) return;

        var q = /[?&]brand=(\w+)/.exec(location.search);
        if (q && BRAND[q[1]]) filter = q[1];

        grid.setAttribute('aria-busy', 'true');
        var loaded = (window.GT.data && window.GT.data.products) ? window.GT.data.products() : Promise.resolve(PRODUCTS);
        loaded.then(function (list) { if (list && list.length) PRODUCTS = list; }, function () {}).then(function () {
            grid.removeAttribute('aria-busy');
            render();
            var pq = /[?&]product=([\w-]+)/.exec(location.search);
            if (pq && productById(pq[1])) setTimeout(function () { openModal(pq[1]); }, 450);
        });

        chips.forEach(function (c) {
            c.addEventListener('click', function () { setFilter(c.getAttribute('data-filter'), true); });
        });

        grid.addEventListener('click', function (e) {
            var view = e.target.closest('[data-view]');
            if (view) { openModal(view.getAttribute('data-view')); return; }
            var add = e.target.closest('[data-add]');
            if (add) {
                var p = productById(add.getAttribute('data-add'));
                if (!p) return;
                addToCart(p, 1);
                var old = add.textContent;
                add.textContent = 'Added ✓';
                setTimeout(function () { add.textContent = old; }, 1500);
            }
        });
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})();
