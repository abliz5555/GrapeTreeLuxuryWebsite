/* =====================================================================
   GRAPE TREE - CLICK-TO-EDIT PAGE (for the owner)
   Opens when a page address ends with ?edit=1 and an admin is signed in.
   Tap or click any text: change the words, the font, the size, or delete it.
   "Fonts" in the bar changes the heading and normal-text font of the whole site.
   Everything is saved per language (switch the language button to edit another language).
   ===================================================================== */
(function () {
    'use strict';
    var doc = document, B = null;
    function $(s, r) { return (r || doc).querySelector(s); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function G() { return window.GT.lang; }
    var LANGNAME = { en: 'English', ar: 'Arabic', tr: 'Turkish', zh: 'Chinese', ru: 'Russian', ja: 'Japanese' };
    var HEAD_FONTS = ['Cormorant Garamond', 'Playfair Display', 'Lora', 'Cinzel', 'Libre Baskerville', 'DM Serif Display', 'Marcellus', 'Bodoni Moda', 'EB Garamond', 'Cormorant'];
    var BODY_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Lato', 'Nunito Sans', 'Open Sans', 'DM Sans', 'Raleway'];
    var SIZES = [[70, 'Much smaller'], [85, 'Smaller'], [100, 'Normal'], [125, 'Larger'], [150, 'Big'], [200, 'Huge']];

    var css = doc.createElement('style');
    css.textContent =
        '.gt-edit-ui,.gt-edit-ui *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif !important;letter-spacing:0 !important;text-transform:none !important;font-size-adjust:none}' +
        'html.gt-edit-on body *{pointer-events:auto !important}html.gt-edit-on .gt-mega,html.gt-edit-on .gt-ftr-map iframe{pointer-events:none !important}' +
        'html.gt-edit-on body{padding-bottom:84px}' +
        '#gt-edit-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:100000;background:#2A1810;color:#F7F2E7;border-radius:22px;padding:8px 8px 8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;box-shadow:0 10px 34px rgba(0,0,0,.4);width:max-content;max-width:calc(100vw - 16px);font-size:14px;line-height:1.3}' +
        '#gt-edit-bar b{color:#E3C77A}#gt-edit-bar .msg{flex:1 1 auto;min-width:140px}' +
        '#gt-edit-bar button,#gt-edit-bar a{background:#F7F2E7;color:#2A1810;border:0;border-radius:999px;padding:0 18px;min-height:44px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center}' +
        '#gt-edit-bar .fin{background:#B8932F;color:#fff}' +
        '.gt-edit-hover{outline:2px dashed #B8932F !important;outline-offset:3px;cursor:pointer !important;background:rgba(184,147,47,.12)}' +
        'html.gt-edit-on [data-gt-hide]{opacity:.35;outline:2px dashed #a3261c;outline-offset:2px}' +
        '#gt-edit-modal{position:fixed;inset:0;z-index:100001;background:rgba(20,10,5,.55);display:flex;align-items:center;justify-content:center;padding:14px}' +
        '#gt-edit-modal .box{background:#FFFDF8;color:#2A1810;border-radius:18px;padding:20px;width:100%;max-width:580px;max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);-webkit-overflow-scrolling:touch}' +
        '#gt-edit-modal h3{margin:0 0 6px;font-size:19px;font-weight:700;color:#2A1810}#gt-edit-modal p{margin:6px 0;font-size:14px;color:#6b5a4e;line-height:1.5}' +
        '#gt-edit-modal .orig{background:#F3EBDD;border-radius:10px;padding:9px 12px;font-size:13px;color:#4A3A30;margin:6px 0 12px;word-break:break-word}' +
        '#gt-edit-modal label{display:block;font-size:13px;font-weight:600;color:#4A3A30;margin:12px 0 4px}' +
        '#gt-edit-modal textarea,#gt-edit-modal select{width:100%;border:1px solid #cdbfa8;border-radius:12px;padding:12px;font-size:16px;line-height:1.45;color:#2A1810;background:#fff;min-height:46px}' +
        '#gt-edit-modal textarea{min-height:100px;resize:vertical}' +
        '#gt-edit-modal .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '#gt-edit-modal .prev{border:1px solid #e5ded0;border-radius:12px;padding:12px 14px;margin:12px 0 0;background:#fff;line-height:1.35}' +
        '#gt-edit-modal .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}' +
        '#gt-edit-modal .row button{border:0;border-radius:999px;padding:0 20px;min-height:48px;font-size:16px;font-weight:600;cursor:pointer;flex:1 1 auto}' +
        '#gt-edit-modal .go{background:#2A1810;color:#F7F2E7}#gt-edit-modal .no{background:#EDE4D3;color:#2A1810}#gt-edit-modal .rs{background:#fff;color:#a3261c;border:1px solid #a3261c !important}' +
        '#gt-edit-modal .err{color:#a3261c;font-size:13px;min-height:16px}#gt-edit-modal .warn{background:#FBEAE8;color:#7a1d15;border-radius:10px;padding:8px 12px;font-size:13px}' +
        '@media (max-width:640px){#gt-edit-modal{align-items:flex-end;padding:0}#gt-edit-modal .box{border-radius:20px 20px 0 0;max-height:88vh;padding:18px 16px 22px}#gt-edit-modal .two{grid-template-columns:1fr}#gt-edit-bar{left:8px;right:8px;transform:none;width:auto;border-radius:20px;bottom:8px}#gt-edit-bar .msg{flex-basis:100%}#gt-edit-bar button,#gt-edit-bar a{flex:1 1 auto;justify-content:center}}';
    doc.head.appendChild(css);

    var bar = doc.createElement('div'); bar.id = 'gt-edit-bar'; bar.className = 'gt-edit-ui'; bar.setAttribute('data-no-i18n', '');
    bar.innerHTML = '<span class="msg">Checking your sign-in...</span>';
    doc.body.appendChild(bar);
    var barHome = '';
    function setBar(html) { bar.innerHTML = html; var x = $('[data-exit]', bar); if (x) x.addEventListener('click', exit); var f = $('[data-fonts]', bar); if (f) f.addEventListener('click', openFonts); }
    function say(html) { var s = $('.msg', bar); if (!s) return; s.innerHTML = html; setTimeout(function () { if (s) s.innerHTML = barHome; }, 2400); }
    function exit() { location.href = location.pathname + location.search.replace(/([?&])edit=1&?/, '$1').replace(/[?&]$/, '') + location.hash; }

    var active = false, hoverEl = null;

    function ready(fn) {
        var tries = 0;
        (function wait() {
            B = window.GT && window.GT.backend;
            if (B && B.ready) return B.ready.then(function (on) { fn(on); });
            if (++tries > 60) return fn(false);
            setTimeout(wait, 150);
        })();
    }
    ready(function (on) {
        if (!on) return setBar('<span class="msg">The editor needs the online connection, which is not available now.</span><button data-exit>Close</button>');
        var tries = 0;
        (function chk() {
            if (B.isAdmin && B.isAdmin()) return start();
            if (++tries < 25 && !(B.session && B.profile)) return setTimeout(chk, 200);
            setBar('<span class="msg">Please sign in as admin first, then open this page again.</span><a href="admin.html">Admin page</a><button data-exit>Close</button>');
        })();
    });

    function start() {
        active = true; doc.documentElement.classList.add('gt-edit-on');
        barHome = '<b>Edit mode.</b> Tap or click any text.';
        setBar('<span class="msg">' + barHome + '</span><button data-fonts>Fonts</button><button class="fin" data-exit>Finish</button>');
        G().reload();                       /* show hidden texts (faded) so they can be brought back */
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('click', onClick, true);
        doc.addEventListener('submit', function (e) { if (!inUi(e.target)) e.preventDefault(); }, true);
    }
    function inUi(el) { return el && el.closest && (el.closest('.gt-edit-ui') || el.closest('.lang-switch') || el.closest('.menu-toggle')); }

    function okNode(t) { return t && t.nodeType === 3 && /[A-Za-zÀ-ɏЀ-ӿ؀-ۿ぀-ヿ一-鿿]/.test(t.nodeValue) && !/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(t.parentNode.nodeName) && !t.parentNode.closest('[data-no-i18n]'); }
    function textAt(x, y, target) {
        var n = null;
        if (doc.caretRangeFromPoint) { var r = doc.caretRangeFromPoint(x, y); if (r && r.startContainer.nodeType === 3) n = r.startContainer; }
        else if (doc.caretPositionFromPoint) { var p = doc.caretPositionFromPoint(x, y); if (p && p.offsetNode.nodeType === 3) n = p.offsetNode; }
        if (okNode(n)) {
            var rg = doc.createRange(); rg.selectNodeContents(n);
            var bs = rg.getClientRects();
            for (var i = 0; i < bs.length; i++) if (x >= bs[i].left - 6 && x <= bs[i].right + 6 && y >= bs[i].top - 6 && y <= bs[i].bottom + 6) return n;
        }
        /* fallback: first text inside the element that was tapped (or the span that wraps it) */
        var t = target; if (!t) return null;
        for (var c = t.firstChild; c; c = c.nextSibling) if (okNode(c)) return c;
        for (var d = t.firstChild; d; d = d.nextSibling) if (d.nodeType === 1 && d.firstChild && okNode(d.firstChild)) return d.firstChild;
        return null;
    }
    function onMove(e) {
        if (!active || inUi(e.target)) return unhover();
        var n = textAt(e.clientX, e.clientY, e.target), el = n ? n.parentNode : null;
        if (el === hoverEl) return;
        unhover(); if (el) { hoverEl = el; el.classList.add('gt-edit-hover'); }
    }
    function unhover() { if (hoverEl) { hoverEl.classList.remove('gt-edit-hover'); hoverEl = null; } }
    function onClick(e) {
        if (!active || inUi(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        var n = textAt(e.clientX, e.clientY, e.target);
        if (n) openText(n); else say('Tap directly on a word to change it.');
    }

    function lang() { return G().get() || 'en'; }
    function sheet(inner) {
        close();
        var m = doc.createElement('div'); m.id = 'gt-edit-modal'; m.className = 'gt-edit-ui'; m.setAttribute('data-no-i18n', '');
        m.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + inner + '</div>';
        doc.body.appendChild(m);
        m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
        return m;
    }
    function close() { var m = $('#gt-edit-modal'); if (m) m.remove(); }
    function opts(list, cur, first) { return (first ? '<option value="">' + first + '</option>' : '') + list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }

    /* ---- one stored change: read fresh data, change it, save, refresh the page ---- */
    function commit(mutate, done, fail) {
        B.content().then(function (c) {
            c = c || {};
            var texts = JSON.parse(JSON.stringify(c.texts || {})), styles = JSON.parse(JSON.stringify(c.styles || {})), fonts = c.fonts;
            var r = mutate({ texts: texts, styles: styles, fonts: fonts }) || {};
            var jobs = [];
            if (r.texts !== false) jobs.push(B.saveContent('texts', texts).then(function () { c.texts = texts; }));
            if (r.styles !== false) jobs.push(B.saveContent('styles', styles).then(function () { c.styles = styles; }));
            if (r.fonts !== undefined) jobs.push(B.saveContent('fonts', r.fonts).then(function () { c.fonts = r.fonts; }));
            return Promise.all(jobs).then(function () { try { localStorage.setItem('gt-content-v1', JSON.stringify(c)); } catch (e) {} return c; });
        }).then(function (c) { G().reload(c); done && done(); }).catch(function (e) { fail && fail((e && e.message) || 'please try again'); });
    }

    /* ---- text window ---- */
    function openText(n) {
        unhover();
        var L = lang(), key = G().key(n), orig = G().original(n).replace(/\s+/g, ' ').trim();
        var ov = G().ov(key) || {}, hidden = ov['*'] === G().HIDE, st = G().sty(key) || {};
        var edited = !!(ov[L] && ov[L] !== G().HIDE) || !!(st.font || (st.size && +st.size !== 100)) || hidden;
        var now = (hidden && ov[L] === undefined ? n.nodeValue : n.nodeValue).replace(/\s+/g, ' ').trim();
        var m = sheet('<h3>Change this text</h3><p>Language: <b>' + esc(LANGNAME[L] || L) + '</b>. To change another language, close this and switch the language button on the page.</p>' +
            (hidden ? '<p class="warn">This text is hidden from visitors (shown faded here).</p>' : '') +
            (L !== 'en' ? '<p>English original:</p><div class="orig">' + esc(orig) + '</div>' : '') +
            '<label for="gt-edit-ta">Words</label><textarea id="gt-edit-ta" dir="auto"></textarea>' +
            '<div class="two"><div><label for="gt-edit-font">Font for this text</label><select id="gt-edit-font">' + opts(HEAD_FONTS.concat(BODY_FONTS), st.font, 'Same as the website') + '</select></div>' +
            '<div><label for="gt-edit-size">Size</label><select id="gt-edit-size">' + SIZES.map(function (z) { return '<option value="' + z[0] + '"' + ((+st.size || 100) === z[0] ? ' selected' : '') + '>' + z[1] + '</option>'; }).join('') + '</select></div></div>' +
            '<div class="prev" id="gt-edit-prev"></div><p class="err" id="gt-edit-err"></p>' +
            '<div class="row"><button class="go" id="gt-edit-save">Save</button><button class="no" id="gt-edit-cancel">Cancel</button></div>' +
            '<div class="row">' + (hidden ? '<button class="no" id="gt-edit-show">Show this text again</button>' : '<button class="rs" id="gt-edit-del">Delete this text</button>') + (edited ? '<button class="rs" id="gt-edit-reset">Back to original</button>' : '') + '</div>');
        var ta = $('#gt-edit-ta'), ft = $('#gt-edit-font'), sz = $('#gt-edit-size'), pv = $('#gt-edit-prev');
        ta.value = now;
        function prev() {
            if (ft.value) { var lk = doc.getElementById('gt-edit-prevfont') || doc.head.appendChild(Object.assign(doc.createElement('link'), { id: 'gt-edit-prevfont', rel: 'stylesheet' })); lk.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(ft.value).replace(/%20/g, '+') + ':wght@400;600&display=swap'; }
            pv.style.fontFamily = ft.value ? '"' + ft.value + '",serif' : '';
            pv.style.fontSize = Math.round(20 * (+sz.value / 100)) + 'px'; pv.textContent = ta.value || '...';
        }
        ta.addEventListener('input', prev); ft.addEventListener('change', prev); sz.addEventListener('change', prev); prev();
        if (innerWidth > 640) { ta.focus(); ta.select(); }
        function busy(on) { ['gt-edit-save', 'gt-edit-del', 'gt-edit-show', 'gt-edit-reset'].forEach(function (id) { var b = doc.getElementById(id); if (b) b.disabled = on; }); }
        function fin(msg) { return function () { close(); say('<b>' + msg + '</b> It is live for all visitors.'); }; }
        function bad(m2) { busy(false); $('#gt-edit-err').textContent = 'Could not save: ' + m2 + '.'; }
        $('#gt-edit-cancel').addEventListener('click', close);
        $('#gt-edit-save').addEventListener('click', function () {
            var val = ta.value.replace(/\s+/g, ' ').trim();
            if (!val) { $('#gt-edit-err').textContent = 'The text is empty. Use "Delete this text" to remove it.'; return; }
            if (val.length > 600) { $('#gt-edit-err').textContent = 'Please keep it under 600 characters.'; return; }
            busy(true);
            commit(function (d) {
                var same = (L === 'en' && val === orig);
                d.texts[key] = d.texts[key] || {};
                if (same) delete d.texts[key][L]; else d.texts[key][L] = val;
                if (d.texts[key]['*'] === G().HIDE) delete d.texts[key]['*'];
                if (!Object.keys(d.texts[key]).length) delete d.texts[key];
                var s = { font: ft.value || '', size: +sz.value || 100 };
                if (!s.font && s.size === 100) delete d.styles[key]; else d.styles[key] = s;
            }, fin('Saved.'), bad);
        });
        var del = $('#gt-edit-del');
        if (del) del.addEventListener('click', function () {
            if (del.getAttribute('data-sure') !== '1') { del.setAttribute('data-sure', '1'); del.textContent = 'Tap again to delete'; return; }
            busy(true);
            commit(function (d) { d.texts[key] = d.texts[key] || {}; d.texts[key]['*'] = G().HIDE; }, fin('Deleted.'), bad);
        });
        var sh = $('#gt-edit-show');
        if (sh) sh.addEventListener('click', function () {
            busy(true);
            commit(function (d) { if (d.texts[key]) { delete d.texts[key]['*']; if (!Object.keys(d.texts[key]).length) delete d.texts[key]; } }, fin('Text is visible again.'), bad);
        });
        var rs = $('#gt-edit-reset');
        if (rs) rs.addEventListener('click', function () {
            busy(true);
            commit(function (d) { delete d.texts[key]; delete d.styles[key]; }, fin('Back to original.'), bad);
        });
    }

    /* ---- whole-website fonts ---- */
    function openFonts() {
        var f = (B.contentCached && B.contentCached().fonts) || {}, h = f.heading || 'Cormorant Garamond', b = f.body || 'Inter';
        var m = sheet('<h3>Fonts for the whole website</h3><p>Pick the letter style for big titles and for normal text. You see the change on this page right away. Arabic, Chinese and Japanese keep their own fonts.</p>' +
            '<div class="two"><div><label for="gt-fh">Headings (big titles)</label><select id="gt-fh">' + opts(HEAD_FONTS, h) + '</select></div><div><label for="gt-fb">Normal text</label><select id="gt-fb">' + opts(BODY_FONTS, b) + '</select></div></div>' +
            '<p class="err" id="gt-edit-err"></p><div class="row"><button class="go" id="gt-fsave">Save fonts</button><button class="no" id="gt-fcancel">Cancel</button></div><div class="row"><button class="rs" id="gt-freset">Use the original fonts</button></div>');
        var sh = $('#gt-fh'), sb = $('#gt-fb'), saved = false;
        function live() { G().previewFonts({ heading: sh.value, body: sb.value }); }
        sh.addEventListener('change', live); sb.addEventListener('change', live);
        function cancel() { if (!saved) G().reload(); close(); }
        $('#gt-fcancel').addEventListener('click', cancel);
        function put(v, msg) {
            ['gt-fsave', 'gt-freset'].forEach(function (id) { $('#' + id).disabled = true; });
            commit(function () { return { texts: false, styles: false, fonts: v }; }, function () { saved = true; close(); say('<b>' + msg + '</b> It is live for all visitors.'); }, function (e) { ['gt-fsave', 'gt-freset'].forEach(function (id) { $('#' + id).disabled = false; }); $('#gt-edit-err').textContent = 'Could not save: ' + e + '.'; });
        }
        $('#gt-fsave').addEventListener('click', function () { put({ heading: sh.value, body: sb.value }, 'Fonts saved.'); });
        $('#gt-freset').addEventListener('click', function () { put({}, 'Original fonts restored.'); });
    }
})();
