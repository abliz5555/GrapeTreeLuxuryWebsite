/* =====================================================================
   GRAPE TREE - CLICK-TO-EDIT TEXT (for the owner)
   Opens when a page address ends with ?edit=1 and an admin is signed in.
   Click any text on the page, type the new words, press Save. No code.
   Changes are saved per language (switch the language button to change
   the Arabic / Turkish / ... version of the same sentence).
   ===================================================================== */
(function () {
    'use strict';
    var doc = document, B = window.GT_BACKEND || window.GTB || null;
    var GT = window.GT || {};
    function $(s, r) { return (r || doc).querySelector(s); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var LANGNAME = { en: 'English', ar: 'Arabic', tr: 'Turkish', zh: 'Chinese', ru: 'Russian', ja: 'Japanese' };

    var css = doc.createElement('style');
    css.textContent =
        '.gt-edit-ui,.gt-edit-ui *{box-sizing:border-box;font-family:system-ui,Segoe UI,Arial,sans-serif;letter-spacing:0;text-transform:none}' +
        '#gt-edit-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;background:#2A1810;color:#F7F2E7;border-radius:999px;padding:10px 12px 10px 18px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 34px rgba(0,0,0,.35);max-width:calc(100vw - 20px);font-size:14px}' +
        '#gt-edit-bar b{color:#E3C77A}#gt-edit-bar button,#gt-edit-bar a{background:#F7F2E7;color:#2A1810;border:0;border-radius:999px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}' +
        'html.gt-edit-on body *{pointer-events:auto !important}html.gt-edit-on .gt-mega,html.gt-edit-on .gt-ftr-map iframe{pointer-events:none !important}.gt-edit-hover{outline:2px dashed #B8932F !important;outline-offset:3px;cursor:pointer !important;background:rgba(184,147,47,.12)}' +
        '#gt-edit-modal{position:fixed;inset:0;z-index:100001;background:rgba(20,10,5,.55);display:flex;align-items:center;justify-content:center;padding:14px}' +
        '#gt-edit-modal .box{background:#FFFDF8;color:#2A1810;border-radius:16px;padding:20px;width:100%;max-width:560px;max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
        '#gt-edit-modal h3{margin:0 0 4px;font-size:18px}#gt-edit-modal p{margin:6px 0;font-size:13px;color:#6b5a4e;line-height:1.5}' +
        '#gt-edit-modal .orig{background:#F3EBDD;border-radius:10px;padding:9px 12px;font-size:13px;color:#4A3A30;margin:8px 0 12px;word-break:break-word}' +
        '#gt-edit-modal textarea{width:100%;min-height:110px;border:1px solid #cdbfa8;border-radius:10px;padding:11px 12px;font-size:16px;line-height:1.5;resize:vertical;color:#2A1810;background:#fff}' +
        '#gt-edit-modal .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}' +
        '#gt-edit-modal .row button{border:0;border-radius:999px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer}' +
        '#gt-edit-modal .go{background:#2A1810;color:#F7F2E7}#gt-edit-modal .no{background:#EDE4D3;color:#2A1810}#gt-edit-modal .rs{background:#fff;color:#a3261c;border:1px solid #a3261c}' +
        '#gt-edit-modal .err{color:#a3261c;font-size:13px;min-height:16px}';
    doc.head.appendChild(css);

    var bar = doc.createElement('div'); bar.id = 'gt-edit-bar'; bar.className = 'gt-edit-ui'; bar.setAttribute('data-no-i18n', '');
    bar.innerHTML = '<span id="gt-edit-msg">Checking your sign-in...</span>';
    doc.body.appendChild(bar);
    function setBar(html) { bar.innerHTML = html; var x = $('[data-exit]', bar); if (x) x.addEventListener('click', exit); }
    function exit() { location.href = location.pathname + location.search.replace(/[?&]edit=1/, '').replace(/^&/, '?'); }

    var active = false, hoverEl = null, node = null;

    function ready(fn) {
        var tries = 0;
        (function wait() {
            B = window.GT_BACKEND || window.GTB || (window.GT && window.GT.backend) || B;
            if (B && B.ready) return B.ready.then(function (on) { fn(on); });
            if (++tries > 60) return fn(false);
            setTimeout(wait, 150);
        })();
    }
    ready(function (on) {
        if (!on) return setBar('<span>The editor needs the online connection, which is not available now.</span><button data-exit>Close</button>');
        var tries = 0;
        (function chk() {
            if (B.isAdmin && B.isAdmin()) return start();
            if (++tries < 25 && !(B.session && B.profile)) return setTimeout(chk, 200);
            setBar('<span>Please sign in as admin first, then open this page again.</span><a href="admin.html">Admin page</a><button data-exit>Close</button>');
        })();
    });

    function start() {
        active = true; doc.documentElement.classList.add('gt-edit-on');
        setBar('<span><b>Edit mode.</b> Click any text on the page to change it.</span><button data-exit>Finish</button>');
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('click', onClick, true);
        doc.addEventListener('submit', function (e) { if (!inUi(e.target)) e.preventDefault(); }, true);
    }
    function inUi(el) { return el && el.closest && (el.closest('.gt-edit-ui') || el.closest('#gt-edit-modal') || el.closest('.lang-switch')); }

    function textAt(x, y, target) {
        var n = null;
        if (doc.caretRangeFromPoint) { var r = doc.caretRangeFromPoint(x, y); if (r && r.startContainer.nodeType === 3) n = r.startContainer; }
        else if (doc.caretPositionFromPoint) { var p = doc.caretPositionFromPoint(x, y); if (p && p.offsetNode.nodeType === 3) n = p.offsetNode; }
        function ok(t) { return t && t.nodeType === 3 && /[A-Za-zÀ-ɏЀ-ӿ؀-ۿ぀-ヿ一-鿿]/.test(t.nodeValue) && !/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(t.parentNode.nodeName) && !t.parentNode.closest('[data-no-i18n]'); }
        if (ok(n)) {
            /* the caret may point to a neighbouring node: make sure the pointer is really over it */
            var rg = doc.createRange(); rg.selectNodeContents(n);
            var bs = rg.getClientRects(), hit = false;
            for (var i = 0; i < bs.length; i++) if (x >= bs[i].left - 3 && x <= bs[i].right + 3 && y >= bs[i].top - 3 && y <= bs[i].bottom + 3) hit = true;
            if (hit) return n;
        }
        /* fallback: first text child of the element under the pointer */
        for (var c = target && target.firstChild; c; c = c.nextSibling) if (ok(c)) return c;
        return null;
    }
    function onMove(e) {
        if (!active || inUi(e.target)) return unhover();
        var n = textAt(e.clientX, e.clientY, e.target);
        var el = n ? n.parentNode : null;
        if (el === hoverEl) return;
        unhover(); if (el) { hoverEl = el; el.classList.add('gt-edit-hover'); }
    }
    function unhover() { if (hoverEl) { hoverEl.classList.remove('gt-edit-hover'); hoverEl = null; } }
    function onClick(e) {
        if (!active || inUi(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        var n = textAt(e.clientX, e.clientY, e.target);
        if (n) openModal(n);
    }

    function lang() { return (GT.lang && GT.lang.get()) || 'en'; }
    function openModal(n) {
        node = n; unhover();
        var L = lang(), key = GT.lang.key(n), orig = GT.lang.original(n).replace(/\s+/g, ' ').trim();
        var now = n.nodeValue.replace(/\s+/g, ' ').trim();
        var m = doc.createElement('div'); m.id = 'gt-edit-modal'; m.className = 'gt-edit-ui'; m.setAttribute('data-no-i18n', '');
        m.innerHTML = '<div class="box" role="dialog" aria-modal="true"><h3>Change this text</h3><p>Language: <b>' + esc(LANGNAME[L] || L) + '</b>. To change another language, close this window and use the language button at the top of the page.</p>' +
            (L !== 'en' ? '<p>English original:</p><div class="orig">' + esc(orig) + '</div>' : '') +
            '<textarea id="gt-edit-ta" dir="auto"></textarea><p class="err" id="gt-edit-err"></p>' +
            '<div class="row"><button class="go" id="gt-edit-save">Save</button><button class="no" id="gt-edit-cancel">Cancel</button><button class="rs" id="gt-edit-reset">Back to original</button></div></div>';
        doc.body.appendChild(m);
        var ta = $('#gt-edit-ta'); ta.value = now; ta.focus(); ta.select();
        $('#gt-edit-cancel').addEventListener('click', close);
        m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
        $('#gt-edit-save').addEventListener('click', function () { save(key, L, ta.value.replace(/\s+/g, ' ').trim()); });
        $('#gt-edit-reset').addEventListener('click', function () { save(key, L, ''); });
    }
    function close() { var m = $('#gt-edit-modal'); if (m) m.remove(); node = null; }
    function save(key, L, val) {
        var err = $('#gt-edit-err'), btn = $('#gt-edit-save');
        if (val.length > 600) { err.textContent = 'Please keep it under 600 characters.'; return; }
        btn.disabled = true; btn.textContent = 'Saving...';
        B.content().then(function (c) {
            var texts = JSON.parse(JSON.stringify((c && c.texts) || {}));
            if (val) { texts[key] = texts[key] || {}; texts[key][L] = val; }
            else if (texts[key]) { delete texts[key][L]; if (!Object.keys(texts[key]).length) delete texts[key]; }
            return B.saveContent('texts', texts).then(function () { c = c || {}; c.texts = texts; try { localStorage.setItem('gt-content-v1', JSON.stringify(c)); } catch (e) {} return c; });
        }).then(function (c) {
            GT.lang.reload(c); close();
            var s = $('#gt-edit-bar span'); if (s) { var old = s.innerHTML; s.innerHTML = '<b>Saved.</b> It is live for all visitors.'; setTimeout(function () { s.innerHTML = old; }, 2200); }
        }).catch(function (e) { btn.disabled = false; btn.textContent = 'Save'; err.textContent = 'Could not save: ' + ((e && e.message) || 'please try again') + '.'; });
    }
})();
