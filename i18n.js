/* =====================================================================
   GRAPE TREE - LANGUAGE SYSTEM
   English is written in the pages. Other languages live in lang/XX.js
   as "English text -> translated text". To add a language:
     1. copy lang/ar.js to lang/xx.js and translate the right-hand side
     2. add its code to LANGS below
   Missing phrases simply stay in English.
   ===================================================================== */
(function () {
    'use strict';
    var LANGS = [
        { code: 'en', name: 'English', short: 'EN', dir: 'ltr' },
        { code: 'ar', name: 'العربية', short: 'AR', dir: 'rtl' }
        /* later: { code:'hi', name:'हिन्दी', short:'HI', dir:'ltr' }, { code:'ru', ... }, { code:'ur', ..., dir:'rtl' }, { code:'zh', ... } */
    ];
    var KEY = 'gt-lang';
    var doc = document, root = doc.documentElement;

    function find(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i]; return null; }
    function store(v) { try { if (v) localStorage.setItem(KEY, v); else return localStorage.getItem(KEY); } catch (e) {} return null; }

    var fromUrl = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
    var current = find(fromUrl) ? fromUrl : (find(store()) ? store() : 'en');
    if (fromUrl && find(fromUrl)) store(fromUrl);

    function setRoot(code) {
        var l = find(code);
        root.setAttribute('lang', code);
        root.setAttribute('dir', l.dir);
    }
    setRoot(current);

    /* load the dictionary now (synchronously, before the page is built) */
    window.GT_I18N = window.GT_I18N || {};
    if (current !== 'en' && !window.GT_I18N[current]) {
        doc.write('<script src="lang/' + current + '.js"><\/script>');
    }
    if (current !== 'en') {
        var f = doc.createElement('link');
        f.rel = 'stylesheet';
        f.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@500;600;700&display=swap';
        if (current === 'ar') doc.head.appendChild(f);
    }

    /* ------------------------------ engine ------------------------------ */
    var dict = null, lower = null, patterns = [];
    var ATTRS = ['alt', 'placeholder', 'aria-label', 'title'];
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };
    var observer = null, busy = false;

    function norm(s) { return s.replace(/\s+/g, ' ').trim().replace(/[’‘]/g, "'"); }

    function prepare() {
        var d = window.GT_I18N[current];
        dict = {}; lower = {}; patterns = [];
        if (!d) return;
        var s = d.strings || {};
        for (var k in s) { var nk = norm(k); dict[nk] = s[k]; lower[nk.toLowerCase()] = s[k]; }
        patterns = d.patterns || [];
    }

    function translate(en) {
        if (!dict) return en;
        var lead = (en.match(/^\s*/) || [''])[0], trail = (en.match(/\s*$/) || [''])[0];
        var key = norm(en);
        if (!key) return en;
        var hit = dict[key];
        if (hit === undefined) hit = lower[key.toLowerCase()];
        if (hit === undefined) {
            for (var i = 0; i < patterns.length; i++) {
                if (patterns[i][0].test(key)) { hit = key.replace(patterns[i][0], patterns[i][1]); break; }
            }
        }
        return hit === undefined ? en : lead + hit + trail;
    }

    function doText(n) {
        var v = n.nodeValue;
        if (n.__gtOut !== undefined && v === n.__gtOut) { var o = n.__gtEn; } /* untouched since we set it */
        else { n.__gtEn = v; o = v; }
        if (!/[A-Za-z]/.test(o)) { n.__gtOut = o; return; }
        var t = current === 'en' ? o : translate(o);
        n.__gtOut = t;
        if (n.nodeValue !== t) n.nodeValue = t;
    }

    function doAttrs(el) {
        for (var i = 0; i < ATTRS.length; i++) {
            var a = ATTRS[i];
            if (!el.hasAttribute || !el.hasAttribute(a)) continue;
            el.__gtA = el.__gtA || {};
            var v = el.getAttribute(a), rec = el.__gtA[a];
            var o;
            if (rec && rec.out === v) o = rec.en; else o = v;
            if (!/[A-Za-z]/.test(o)) continue;
            var t = current === 'en' ? o : translate(o);
            el.__gtA[a] = { en: o, out: t };
            if (v !== t) el.setAttribute(a, t);
        }
    }

    function walk(node) {
        if (node.nodeType === 3) { if (!SKIP[node.parentNode && node.parentNode.nodeName]) doText(node); return; }
        if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
        if (node.hasAttribute && node.hasAttribute('data-no-i18n')) return;
        doAttrs(node);
        for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
    }

    function doHead() {
        var t = doc.querySelector('title');
        if (t) { if (!t.__gtEn) t.__gtEn = t.textContent; t.textContent = current === 'en' ? t.__gtEn : translate(t.__gtEn); }
        var m = doc.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]');
        for (var i = 0; i < m.length; i++) {
            var el = m[i]; if (!el.__gtEn) el.__gtEn = el.getAttribute('content');
            el.setAttribute('content', current === 'en' ? el.__gtEn : translate(el.__gtEn));
        }
    }

    function run(node) {
        busy = true;
        try { walk(node || doc.body); } finally { busy = false; }
    }

    function watch() {
        if (observer || !window.MutationObserver) return;
        observer = new MutationObserver(function (list) {
            if (busy || current === 'en') return;
            observer.disconnect();
            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) run(m.addedNodes[j]);
                else if (m.type === 'characterData') { if (m.target.__gtOut !== m.target.nodeValue) doText(m.target); }
                else if (m.type === 'attributes') doAttrs(m.target);
            }
            observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
        });
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }

    function apply() {
        prepare(); setRoot(current); doHead(); run(doc.body);
        var b = doc.querySelector('.lang-btn .lang-cur'); if (b) b.textContent = find(current).short;
        var items = doc.querySelectorAll('.lang-menu button');
        for (var i = 0; i < items.length; i++) items[i].setAttribute('aria-current', items[i].getAttribute('data-lang') === current ? 'true' : 'false');
        doc.dispatchEvent(new CustomEvent('gt:lang', { detail: { lang: current } }));
    }

    function setLang(code) {
        if (!find(code) || code === current) return;
        var go = function () { current = code; store(code); apply(); };
        if (code !== 'en' && !window.GT_I18N[code]) {
            var s = doc.createElement('script'); s.src = 'lang/' + code + '.js'; s.onload = go; doc.head.appendChild(s);
        } else go();
    }

    /* ------------------------------ switcher ------------------------------ */
    function buildSwitcher() {
        var header = doc.querySelector('.gt-hdr') || doc.querySelector('header'); if (!header) return;
        var wrap = doc.createElement('div'); wrap.className = 'lang-switch'; wrap.setAttribute('data-no-i18n', '');
        var btn = doc.createElement('button');
        btn.type = 'button'; btn.className = 'lang-btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Language');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9s1.3-6.3 3.9-9z"/></svg><span class="lang-cur">' + find(current).short + '</span>';
        var menu = doc.createElement('div'); menu.className = 'lang-menu'; menu.setAttribute('role', 'menu');
        LANGS.forEach(function (l) {
            var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.setAttribute('data-lang', l.code);
            b.setAttribute('lang', l.code); b.textContent = l.name; menu.appendChild(b);
            b.addEventListener('click', function () { setLang(l.code); close(); });
        });
        wrap.appendChild(btn); wrap.appendChild(menu);
        var cart = header.querySelector('.cart-btn');
        header.insertBefore(wrap, cart || null);
        function close() { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
        btn.addEventListener('click', function (e) { e.stopPropagation(); var o = wrap.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
        doc.addEventListener('click', close);
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    function init() {
        buildSwitcher();
        apply();
        watch();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();

    window.GT = window.GT || {};
    window.GT.lang = { get: function () { return current; }, set: setLang, list: LANGS, t: function (s) { return current === 'en' ? s : translate(s); } };
})();
