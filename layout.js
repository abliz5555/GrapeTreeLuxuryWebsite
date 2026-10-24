/* =====================================================================
   GRAPE TREE - SHARED HEADER AND FOOTER
   One place for the menu and the footer, used by every page.
   Change a link or your contact details here (or in shop-data.js,
   "company") and every page updates.
   Pages call:  GTLayout.header()  and  GTLayout.footer()
   ===================================================================== */
(function () {
    'use strict';
    var DATA = window.GT_DATA || {};
    var C = DATA.config || {}, CO = C.company || {}, S = C.social || {};
    var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var body = function () { return document.body; };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function cur(file, extra) { return (path === file || (extra && extra.indexOf(path) > -1)) ? ' aria-current="page"' : ''; }

    var ICON = {
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6"/></svg>',
        bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 8h13l-1 12h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
        ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
        tt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 2h-3.2v13.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 5.9V8.4a7.3 7.3 0 0 0 4.2 1.3V6.5A4.3 4.3 0 0 1 16.6 2z"/></svg>',
        fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.5c0-.7.3-1 1-1h2V2h-3c-3 0-4 1.8-4 4v2H8v3.500h2V22h4v-10.500h2.800L17.500 8z"/></svg>',
        wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm5.200 14.200c-.2.600-1.300 1.200-1.800 1.200-.5.100-1 .2-3.300-.7-2.800-1.100-4.600-4-4.700-4.200-.1-.2-1.100-1.500-1.100-2.800s.7-2 1-2.300c.2-.3.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.8 2c.1.200.1.400 0 .5l-.3.500c-.2.200-.3.300-.1.600.2.300.8 1.300 1.700 2.100 1.200 1 2.100 1.400 2.400 1.500.3.200.5.100.6-.1l.8-1c.2-.3.400-.2.600-.1l1.900.9c.3.100.5.200.5.300.1.300.1.800-.1 1.400z"/></svg>',
        pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.100 7-11a7 7 0 0 0-14 0c0 4.900 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/></svg>',
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
        tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
    };

    /* ------------------------------ HEADER ------------------------------ */
    function header() {
        var cls = body().className || '';
        var brand = /theme-kat/.test(cls) ? 'kat' : /theme-gild/.test(cls) ? 'gild' : '';
        var logo = brand === 'kat' ? 'images/katanukiya-logo.svg' : brand === 'gild' ? 'images/gildart-logo.svg' : 'images/logo.svg';
        var alt = brand === 'kat' ? 'Katanukiya' : brand === 'gild' ? 'GildArt' : 'Grape Tree FZE';
        var shopOn = (path === 'shop.html' || path === 'customize.html' || path === 'cake-studio.html' || path === 'chocolate-studio.html' || path === 'checkout.html') ? ' aria-current="page"' : '';
        var brandsOn = (path === 'katanukiya.html' || path === 'gildart.html') ? ' aria-current="page"' : '';
        var home = path === 'index.html' || path === '';
        var h =
            '<div class="gt-hdr" id="gt-hdr" role="banner">' +
            '<a class="gt-logo" href="index.html" aria-label="' + esc(alt) + '"><img src="' + logo + '" alt="' + esc(alt) + '"></a>' +
            '<nav id="nav-menu" class="gt-nav" aria-label="Main">' +
            '<a href="index.html"' + (home ? ' aria-current="page"' : '') + '>Home</a>' +
            '<div class="gt-has-menu">' +
            '<a href="' + (home ? '#brands' : 'index.html#brands') + '" class="gt-brands-link" aria-haspopup="true" aria-expanded="false"' + brandsOn + '>Brands</a>' +
            '<div class="gt-mega" role="menu">' +
            '<a class="gt-mega-card gt-mega-kat" href="katanukiya.html" role="menuitem"><img src="images/katanukiya-logo.svg" alt="Katanukiya"><span>Cut-out layer cakes</span></a>' +
            '<a class="gt-mega-card gt-mega-gild" href="gildart.html" role="menuitem"><img src="images/gildart-logo.svg" alt="GildArt"><span>Golden chocolate</span></a>' +
            '</div></div>' +
            '<a href="shop.html"' + shopOn + '>Shop</a>' +
            '<a href="' + (home ? '#story' : 'index.html#story') + '">Our Story</a>' +
            '<a href="contact.html"' + cur('contact.html') + '>Contact</a>' +
            '</nav>' +
            '<a href="checkout.html" class="cart-btn" aria-label="Open your cart">' + ICON.bag + '<span class="cart-count" data-cart-count>0</span></a>' +
            '<button type="button" class="menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false">&#9776;</button>' +
            '</div>';
        document.write(h);
        document.documentElement.classList.add('gt-has-hdr');
    }

    /* ------------------------------ FOOTER ------------------------------ */
    function footer() {
        var wa = C.whatsapp || '971555577478';
        var addr = CO.address || 'Dubai, United Arab Emirates';
        var q = CO.mapQuery || addr;
        var rows = '';
        rows += '<li>' + ICON.pin + '<span>' + esc(addr) + '</span></li>';
        rows += '<li>' + ICON.wa + '<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">+' + esc(wa).replace(/^(\d{3})(\d{2})(\d{3})(\d+)$/, '$1 $2 $3 $4') + '</a></li>';
        if (CO.phone) rows += '<li>' + ICON.tel + '<a href="tel:' + esc(CO.phone.replace(/\s/g, '')) + '">' + esc(CO.phone) + '</a></li>';
        if (CO.email) rows += '<li>' + ICON.mail + '<a href="mailto:' + esc(CO.email) + '">' + esc(CO.email) + '</a></li>';
        if (CO.hours) rows += '<li>' + ICON.clock + '<span>' + esc(CO.hours) + '</span></li>';
        var soc = '';
        if (S.instagramKatanukiya) soc += '<a href="' + esc(S.instagramKatanukiya) + '" target="_blank" rel="noopener" aria-label="Katanukiya on Instagram" title="Katanukiya on Instagram">' + ICON.ig + '<small>Katanukiya</small></a>';
        if (S.instagramGildart) soc += '<a href="' + esc(S.instagramGildart) + '" target="_blank" rel="noopener" aria-label="GildArt on Instagram" title="GildArt on Instagram">' + ICON.ig + '<small>GildArt</small></a>';
        if (S.tiktok) soc += '<a href="' + esc(S.tiktok) + '" target="_blank" rel="noopener" aria-label="TikTok" title="TikTok">' + ICON.tt + '</a>';
        if (S.facebook) soc += '<a href="' + esc(S.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">' + ICON.fb + '</a>';
        var map = CO.map === false ? '' :
            '<div class="gt-ftr-map"><iframe title="Our location" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed"></iframe>' +
            '<a class="gt-ftr-dir" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">Get directions</a></div>';
        var f =
            '<footer class="gt-ftr">' +
            '<div class="gt-ftr-grid">' +
            '<div class="gt-ftr-brand"><img src="images/logo2.svg" alt="Grape Tree FZE"><p>Japanese craftsmanship, made for gifting in the UAE.</p><div class="gt-soc">' + soc + '</div></div>' +
            '<div class="gt-ftr-col"><h4>Explore</h4><a href="index.html">Home</a><a href="katanukiya.html">Katanukiya</a><a href="gildart.html">GildArt</a><a href="shop.html">Shop</a><a href="shop.html#custom">Custom orders</a></div>' +
            '<div class="gt-ftr-col"><h4>Customers</h4><a href="account.html">My account</a><a href="account.html">My orders</a><a href="checkout.html">Cart</a><a href="contact.html">Contact us</a></div>' +
            '<div class="gt-ftr-col gt-ftr-contact"><h4>Visit &amp; contact</h4><ul>' + rows + '</ul></div>' +
            map +
            '</div>' +
            '<div class="gt-ftr-bottom"><span>&copy; ' + new Date().getFullYear() + ' Grape Tree FZE. All rights reserved.</span><span>Katanukiya &middot; GildArt</span></div>' +
            '</footer>' +
            '<a href="https://wa.me/' + esc(wa) + '" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><img src="images/whatsapp.png" alt="WhatsApp"></a>';
        document.write(f);
    }

    /* ------------------------------ behaviour ------------------------------ */
    function wire() {
        var hdr = document.getElementById('gt-hdr'); if (!hdr) return;
        var wrap = hdr.querySelector('.gt-has-menu'), link = hdr.querySelector('.gt-brands-link'), root = document.documentElement, t;
        function open(v) { clearTimeout(t); wrap.classList.toggle('open', v); link.setAttribute('aria-expanded', v ? 'true' : 'false'); root.classList.toggle('gt-mega-open', v); }
        var desktop = function () { return window.matchMedia('(min-width:1101px)').matches; };
        wrap.addEventListener('mouseenter', function () { if (desktop()) open(true); });
        wrap.addEventListener('mouseleave', function () { if (desktop()) { t = setTimeout(function () { open(false); }, 140); } });
        wrap.addEventListener('focusin', function () { if (desktop()) open(true); });
        wrap.addEventListener('focusout', function (e) { if (desktop() && !wrap.contains(e.relatedTarget)) open(false); });
        link.addEventListener('click', function (e) { if (!desktop()) { e.preventDefault(); open(!wrap.classList.contains('open')); } });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
        function sc() { hdr.classList.toggle('gt-scrolled', (window.pageYOffset || 0) > 20); }
        window.addEventListener('scroll', sc, { passive: true }); sc();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

    window.GTLayout = { header: header, footer: footer };
})();
