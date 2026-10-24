/* Home page: two-brand hero slider (autoplay, swipe, arrows, tabs). */
(function () {
    'use strict';
    var root = document.querySelector('[data-duo]');
    if (!root) return;
    var slides = [].slice.call(root.querySelectorAll('.duo-slide'));
    var tabs = [].slice.call(root.querySelectorAll('.duo-tabs button'));
    var DELAY = 7000, cur = 0, timer = null, paused = false;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isRtl = function () { return document.documentElement.dir === 'rtl'; };

    function show(i) {
        cur = (i + slides.length) % slides.length;
        slides.forEach(function (s, n) {
            var on = n === cur;
            s.classList.toggle('is-active', on);
            s.setAttribute('aria-hidden', on ? 'false' : 'true');
            [].forEach.call(s.querySelectorAll('.duo-content a'), function (a) { a.tabIndex = on ? 0 : -1; });
        });
        tabs.forEach(function (t, n) {
            t.classList.toggle('is-active', n === cur);
            t.setAttribute('aria-selected', n === cur ? 'true' : 'false');
        });
        root.setAttribute('data-theme', cur === 2 ? 'gild' : 'light');
        restart();
    }
    function restart() {
        clearTimeout(timer);
        root.classList.remove('is-timing');
        if (reduce || paused) return;
        void root.offsetWidth;                       /* restart the tab progress bar */
        root.classList.add('is-timing');
        timer = setTimeout(function () { show(cur + 1); }, DELAY);
    }
    function pause(v) { paused = v; if (v) { clearTimeout(timer); root.classList.remove('is-timing'); } else restart(); }

    root.querySelector('.duo-prev').onclick = function () { show(cur - 1); };
    root.querySelector('.duo-next').onclick = function () { show(cur + 1); };
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(+t.getAttribute('data-go')); }); });

    root.addEventListener('mouseenter', function () { pause(true); });
    root.addEventListener('mouseleave', function () { pause(false); });
    root.addEventListener('focusin', function () { pause(true); });
    root.addEventListener('focusout', function () { pause(false); });
    document.addEventListener('visibilitychange', function () { pause(document.hidden); });
    root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') show(cur + (isRtl() ? -1 : 1));
        if (e.key === 'ArrowLeft') show(cur + (isRtl() ? 1 : -1));
    });

    /* swipe */
    var x0 = null, y0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; pause(true); }, { passive: true });
    root.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null; pause(false);
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(cur + ((dx < 0) !== isRtl() ? 1 : -1));
    }, { passive: true });

    show(0);
})();
