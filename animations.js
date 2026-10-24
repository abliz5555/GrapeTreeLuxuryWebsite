/* =====================================================================
   GRAPE TREE - ANIMATION LAYER (behaviour)
   Pairs with animations.css. Safe to remove: the site works without it.
   Sections:
     1. Intro curtain + "ready" signal for the hero
     2. Hero headline split into lines
     3. Scroll reveal
     4. Counters (count up when they come into view)
     5. Scroll effects: header, progress bar, parallax
     6. Lightbox (gallery photos)
     7. Page-change fade
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var root = doc.documentElement;
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
    function hasIO() { return 'IntersectionObserver' in window; }

    /* -----------------------------------------------------------------
       1. INTRO + READY
       ----------------------------------------------------------------- */
    function markReady() { root.classList.add('gt-ready'); }

    function runIntro() {
        var intro = $('.gt-intro');
        if (!intro || !root.classList.contains('gt-intro-pending')) { markReady(); return; }

        root.classList.add('gt-lock');
        var finished = false;

        function finish() {
            if (finished) return;
            finished = true;
            intro.classList.add('gt-intro-leave');
            setTimeout(markReady, 380);                       // hero text starts as the curtain lifts
            setTimeout(function () {
                root.classList.remove('gt-intro-pending', 'gt-lock');
                try { sessionStorage.setItem('gt-intro', '1'); } catch (e) {}
            }, 1150);
        }

        intro.addEventListener('click', finish);              // tap to skip
        setTimeout(finish, 3000);
    }

    /* -----------------------------------------------------------------
       2. HERO HEADLINE -> lines that slide up
       ----------------------------------------------------------------- */
    function splitHero() {
        var h1 = $('.hero .overlay h1');
        if (!h1 || reduce) return;

        var parts = h1.innerHTML.split(/<br\s*\/?>/i)
            .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
            .filter(Boolean);

        h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
        h1.innerHTML = parts.map(function (t, i) {
            return '<span class="gt-line"><span style="--gt-l:' + i + '" aria-hidden="true">' + t + '</span></span>';
        }).join('');

        $$('.hero .overlay > :not(h1)').forEach(function (el, i) {
            el.style.setProperty('--gt-i', i);
        });
    }

    /* -----------------------------------------------------------------
       3. SCROLL REVEAL
       ----------------------------------------------------------------- */
    var revealIO = null;

    // [selector, base delay in ms, images settle?]
    var REVEAL_GROUPS = [
        ['section:not(.hero) > .small-title', 0, false],
        ['section:not(.hero) > h2', 90, false],
        ['section > .contact-text', 150, false],
        ['section > .contact-btn', 220, false],
        ['.timeline > .item', 120, false],
        ['.story-images > .story-text-card', 120, false],
        ['.brand-container > .brand-card', 120, true],
        ['.stat-box', 0, false],
        ['.why-container > .why-card', 100, false],
        ['.why-grid > .why-box', 100, false],
        ['.showcase-grid > .showcase-card', 100, true],
        ['.gallery-container > .gallery-card', 100, true],
        ['.qr-container > a, .qr-container > .qr-card', 100, false],
        ['.video-grid > .video-card', 100, false],
        ['.form-wrapper', 150, false],
        ['[data-gt-reveal]', 0, false]
    ];

    function onReveal(entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            revealIO.unobserve(el);
            el.classList.add('gt-in');
            var delay = parseInt(el.style.getPropertyValue('--gt-d'), 10) || 0;
            // once the animation has played, hand the element back to its normal CSS
            setTimeout(function () {
                el.classList.remove('gt-reveal', 'gt-in', 'gt-settle');
                el.style.removeProperty('--gt-d');
            }, delay + 2000);
        });
    }

    function addReveal(el, delay, settle) {
        if (!el || el.classList.contains('gt-reveal') || !revealIO) return;
        el.classList.add('gt-reveal');
        if (settle) el.classList.add('gt-settle');
        el.style.setProperty('--gt-d', delay + 'ms');
        revealIO.observe(el);
    }

    function setupReveal() {
        if (reduce || !hasIO()) return;
        revealIO = new IntersectionObserver(onReveal, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

        REVEAL_GROUPS.forEach(function (g) {
            var perParent = new Map();
            $$(g[0]).forEach(function (el) {
                if (el.closest('.hero')) return;
                var p = el.parentElement;
                var idx = perParent.get(p) || 0;
                perParent.set(p, idx + 1);
                addReveal(el, g[1] + Math.min(idx, 4) * 130, g[2]);
            });
        });
    }

    /* used by shop.js for products that are drawn after the page loads */
    function revealNow(els, settle) {
        if (reduce || !revealIO) return;
        var perParent = new Map();
        (els || []).forEach(function (el) {
            var p = el.parentElement;
            var idx = perParent.get(p) || 0;
            perParent.set(p, idx + 1);
            addReveal(el, Math.min(idx, 6) * 90, !!settle);
        });
    }

    /* -----------------------------------------------------------------
       4. COUNTERS
       ----------------------------------------------------------------- */
    function setupCounters() {
        var counters = $$('.counter');
        if (!counters.length) return;

        function setFinal(el) { el.textContent = el.getAttribute('data-target'); }

        if (reduce || !hasIO()) { counters.forEach(setFinal); return; }

        function run(el) {
            var target = +el.getAttribute('data-target');
            var start = null;
            var duration = 1900;
            function step(ts) {
                if (start === null) start = ts;
                var p = Math.min((ts - start) / duration, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased);
                if (p < 1) requestAnimationFrame(step); else setFinal(el);
            }
            requestAnimationFrame(step);
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                io.unobserve(en.target);
                run(en.target);
            });
        }, { threshold: 0.6 });

        counters.forEach(function (el) { el.textContent = '0'; io.observe(el); });
    }

    /* -----------------------------------------------------------------
       5. SCROLL EFFECTS (header, progress bar, parallax)
       ----------------------------------------------------------------- */
    var header, progress, hero, parallax = [], ticking = false;

    var PARALLAX_GROUPS = [];   // cards no longer drift while scrolling (cleaner, more professional)

    function setupScrollFx() {
        header = $('.gt-hdr') || $('header');
        hero = $('.hero');

        progress = doc.createElement('div');
        progress.className = 'gt-progress';
        progress.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(progress);

        if (!reduce) {
            PARALLAX_GROUPS.forEach(function (g) {
                $$(g[0]).forEach(function (el, i) {
                    el.setAttribute('data-gt-px', '');
                    parallax.push({ el: el, speed: g[1][i % g[1].length], y: 0 });
                });
            });
        }

        window.addEventListener('scroll', requestTick, { passive: true });
        window.addEventListener('resize', requestTick);
        update();
    }

    function requestTick() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    function update() {
        ticking = false;
        var sy = window.pageYOffset || root.scrollTop || 0;
        var vh = window.innerHeight;

        if (header) header.classList.toggle('gt-scrolled', sy > 40);

        if (progress) {
            var max = Math.max(root.scrollHeight - vh, 1);
            progress.style.setProperty('--gt-p', Math.min(sy / max, 1).toFixed(4));
        }

        if (reduce) return;

        if (hero) {
            var hh = hero.offsetHeight || vh;
            if (sy < hh * 1.3) {
                hero.style.setProperty('--gt-hero-y', (sy * 0.28).toFixed(1) + 'px');
                var ov = $('.overlay', hero);
                if (ov) {
                    ov.style.setProperty('--gt-text-y', (sy * 0.12).toFixed(1) + 'px');
                    ov.style.setProperty('--gt-text-o', Math.max(0, Math.min(1, 1 - sy / (hh * 0.75))).toFixed(3));
                }
            }
        }

        var wide = window.innerWidth >= 760;
        parallax.forEach(function (p) {
            if (!wide) {
                if (p.y !== 0) { p.el.style.translate = ''; p.y = 0; }
                return;
            }
            var r = p.el.getBoundingClientRect();
            if (r.bottom < -200 || r.top > vh + 200) return;
            var naturalCenter = r.top - p.y + r.height / 2;
            var y = (naturalCenter - vh / 2) * p.speed;
            y = Math.max(-60, Math.min(60, y));
            if (Math.abs(y - p.y) > 0.2) {
                p.y = y;
                p.el.style.translate = '0 ' + y.toFixed(1) + 'px';
            }
        });
    }

    /* -----------------------------------------------------------------
       6. LIGHTBOX
       ----------------------------------------------------------------- */
    var lb, lbImg, lbList = [], lbIndex = 0, lbLastFocus = null;

    function buildLightbox() {
        lb = $('#lightbox');
        if (!lb) {
            lb = doc.createElement('div');
            lb.id = 'lightbox';
            lb.innerHTML = '<img id="lightbox-img" alt="Preview">';
            doc.body.appendChild(lb);
        }
        lbImg = $('#lightbox-img', lb);
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.setAttribute('aria-label', 'Image preview');

        function btn(cls, label, text, handler) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.className = 'gt-lb-btn ' + cls;
            b.setAttribute('aria-label', label);
            b.innerHTML = text;
            b.addEventListener('click', function (e) { e.stopPropagation(); handler(); });
            lb.appendChild(b);
            return b;
        }
        btn('gt-lb-close', 'Close', '&times;', closeLightbox);
        btn('gt-lb-prev', 'Previous photo', '&#8249;', function () { stepLightbox(-1); });
        btn('gt-lb-next', 'Next photo', '&#8250;', function () { stepLightbox(1); });
        lb.addEventListener('click', closeLightbox);
    }

    function showLightbox(i) {
        lbIndex = (i + lbList.length) % lbList.length;
        var src = lbList[lbIndex];
        lbImg.src = src.currentSrc || src.src;
        lbImg.alt = src.alt || 'Preview';
    }

    function openLightbox(i) {
        if (!lb) buildLightbox();
        lbLastFocus = doc.activeElement;
        showLightbox(i);
        lb.style.display = 'flex';
        void lb.offsetWidth;                       // let the browser register display:flex first
        lb.classList.add('gt-open');
        var close = $('.gt-lb-close', lb);
        if (close) close.focus();
        var multi = lbList.length > 1;
        $$('.gt-lb-prev, .gt-lb-next', lb).forEach(function (b) { b.style.display = multi ? '' : 'none'; });
    }

    function stepLightbox(d) { showLightbox(lbIndex + d); }

    function closeLightbox() {
        if (!lb || !lb.classList.contains('gt-open')) return;
        lb.classList.remove('gt-open');
        setTimeout(function () { if (!lb.classList.contains('gt-open')) lb.style.display = 'none'; }, 420);
        if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
    }

    window.closeLightbox = closeLightbox;          // index.html calls this from an onclick
    window.openLightbox = function (i) { if (lbList.length) openLightbox(i || 0); };

    function setupLightbox() {
        lbList = $$('.gallery-container img');
        if (!lbList.length) return;
        buildLightbox();
        lbList.forEach(function (img, i) {
            var target = img.closest('.gallery-card') || img;
            target.addEventListener('click', function () { openLightbox(i); });
        });
        doc.addEventListener('keydown', function (e) {
            if (!lb || !lb.classList.contains('gt-open')) return;
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowRight') stepLightbox(1);
            else if (e.key === 'ArrowLeft') stepLightbox(-1);
        });
    }

    /* -----------------------------------------------------------------
       7. PAGE-CHANGE FADE
       ----------------------------------------------------------------- */
    function setupPageFade() {
        if (reduce) return;
        doc.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a[href]') : null;
            if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (a.target && a.target !== '_self') return;
            if (a.hasAttribute('download')) return;
            var u;
            try { u = new URL(a.href, location.href); } catch (err) { return; }
            if (!/^(https?|file):$/.test(u.protocol) || u.origin !== location.origin) return;
            if (u.pathname === location.pathname && u.search === location.search) return;   // same-page link
            e.preventDefault();
            root.classList.add('gt-leaving');
            setTimeout(function () { location.href = a.href; }, 260);
        });
        window.addEventListener('pageshow', function () { root.classList.remove('gt-leaving'); });
    }

    /* -----------------------------------------------------------------
       START
       ----------------------------------------------------------------- */
    function init() {
        splitHero();
        setupReveal();
        setupCounters();
        setupScrollFx();
        setupLightbox();
        setupPageFade();
        runIntro();
    }

    window.GT = window.GT || {};
    window.GT.reveal = revealNow;

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})();
