/* =====================================================================
   GRAPE TREE - LANGUAGE SYSTEM
   English is written in the pages. Other languages live in lang/XX.js
   as "English text -> translated text". Languages: English, Arabic, Turkish, Chinese, Russian, Japanese. To add one:
     1. copy lang/tr.js to lang/xx.js and translate the right-hand side
     2. add its code to LANGS below
   Missing phrases simply stay in English.
   ===================================================================== */
(function () {
    'use strict';
    var LANGS = [
        { code: 'en', name: 'English', short: 'EN', dir: 'ltr' },
        { code: 'ar', name: 'العربية', short: 'AR', dir: 'rtl' },
        { code: 'tr', name: 'Türkçe', short: 'TR', dir: 'ltr' },
        { code: 'zh', name: '中文', short: 'ZH', dir: 'ltr' },
        { code: 'ru', name: 'Русский', short: 'RU', dir: 'ltr' },
        { code: 'ja', name: '日本語', short: 'JA', dir: 'ltr' }
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
        doc.write('<script src="lang/' + current + '.js?v=14"><\/script>');
    }
    if (current !== 'en') {
        var f = doc.createElement('link');
        f.rel = 'stylesheet';
        f.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@500;600;700&display=swap';
        if (current === 'ar') doc.head.appendChild(f);
    }
    /* fonts + spacing for the extra languages (system fonts, nothing to download) */
    (function () {
        var st = doc.createElement('style');
        st.textContent =
            'html:not(.gt-edit-on) [data-gt-hide]{display:none !important}' +
            'html[lang="zh"]{--sans:"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;--serif:"Songti SC","Noto Serif SC","SimSun",serif;--serif-2:"Songti SC","Noto Serif SC","SimSun",serif}' +
            'html[lang="ja"]{--sans:"Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif;--serif:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;--serif-2:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif}' +
            'html[lang="ru"]{--serif:"Playfair Display","Times New Roman",Georgia,serif;--serif-2:"Playfair Display","Times New Roman",Georgia,serif}' +
            'html[lang="zh"] *,html[lang="ja"] *{letter-spacing:0 !important;text-transform:none !important}' +
            'html[lang="zh"] body,html[lang="ja"] body{line-break:strict;word-break:normal;overflow-wrap:anywhere}' +
            'html[lang="ru"] body,html[lang="tr"] body{overflow-wrap:break-word}html[lang] h1,html[lang] h2,html[lang] h3{text-wrap:balance}.lang-btn{white-space:nowrap}' +
            'html[lang="ru"] .gt-hdr .gt-nav>a,html[lang="ru"] .gt-hdr .gt-brands-link,html[lang="tr"] .gt-hdr .gt-nav>a,html[lang="tr"] .gt-hdr .gt-brands-link{letter-spacing:.04em}';
        doc.head.appendChild(st);
    })();

    /* ------------------------------ engine ------------------------------ */
    var dict = null, lower = null, patterns = [];
    /* texts and fonts the owner changed in the admin page (saved in the database, cached in the browser) */
    var OV = {}, STY = {}, HIDE = '\u0001hide';
    function cachedContent() { try { return JSON.parse(localStorage.getItem('gt-content-v1') || '{}') || {}; } catch (e) { return {}; } }
    function loadOv(c) { OV = (c && c.texts && typeof c.texts === 'object') ? c.texts : {}; STY = (c && c.styles && typeof c.styles === 'object') ? c.styles : {}; }
    loadOv(cachedContent());
    var FONT_CSS = {
        'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600', 'Playfair Display': 'Playfair+Display:wght@400;500;600', 'Lora': 'Lora:wght@400;500;600',
        'Cinzel': 'Cinzel:wght@400;500;600', 'Libre Baskerville': 'Libre+Baskerville:wght@400;700', 'DM Serif Display': 'DM+Serif+Display', 'Marcellus': 'Marcellus',
        'Bodoni Moda': 'Bodoni+Moda:wght@400;500;600', 'EB Garamond': 'EB+Garamond:wght@400;500;600', 'Cormorant': 'Cormorant:wght@400;500;600',
        'Inter': 'Inter:wght@300;400;500;600;700', 'Poppins': 'Poppins:wght@300;400;500;600', 'Montserrat': 'Montserrat:wght@300;400;500;600', 'Lato': 'Lato:wght@300;400;700',
        'Nunito Sans': 'Nunito+Sans:wght@300;400;600;700', 'Open Sans': 'Open+Sans:wght@300;400;600;700', 'DM Sans': 'DM+Sans:wght@300;400;500;700', 'Raleway': 'Raleway:wght@300;400;500;600'
    };
    function applyFonts(c) {
        var f = (c && c.fonts && typeof c.fonts === 'object') ? c.fonts : {};
        var h = FONT_CSS[f.heading] ? f.heading : '', b = FONT_CSS[f.body] ? f.body : '';
        var used = [h, b];
        Object.keys(STY).forEach(function (k) { if (STY[k] && FONT_CSS[STY[k].font]) used.push(STY[k].font); });
        var fam = used.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).map(function (x) { return 'family=' + FONT_CSS[x]; }).join('&');
        var lk = doc.getElementById('gt-fonts-link'), st = doc.getElementById('gt-fonts-css');
        if (!fam) { if (lk) lk.removeAttribute('href'); if (st) st.textContent = ''; return; }
        if (!lk) { lk = doc.createElement('link'); lk.id = 'gt-fonts-link'; lk.rel = 'stylesheet'; doc.head.appendChild(lk); }
        lk.href = 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
        if (!st) { st = doc.createElement('style'); st.id = 'gt-fonts-css'; doc.head.appendChild(st); }
        st.textContent = 'html:root:not([lang="ar"]):not([lang="zh"]):not([lang="ja"]){' + (h ? '--serif:"' + h + '",Georgia,serif;--serif-2:"' + h + '",Georgia,serif;' : '') + (b ? '--sans:"' + b + '",system-ui,sans-serif;' : '') + '}';
    }
    applyFonts(cachedContent());
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
        var lead = (en.match(/^\s*/) || [''])[0], trail = (en.match(/\s*$/) || [''])[0];
        var key = norm(en);
        if (!key) return en;
        var ov = OV[key];
        if (ov && typeof ov[current] === 'string' && ov[current] !== '') return lead + ov[current] + trail;
        if (!dict) return en;
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
        var t = translate(o), key = norm(o), ov = OV[key];
        var isHid = !!(ov && ov['*'] === HIDE), editing = root.classList.contains('gt-edit-on');
        var sole = isHid && onlyText(n);
        if (isHid && !sole && !editing) t = '';
        n.__gtOut = t;
        if (n.nodeValue !== t) n.nodeValue = t;
        setHide(n, sole);
        applySty(n, (isHid && !editing) ? null : STY[key]);
    }
    /* hide = remove the whole element when the text is all it holds, otherwise just empty the text */
    function onlyText(n) {
        var p = n.parentNode; if (!p || /^(BODY|HTML|MAIN|SECTION|ARTICLE)$/.test(p.nodeName)) return false;
        for (var c = p.firstChild; c; c = c.nextSibling) if (c !== n && !(c.nodeType === 8 || (c.nodeType === 3 && !c.nodeValue.trim()))) return false;
        return true;
    }
    function setHide(n, on) {
        if (on) { var p = n.parentNode; if (p && p.setAttribute) { p.setAttribute('data-gt-hide', ''); n.__gtHideEl = p; } }
        else if (n.__gtHideEl) { n.__gtHideEl.removeAttribute('data-gt-hide'); n.__gtHideEl = null; }
    }
    /* font / size chosen for one text: the text is wrapped in a small span that carries the style */
    function applySty(n, s) {
        var p = n.parentNode; if (!p || !p.classList) return;
        var own = p.classList.contains('gt-sty');
        if (!s || (!s.font && !(s.size && +s.size !== 100))) { if (own) { p.style.fontFamily = ''; p.style.fontSize = ''; } return; }
        if (!own) {
            if (/^(OPTION|TITLE|TEXTAREA|SCRIPT|STYLE|SELECT|BUTTON)$/.test(p.nodeName) && p.nodeName !== 'BUTTON') return;
            var w = doc.createElement('span'); w.className = 'gt-sty'; p.insertBefore(w, n); w.appendChild(n); p = w;
        }
        p.style.fontFamily = FONT_CSS[s.font] ? '"' + s.font + '",serif' : '';
        p.style.fontSize = (s.size && +s.size !== 100) ? (+s.size) + '%' : '';
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
            var t = translate(o);
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
        if (t) { if (!t.__gtEn) t.__gtEn = t.textContent; t.textContent = translate(t.__gtEn); }
        var m = doc.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]');
        for (var i = 0; i < m.length; i++) {
            var el = m[i]; if (!el.__gtEn) el.__gtEn = el.getAttribute('content');
            el.setAttribute('content', translate(el.__gtEn));
        }
    }

    function run(node) {
        busy = true;
        try { walk(node || doc.body); } finally { busy = false; }
    }

    function watch() {
        if (observer || !window.MutationObserver) return;
        observer = new MutationObserver(function (list) {
            if (busy) return;
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
            var s = doc.createElement('script'); s.src = 'lang/' + code + '.js?v=14'; s.onload = go; doc.head.appendChild(s);
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

    /* when the saved website content arrives (or changes), apply the owner's texts and fonts */
    doc.addEventListener('gt:content', function (e) {
        var c = e.detail || {};
        if (!Object.keys(c).length) return;      /* nothing arrived (offline): keep what we already show */
        var before = JSON.stringify([OV, STY]); loadOv(c); applyFonts(c);
        if (JSON.stringify([OV, STY]) !== before) apply();
    });
    /* edit mode: ?edit=1 lets a signed-in admin click any text on the page and change it */
    if (/[?&]edit=1/.test(location.search)) {
        var te = doc.createElement('script'); te.src = 'textedit.js?v=14'; te.defer = true; doc.head.appendChild(te);
    }

    window.GT = window.GT || {};
    window.GT.lang = {
        get: function () { return current; }, set: setLang, list: LANGS,
        t: function (s) { return translate(s); },
        key: function (node) { return norm(node.__gtEn != null ? node.__gtEn : node.nodeValue); },
        original: function (node) { return node.__gtEn != null ? node.__gtEn : node.nodeValue; },
        reload: function (c) { c = c || cachedContent(); loadOv(c); applyFonts(c); apply(); },
        previewFonts: function (f) { applyFonts({ fonts: f || {} }); },
        previewSty: function (n, s, text) {
            if (s && FONT_CSS[s.font]) {
                var lk = doc.getElementById('gt-fonts-prev');
                if (!lk) { lk = doc.createElement('link'); lk.id = 'gt-fonts-prev'; lk.rel = 'stylesheet'; doc.head.appendChild(lk); }
                lk.href = 'https://fonts.googleapis.com/css2?family=' + FONT_CSS[s.font] + '&display=swap';
            }
            if (typeof text === 'string') { n.nodeValue = text; n.__gtOut = text; }
            applySty(n, s);
        },
        fontNames: function () { return Object.keys(FONT_CSS); },
        HIDE: HIDE,
        sty: function (key) { return STY[key] || null; },
        ov: function (key) { return OV[key] || null; }
    };
})();
