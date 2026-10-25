/* =====================================================================
   GRAPE TREE - DESIGN STUDIO  (Katanukiya cut-out cakes + GildArt chocolates)
   Upload -> design on a real-size display (with AI help) -> preview -> order.
   Everything is drawn in the visitor's browser. Files are only sent when
   the order is placed. Sections:
     1 settings   2 upload + versions + AI   3 quick tools   4 cut line
     5 drawing    6 checks                    7 placement     8 steps + price
     9 files + cart
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {} };
    var CFG = DATA.config || {};
    var ALL = DATA.studio || {};
    var PRODUCT = doc.body.getAttribute('data-product') === 'chocolate' ? 'chocolate' : 'cake';
    var ISCAKE = PRODUCT === 'cake';
    var ST = ALL[PRODUCT] || {};
    var T = function (s) { return window.GT && window.GT.lang ? window.GT.lang.t(s) : s; };
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
    function esc(s) { return window.GT.esc(s); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function num(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString(); }
    function money(n) { return (CFG.currency || 'AED') + ' ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function makeCanvas(w, h) { var c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
    function backend() { return window.GT && window.GT.backend; }

    /* ------------------------------ 1. settings ------------------------------ */
    var SURF, MARGIN, BORDER, SAFE, TOL, LEAD, DESIGNER_FEE, TIERS, BOXES, THICK, FLAVOURS, MOQ, BOXSETS, DISCOUNTS, MINBOX;
    function mergeCfg(base, over) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in (over || {})) if (over[k] != null && over[k] !== '') o[k] = over[k]; return o; }
    function applyCfg(over) {
        ST = mergeCfg(ALL[PRODUCT] || {}, over && over[PRODUCT]);
        SURF = ST.surface || (ISCAKE ? { w: 63, h: 48 } : { w: 50, h: 50 });   // surface in mm (landscape)
        MARGIN = ST.margin != null ? ST.margin : (ISCAKE ? 5 : 0);              // clear zone on every side: nothing may pass it
        BORDER = ST.unprinted != null ? ST.unprinted : (ISCAKE ? 1.5 : 0);            // outer edge that is never printed
        SAFE = ST.safe || 2;                     // safe margin inside the cut line
        TOL = ST.tolerance || 1.5;
        LEAD = ST.leadBusinessDays || 14;
        DESIGNER_FEE = ST.designerFee || 0;
        TIERS = ST.tiers || (ISCAKE
        ? [{ qty: 120, price: 2400 }, { qty: 180, price: 3050 }, { qty: 240, price: 3750 }, { qty: 300, price: 4400, popular: true }, { qty: 600, price: 7800 }, { qty: 900, price: 11200 }]
        : [{ qty: 100, price: 1500 }, { qty: 200, price: 2700 }, { qty: 300, price: 3600, popular: true }, { qty: 500, price: 5500 }, { qty: 1000, price: 10000 }]);
        BOXES = ST.boxes || [{ id: 'white', label: 'White', extra: 0, color: '#F4F1EA', standard: true }, { id: 'black', label: 'Black', extra: 3, color: '#222222' }, { id: 'yellow', label: 'Yellow', extra: 3, color: '#F2C93B' }, { id: 'lightblue', label: 'Light blue', extra: 3, color: '#A6D8DC' }];
        THICK = ST.thickness || [{ id: '5', label: '5 mm thin', extra: 0 }, { id: '12', label: '12 mm thick', extra: 1.5 }];   // chocolate only
        FLAVOURS = ST.flavours || ['Milk chocolate', 'Dark chocolate', 'White chocolate', 'Ruby chocolate', 'Hazelnut', 'Matcha'];
        BOXSETS = (ST.boxSets && ST.boxSets.length ? ST.boxSets : [{ id: '1', pieces: 1, label: 'Single chocolate', price: 35 }, { id: '3', pieces: 3, label: '3-piece gift set', price: 95 }, { id: '9', pieces: 9, label: '9-piece gift box', price: 260 }]);
        DISCOUNTS = (ST.discounts && ST.discounts.length ? ST.discounts : [{ min: 1, off: 0 }, { min: 10, off: 5 }, { min: 25, off: 10 }, { min: 50, off: 15 }, { min: 100, off: 20 }]).slice().sort(function (a, b) { return a.min - b.min; });
        MINBOX = Math.max(1, ST.minBoxes || 1);
        MOQ = ST.customMinQty || 300;           // chocolate: from this quantity flavour and box can be customised
    }
    var CFG0 = {}; try { var BK = window.GT && window.GT.backend; CFG0 = (BK && BK.contentCached ? BK.contentCached().studio : null) || {}; } catch (e) { }
    applyCfg(CFG0);
    var MAXFILE = 15 * 1024 * 1024;
    var WORK = 1400;                             // longest side of the working image
    var MAXVER = 8;

    var SHAPES = [
        { id: 'circle', label: 'Circle', d: 'M0 50a50 50 0 1 0 100 0a50 50 0 1 0 -100 0z' },
        { id: 'square', label: 'Square', d: 'M0 0H100V100H0z' },
        { id: 'rounded', label: 'Rounded', d: 'M20 0H80A20 20 0 0 1 100 20V80A20 20 0 0 1 80 100H20A20 20 0 0 1 0 80V20A20 20 0 0 1 20 0z' },
        { id: 'heart', label: 'Heart', d: 'M50 96C20 72 2 54 2 32C2 15 14 4 29 4C39 4 46 9 50 17C54 9 61 4 71 4C86 4 98 15 98 32C98 54 80 72 50 96z' },
        { id: 'clover', label: 'Clover', d: 'M50 20.14A24 24 0 1 1 79.86 50A24 24 0 1 1 50 79.86A24 24 0 1 1 20.14 50A24 24 0 1 1 50 20.14z', box: [3, 3, 97, 97] },
        { id: 'star', label: 'Star', d: polyD(function (i) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; return [50 + r * Math.cos(a), 53 + r * Math.sin(a)]; }, 10) },
        { id: 'scallop', label: 'Flower', d: polyD(function (i) { var a = i / 160 * Math.PI * 2, r = 41 + 9 * Math.cos(a * 8); return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; }, 160) },
        { id: 'hexagon', label: 'Hexagon', d: polyD(function (i) { var a = Math.PI / 6 + i * Math.PI / 3; return [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]; }, 6) },
        { id: 'drop', label: 'Drop', d: 'M50 2C50 2 88 42 88 64A38 38 0 0 1 12 64C12 42 50 2 50 2z' },
        { id: 'cloud', label: 'Cloud', d: 'M27 84A23 23 0 0 1 22 38A29 29 0 0 1 74 30A27 27 0 0 1 77 84z' },
        { id: 'arch', label: 'Arch', d: 'M0 100V50A50 50 0 0 1 100 50V100z' },
        { id: 'triangle', label: 'Triangle', d: 'M50 4L97 92H3z' },
        { id: 'diamond', label: 'Diamond', d: 'M50 0L100 50L50 100L0 50z' },
        { id: 'pentagon', label: 'Pentagon', d: polyD(function (i) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [50 + 50 * Math.cos(a), 52 + 50 * Math.sin(a)]; }, 5) },
        { id: 'octagon', label: 'Octagon', d: polyD(function (i) { var a = Math.PI / 8 + i * Math.PI / 4; return [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]; }, 8) },
        { id: 'burst', label: 'Burst', d: polyD(function (i) { var a = i * Math.PI / 12, r = i % 2 ? 40 : 50; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; }, 24) },
        { id: 'sparkle', label: 'Sparkle', d: 'M50 0Q56 44 100 50Q56 56 50 100Q44 56 0 50Q44 44 50 0z' },
        { id: 'moon', label: 'Moon', d: 'M62 4A48 48 0 1 0 62 96A38 38 0 1 1 62 4z' },
        { id: 'bolt', label: 'Bolt', d: 'M58 0L14 56H44L34 100L86 40H54z' },
        { id: 'plus', label: 'Plus', d: 'M35 0H65V35H100V65H65V100H35V65H0V35H35z' },
        { id: 'bubble', label: 'Bubble', d: 'M12 8H88A10 10 0 0 1 98 18V62A10 10 0 0 1 88 72H48L26 94V72H12A10 10 0 0 1 2 62V18A10 10 0 0 1 12 8z' },
        { id: 'shield', label: 'Shield', d: 'M50 0L96 14V50C96 76 74 92 50 100C26 92 4 76 4 50V14z' },
        { id: 'oval', label: 'Oval', d: 'M0 50a50 36 0 1 0 100 0a50 36 0 1 0 -100 0z' },
        { id: 'tag', label: 'Tag', d: 'M0 12A12 12 0 0 1 12 0H62L100 50L62 100H12A12 12 0 0 1 0 88z' },
        { id: 'leaf', label: 'Leaf', d: 'M10 90C10 40 40 10 92 8C90 62 62 92 10 90z' },
        { id: 'crown', label: 'Crown', d: 'M4 88V30L28 52L50 10L72 52L96 30V88z' },
        { id: 'house', label: 'House', d: 'M50 2L98 46H86V98H14V46H2z' }
    ];
    function polyD(fn, n) {
        var s = '';
        for (var i = 0; i < n; i++) { var p = fn(i); s += (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
        return s + 'z';
    }
    SHAPES.forEach(function (s) { s.path = new Path2D(s.d); });
    function shapeById(id) { return SHAPES.filter(function (s) { return s.id === id; })[0] || SHAPES[0]; }


    /* ------------------------------ state ------------------------------ */
    var S = {
        step: 1, maxStep: 1,
        file: null, designId: '', origW: 0, origH: 0,
        W: 0, H: 0, src: null, mask: null, art: null, cb: null,
        versions: [], ver: 0, busy: false, ai: null,
        designer: false, designerNote: '',
        finish: ISCAKE ? 'around' : 'print', finishChosen: false, shape: 'circle',
        orient: 'landscape',
        p: { x: 0, y: 0, w: 30, rot: 0 },
        sh: { x: 0, y: 0, w: 38, prop: 1 },
        off: 2, smooth: 1.5, move: 'art', limited: false, fitted: false,
        boxSet: 1, nbox: 1, slots: [], slot: 0,
        qty: ISCAKE ? 3 : 2, box: 'white', thick: '5', flavour: 0, customBox: false, boxNote: '',
        test: false
    };
    function surfW() { return S.orient === 'portrait' ? SURF.h : SURF.w; }
    function surfH() { return S.orient === 'portrait' ? SURF.w : SURF.h; }
    /* fixed square work frame: the surface is always drawn centred inside the same frame size, so landscape, portrait and window resizing never change the workspace */
    var FPAD = 4;
    function frameF() { return Math.max(SURF.w, SURF.h) + 2 * FPAD; }
    function frameOff() { var F = frameF(); return { x: (F - surfW()) / 2, y: (F - surfH()) / 2 }; }
    function artH() { return S.p.w * S.cb.h / S.cb.w; }
    function look() { var v = S.versions[S.ver]; return v ? v.kind : 'original'; }

    /* ------------------------------ 2. upload, versions, AI ------------------------------ */
    function showUpErr(msg) { var e = $('#st-up-err'); e.textContent = msg || ''; e.hidden = !msg; }
    function toastMsg(m) { if (window.GT && GT.toast) GT.toast(m); else alert(m); }

    function loadFile(file) {
        showUpErr('');
        if (!file) return;
        if (!rightsOk()) return;
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
            return showUpErr(T('This file type is not supported. Please use a PNG, JPG, WebP or GIF image. (Photos in HEIC format: please export them as JPG first.)'));
        }
        if (file.size > MAXFILE) return showUpErr(T('This image is larger than 15 MB. Please choose a smaller file.'));
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(url);
            if (img.width < 16 || img.height < 16) return showUpErr(T('This image is too small to use.'));
            var k = Math.min(1, WORK / Math.max(img.width, img.height));
            var c = makeCanvas(img.width * k, img.height * k), cx = c.getContext('2d');
            cx.imageSmoothingQuality = 'high'; cx.drawImage(img, 0, 0, c.width, c.height);
            startDesign(file, c, img.width, img.height);
        };
        img.onerror = function () { URL.revokeObjectURL(url); showUpErr(T('We could not read this image. Please try a different file.')); };
        img.src = url;
    }

    function maskFromCanvas(c) {
        var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, N = c.width * c.height, m = new Uint8Array(N), clear = 0;
        for (var i = 0; i < N; i++) { m[i] = d[i * 4 + 3] > 24 ? 255 : 0; if (d[i * 4 + 3] < 250) clear++; }
        return { mask: m, transparent: clear > N * 0.02 };
    }
    function thumbOf(c) {
        var t = makeCanvas(96, 96 * c.height / c.width), x = t.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height); x.drawImage(c, 0, 0, t.width, t.height);
        return t.toDataURL('image/jpeg', 0.8);
    }
    function addVersion(v) {
        var m = maskFromCanvas(v.src);
        if (!v.mask) v.mask = m.mask;
        v.transparent = m.transparent || v.transparent;
        v.thumb = thumbOf(v.src);
        v.id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        S.versions.push(v);
        while (S.versions.length > MAXVER) { var drop = S.versions.findIndex(function (x, i) { return i > 0 && i !== S.versions.length - 1; }); if (drop < 1) break; S.versions.splice(drop, 1); }
        selectVersion(S.versions.length - 1);
    }
    function selectVersion(i) {
        var v = S.versions[i]; if (!v) return;
        S.ver = i;
        if (!ISCAKE && v.kind !== 'bw' && v.kind !== 'engrave' && !v.ink) {
            // gold chocolate is printed in one colour (black): turn this version into ink
            var w0 = makeCanvas(v.src.width, v.src.height), wx = w0.getContext('2d'), mm = wx.createImageData(w0.width, w0.height);
            wx.drawImage(v.src, 0, 0);
            var im = wx.getImageData(0, 0, w0.width, w0.height), dd = im.data;
            for (var q = 0; q < v.mask.length; q++) if (!v.mask[q]) dd[q * 4 + 3] = 0;
            wx.putImageData(im, 0, 0);
            v.ink = bwToAlpha(w0);
            var mi = maskFromCanvas(v.ink); v.inkMask = mi.mask;
        }
        var useSrc = v.ink || v.src, useMask = v.inkMask || v.mask;
        S.src = useSrc; S.W = useSrc.width; S.H = useSrc.height; S.mask = new Uint8Array(useMask);
        S.art = makeCanvas(S.W, S.H); S.cb = null;
        renderArtRect(0, 0, S.W, S.H);
        artChanged();
        if (!S.finishChosen && ISCAKE) { S.finish = v.transparent ? 'around' : 'shape'; $('input[name=finish][value=' + S.finish + ']').checked = true; }
        if (S.fitted) { fitArt(); }
        renderVersions(); afterChange();
    }
    function renderVersions() {
        $('#ver-strip').innerHTML = S.versions.map(function (v, i) {
            return '<button type="button" class="st-ver' + (i === S.ver ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + (i === S.ver) + '"><img src="' + v.thumb + '" alt=""><span>' + esc(T(v.label)) + '</span></button>';
        }).join('');
        var last = S.versions[S.ver];
        var gen0 = !!(S.versions[0] && S.versions[0].gen);
        $('#ai-retry').hidden = !last || last.kind === 'original' || last.kind === 'made' || gen0;
        $('#ai-btns').hidden = !!(S.versions[0] && (S.versions[0].kind === 'made' || gen0));
        if (!ISCAKE) renderSlots();
    }


    /* ------------------------------ box sets: one print per piece (chocolate) ------------------------------ */
    var SLOT_KEYS = ['file', 'designId', 'origW', 'origH', 'W', 'H', 'src', 'mask', 'art', 'cb', 'versions', 'ver', 'designer', 'designerNote', 'p', 'sh', 'finish', 'finishChosen', 'off', 'smooth', 'fitted', 'original', 'lastKind', 'limited', 'orient', 'move', 'shape'];
    function boxSet() { return BOXSETS[S.boxSet] || BOXSETS[0]; }
    function pieces() { return ISCAKE ? 1 : boxSet().pieces; }
    function snap() { var o = {}; SLOT_KEYS.forEach(function (k) { o[k] = S[k]; }); return o; }
    function putSlot(o) { SLOT_KEYS.forEach(function (k) { S[k] = o[k]; }); }
    function blankSlot() {
        return { file: null, designId: '', origW: 0, origH: 0, W: 0, H: 0, src: null, mask: null, art: null, cb: null, versions: [], ver: 0, designer: false, designerNote: '',
            p: { x: surfW() / 2, y: surfH() / 2, w: Math.min(surfW(), surfH()) * 0.6, rot: 0 }, sh: { x: surfW() / 2, y: surfH() / 2, w: Math.min(surfW(), surfH()), prop: 1 },
            finish: ISCAKE ? 'around' : 'print', finishChosen: false, off: 2, smooth: 1.5, fitted: false, original: null, lastKind: null, limited: false, orient: 'landscape', move: 'art', shape: 'circle' };
    }
    function saveSlot() { S.slots[S.slot] = S.src ? snap() : null; }
    function slotFilled(i) { return i === S.slot ? !!S.src : !!(S.slots[i] && S.slots[i].src); }
    function withSlot(i, fn) {
        if (i === S.slot) return fn();
        var keep = snap(); putSlot(S.slots[i] || blankSlot());
        try { return fn(); } finally { putSlot(keep); }
    }
    function cloneCanvas(c) { var o = makeCanvas(c.width, c.height); o.getContext('2d').drawImage(c, 0, 0); return o; }
    function cloneSlot(o) {
        var c = {}; SLOT_KEYS.forEach(function (k) { c[k] = o[k]; });
        c.designId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        c.versions = o.versions.map(function (v) { var n = {}; for (var k in v) n[k] = v[k]; return n; });
        c.mask = o.mask ? new Uint8Array(o.mask) : o.mask; c.art = o.art ? cloneCanvas(o.art) : o.art; c.cb = o.cb ? JSON.parse(JSON.stringify(o.cb)) : o.cb;
        c.p = JSON.parse(JSON.stringify(o.p)); c.sh = JSON.parse(JSON.stringify(o.sh));
        return c;
    }
    function refreshDesignUI() {
        var has = !!S.src;
        $('#st-loaded').hidden = !has; if (ISCAKE) $('#st-next1').disabled = !has; showUpErr('');
        if (has) {
            var v0 = S.versions[0] || {};
            $('#st-up-thumb').src = v0.thumb || '';
            $('#st-up-name').textContent = v0.kind === 'made' ? T('Your own design') : (S.file && S.file.name) || '';
            $('#st-up-info').textContent = S.origW + ' × ' + S.origH + ' px';
            $('#st-up-warn').hidden = true;
        }
        $('#st-designer').checked = !!S.designer; $('#st-dnote-wrap').hidden = !S.designer; $('#st-dnote').value = S.designerNote || '';
        cutCache = null; renderVersions(); renderSlots();
    }
    function loadSlot(i) {
        saveSlot(); S.slot = i; putSlot(S.slots[i] || blankSlot());
        refreshDesignUI();
        if (ISCAKE) { if (S.src) { afterChange(); goStep(2); } else goStep(1); } else { goStep(2); if (S.src) afterChange(); }
    }
    function boxIcon(n) {
        var cols = n === 9 ? 3 : n, rows = n === 9 ? 3 : 1, s = n === 1 ? 26 : 14, g = 3, w = cols * s + (cols - 1) * g, h = rows * s + (rows - 1) * g, o = '';
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) o += '<rect x="' + (c * (s + g)) + '" y="' + (r * (s + g)) + '" width="' + s + '" height="' + s + '" rx="2.5" fill="url(#gg)"/>';
        return '<svg viewBox="-4 -4 ' + (w + 8) + ' ' + (h + 8) + '" aria-hidden="true"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9CF86"/><stop offset=".5" stop-color="#C79B3A"/><stop offset="1" stop-color="#F1DC9A"/></linearGradient></defs><rect x="-4" y="-4" width="' + (w + 8) + '" height="' + (h + 8) + '" rx="5" fill="#16130f"/>' + o + '</svg>';
    }
    function renderBoxSet() {
        var el = $('#st-boxset'); if (!el) return;
        el.innerHTML = BOXSETS.map(function (b, i) {
            return '<label class="st-bset' + (i === S.boxSet ? ' on' : '') + '"><input type="radio" name="bset" value="' + i + '"' + (i === S.boxSet ? ' checked' : '') + '>' + boxIcon(b.pieces) +
                '<b>' + esc(T(b.label)) + '</b><small>' + b.pieces + ' ' + esc(b.pieces === 1 ? T('print') : T('different prints')) + ' · ' + esc(T('from')) + ' ' + esc(money(b.price)) + '</small></label>';
        }).join('');
        $$('input[name=bset]', el).forEach(function (r) {
            r.addEventListener('change', function () {
                saveSlot(); S.boxSet = +r.value; renderBoxSet();
                if (S.slot >= pieces()) { S.slot = 0; putSlot(S.slots[0] || blankSlot()); refreshDesignUI(); } else renderSlots();
                updateSummary();
            });
        });
        renderSlots();
    }
    /* the box map beside the workspace: every piece, live, in the real box layout */
    function boxCols(np) { return np === 9 ? 3 : np; }
    function renderBoxMap() {
        var el = $('#st-boxmap'), act = $('#st-boxact'); if (!el) return;
        var np = pieces(), on = np > 1 && S.step === 2;
        el.hidden = !on; if (!on) return;
        el.innerHTML = '<p class="st-bm-h"><b>' + esc(T(boxSet().label)) + '</b> · ' + esc(T('tap a piece to design it, drag one onto another to swap')) + '</p>' +
            '<div class="st-bm" style="grid-template-columns:repeat(' + boxCols(np) + ',1fr)">' +
            Array.apply(null, Array(np)).map(function (_, i) { return '<button type="button" class="st-bmc' + (i === S.slot ? ' on' : '') + (slotFilled(i) ? '' : ' empty') + '" data-i="' + i + '" aria-label="' + esc(T('Piece') + ' ' + (i + 1)) + '"><canvas></canvas><em>' + (i + 1) + '</em>' + (slotFilled(i) ? '' : '<b>+</b>') + '</button>'; }).join('') + '</div>';
        drawBoxMap();
    }
    function drawBoxMap() {
        var el = $('#st-boxmap'); if (!el || el.hidden) return;
        $$('.st-bmc', el).forEach(function (b) {
            var i = +b.dataset.i, cv = $('canvas', b);
            if (slotFilled(i)) withSlot(i, function () { if (S.cb && !S.cb.empty) drawScene(cv, 4, 'preview', { tol: false, bare: true }); });
            else { cv.width = 4; cv.height = 4; }
        });
    }
    function copyToAll() {
        if (!S.src) return;
        saveSlot();
        for (var i = 0; i < pieces(); i++) if (i !== S.slot) S.slots[i] = cloneSlot(S.slots[S.slot]);
        renderSlots(); updateSummary(); toastMsg(T('Done. You can still change any single piece.'));
    }
    function swapSlots(a, b) {
        saveSlot(); var t = S.slots[a]; S.slots[a] = S.slots[b]; S.slots[b] = t;
        putSlot(S.slots[S.slot] || blankSlot()); refreshDesignUI();
        if (S.src) { S.fitted = true; afterChange(); } renderSlots();
    }
    function setupBoxMap() {
        var el = $('#st-boxmap'), drag = null;
        el.addEventListener('pointerdown', function (e) {
            var b = e.target.closest('.st-bmc'); if (!b) return;
            drag = { i: +b.dataset.i, x: e.clientX, y: e.clientY, moved: false, over: -1 };
        });
        doc.addEventListener('pointermove', function (e) {
            if (!drag) return;
            if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
            drag.moved = true;
            var t = doc.elementFromPoint(e.clientX, e.clientY), c = t && t.closest ? t.closest('.st-bmc') : null;
            $$('.st-bmc', el).forEach(function (x) { x.classList.toggle('drag', +x.dataset.i === drag.i); x.classList.toggle('over', !!c && x === c && +c.dataset.i !== drag.i); });
            drag.over = c ? +c.dataset.i : -1;
        });
        function end() {
            if (!drag) return; var d = drag; drag = null;
            $$('.st-bmc', el).forEach(function (x) { x.classList.remove('drag', 'over'); });
            if (d.moved) { if (d.over > -1 && d.over !== d.i) swapSlots(d.i, d.over); }
            else if (d.i !== S.slot) loadSlot(d.i);
        }
        doc.addEventListener('pointerup', end); doc.addEventListener('pointercancel', function () { drag = null; });
    }
    function renderSlots() {
        if (ISCAKE) return;
        var np = pieces();
        var now = $('#st-piece-now');
        if (now) { now.hidden = S.step !== 2; now.textContent = np > 1 ? T('Piece') + ' ' + (S.slot + 1) + ' ' + T('of') + ' ' + np : ''; now.style.display = np > 1 && S.step === 2 ? '' : 'none'; }
        renderBoxMap();
        var nx = $('#st-nextpiece'); if (nx) { nx.hidden = np < 2 || S.slot >= np - 1 || !S.src; nx.textContent = T('Design piece') + ' ' + (S.slot + 2) + ' →'; }
        /* upload first, then the design tools: the box map is the only piece chooser */
        var has = !!S.src, st = $('#st-stage');
        if (st) st.classList.toggle('nocanvas', !has);
        var ca = $('#st-copyall'); if (ca) ca.hidden = np < 2;
        var up = $('#st-uploadpane'), dp = $('#st-designpane'); if (up) up.hidden = has; if (dp) dp.hidden = !has;
    }

    function startDesign(file, canvas, ow, oh, first) {
        S.file = file; S.designId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        S.origW = ow; S.origH = oh; S.versions = []; S.fitted = false; S.finishChosen = false; S.designer = false; S.designerNote = '';
        $('#st-designer').checked = false; $('#st-dnote-wrap').hidden = true; $('#st-dnote').value = '';
        S.p = { x: surfW() / 2, y: surfH() / 2, w: Math.min(surfW(), surfH()) * 0.6, rot: 0 };
        S.sh = { x: surfW() / 2, y: surfH() / 2, w: Math.min(surfW(), surfH()) - 2 * MARGIN, prop: 1 };
        S.original = canvas;
        // the first version is always the customer's own image
        var base = first || { kind: 'original', label: 'Your image', src: canvas };
        S.versions = []; S.src = canvas; S.W = canvas.width; S.H = canvas.height;
        var m = maskFromCanvas(canvas);
        base.mask = m.mask; base.transparent = first ? true : m.transparent;
        base.thumb = thumbOf(canvas); base.id = 'v0'; S.versions.push(base);
        $('#st-loaded').hidden = false;
        $('#st-up-thumb').src = base.thumb;
        $('#st-up-name').textContent = first ? T(first.gen ? 'AI drawing' : 'Your own design') : (file.name || T('Sample character'));
        $('#st-up-info').textContent = ow + ' × ' + oh + ' px' + (file.size ? ' · ' + (file.size / 1048576 < 1 ? Math.round(file.size / 1024) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB') : '');
        var w = $('#st-up-warn');
        w.hidden = Math.max(ow, oh) >= 700;
        w.textContent = T('This image is quite small. Enlarging it can make the print look soft, so please check the preview carefully.');
        if (ISCAKE) $('#st-next1').disabled = false;
        S.maxStep = Math.max(S.maxStep, 1);
        selectVersion(0);
        if (!ISCAKE && !first) generate('bw', true);                       // gold print is one colour: start with a black and white version
        renderSlots();
        goStep(2);
    }

    function resetDesign() {
        S.file = null; S.designId = ''; S.versions = []; S.ver = 0; S.src = null; S.mask = null; S.art = null; S.cb = null; S.original = null;
        S.fitted = false; S.maxStep = 1; S.finishChosen = false; S.designer = false; S.designerNote = ''; S.lastKind = null; S.limited = false;
        $('#st-designer').checked = false; $('#st-dnote-wrap').hidden = true; $('#st-dnote').value = '';
        $('#st-loaded').hidden = true; if (ISCAKE) $('#st-next1').disabled = true; showUpErr('');
        S.slots[S.slot] = null;
        cutCache = null; renderVersions(); renderSlots(); goStep(ISCAKE ? 1 : 2);
    }
    /* the built-in sample, so anyone can try the studio without a file */
    function sampleCanvas() {
        if (!ISCAKE) {                         // a simple luxury monogram, as a stand-in for a company logo
            var lc = makeCanvas(800, 800), lx = lc.getContext('2d'); lx.fillStyle = '#000'; lx.strokeStyle = '#000'; lx.textAlign = 'center'; lx.textBaseline = 'middle';
            lx.lineWidth = 7; lx.beginPath(); lx.arc(400, 400, 300, 0, 7); lx.stroke(); lx.lineWidth = 2.5; lx.beginPath(); lx.arc(400, 400, 282, 0, 7); lx.stroke();
            lx.font = '400 300px "Playfair Display", Georgia, serif'; lx.fillText('GT', 400, 380);
            lx.fillRect(250, 520, 300, 3); lx.font = '600 44px "Cinzel", Georgia, serif'; lx.fillText('YOUR LOGO', 400, 580);
            lx.lineWidth = 2.5; [[400, 190]].forEach(function (q) { lx.beginPath(); lx.moveTo(q[0], q[1] - 18); lx.lineTo(q[0] + 14, q[1]); lx.lineTo(q[0], q[1] + 18); lx.lineTo(q[0] - 14, q[1]); lx.closePath(); lx.fill(); });
            return lc;
        }
        var c = makeCanvas(800, 800), x = c.getContext('2d');
        x.lineJoin = 'round'; x.lineWidth = 10; x.strokeStyle = '#4a2c2a';
        x.fillStyle = '#7B3FA0'; x.beginPath(); x.ellipse(400, 330, 230, 190, 0, Math.PI, 0); x.fill(); x.stroke();
        x.fillStyle = '#FFD7AE'; x.beginPath(); x.arc(400, 380, 190, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = '#7B3FA0'; x.beginPath(); x.ellipse(400, 262, 230, 130, 0, Math.PI, 0); x.fill(); x.stroke();
        x.fillStyle = '#2b1b1b'; [[330, 390], [470, 390]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 20, 0, 7); x.fill(); });
        x.fillStyle = '#FF9AA2'; [[290, 440], [510, 440]].forEach(function (p) { x.beginPath(); x.ellipse(p[0], p[1], 28, 18, 0, 0, 7); x.fill(); });
        x.strokeStyle = '#a83a4a'; x.lineWidth = 9; x.beginPath(); x.arc(400, 430, 55, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
        x.strokeStyle = '#1f3d63'; x.lineWidth = 10; x.fillStyle = '#4C8FD6'; x.beginPath(); x.roundRect ? x.roundRect(300, 580, 200, 170, 24) : x.rect(300, 580, 200, 170); x.fill(); x.stroke();
        return c;
    }

    /* --- AI (server) with the quick built-in tools as a fallback --- */
    function aiConnected() { var B = backend(); return !!(B && B.enabled && B.studioAI && (ALL.ai || {}).enabled !== false); }
    function needLogin() { var B = backend(); return aiConnected() && !(B.session && B.session.user); }       // AI is only for signed-in customers (it costs us money)
    function aiOn() { return aiConnected() && !needLogin(); }
    var LOGIN_HTML = '<a href="account.html">Sign in or create a free account</a>';
    function aiModeText() { return needLogin() ? T('Sign in (free) to use AI') : aiOn() ? T('AI is on') : T('Quick tools mode (AI is not connected)'); }
    function refreshAiMode() { var m = $('#ai-mode'); if (!m) return; m.textContent = aiModeText(); m.className = 'st-aimode ' + (aiOn() ? 'on' : ''); }
    var KIND_LABEL = { cutout: 'Cut out', cartoon: 'Cartoon', bw: 'Black & white', engrave: 'Engraving style' };

    function generate(kind, quiet) {
        if (S.busy || !S.versions.length) return;
        var orig = S.versions[0];
        S.busy = true; S.lastKind = kind; setBusy(kind);
        var useAI = aiOn(), source = 'ai';
        var run = !useAI ? Promise.reject(new Error('noai')) : B_ready().then(function () {
            var B = backend(); if (!B.enabled) throw new Error('noai');
            return canvasBlob(scaleTo(orig.src, 1024)).then(function (blob) { return B.studioAI(kind, blob); });
        }).then(blobToCanvas).then(function (c) {
            if (kind === 'bw' || kind === 'engrave') c = bwToAlpha(c);
            return { kind: kind, label: KIND_LABEL[kind] + ' (AI)', src: c, ai: true };
        });
        run.catch(function (e) {
            source = 'local';
            if (useAI && !quiet) toastMsg(T('AI is not available right now, so we used our quick tool. You can try AI again, or send it to our designer.'));
            return new Promise(function (res) { setTimeout(function () { res(localVersion(kind, orig)); }, 30); });
        }).then(function (v) {
            addVersion(v);
            S.busy = false; setBusy(null);
            if (source === 'local' && !useAI && !quiet) showAiNote(true);
            if (source === 'ai') showAiNote(false);
        }).catch(function (e) { S.busy = false; setBusy(null); toastMsg(T('Something went wrong. Please try again.')); });
    }
    function B_ready() { var B = backend(); return B && B.ready ? B.ready : Promise.resolve(false); }
    function setBusy(kind) {
        $$('.st-ai').forEach(function (b) { b.disabled = !!kind; });
        $('#ai-retry').disabled = !!kind;
        var s = $('#ai-status');
        s.hidden = !kind;
        s.textContent = kind ? (T('Working on your') + ' ' + T(KIND_LABEL[kind]).toLowerCase() + '...') : '';
        $('#st-stage').classList.toggle('busy', !!kind);
    }
    function showAiNote(local) {
        var n = $('#ai-note'); n.hidden = !local; if (!local) return;
        if (needLogin()) { n.innerHTML = esc(T('AI is free for signed-in customers.')) + ' ' + LOGIN_HTML + ' ' + esc(T('A quick built-in tool was used for now.')); }
        else n.textContent = T('AI is not connected yet, so a quick built-in tool was used. Results are simpler. You can always ask our designer.');
    }
    function scaleTo(c, max) {
        var k = Math.min(1, max / Math.max(c.width, c.height)), o = makeCanvas(c.width * k, c.height * k), x = o.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0, o.width, o.height);
        return o;
    }
    function canvasBlob(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }
    function blobToCanvas(blob) {
        return new Promise(function (res, rej) {
            var u = URL.createObjectURL(blob), im = new Image();
            im.onload = function () { var k = Math.min(1, WORK / Math.max(im.width, im.height)), c = makeCanvas(im.width * k, im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c); };
            im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('bad image')); };
            im.src = u;
        });
    }
    /* white becomes transparent, dark becomes black ink */
    function bwToAlpha(c) {
        var o = makeCanvas(c.width, c.height), x = o.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0);
        var img = x.getImageData(0, 0, o.width, o.height), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            var l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            var a = clamp((215 - l) / 95, 0, 1);
            d[i] = d[i + 1] = d[i + 2] = 12; d[i + 3] = Math.round(a * 255);
        }
        x.putImageData(img, 0, 0);
        return o;
    }

    /* ------------------------------ 3. quick built-in tools ------------------------------ */
    function localVersion(kind, orig) {
        var src = orig.src;
        if (kind === 'cutout') {
            var mk = localCutout(src);
            return { kind: kind, label: 'Cut out (quick)', src: src, mask: mk, transparent: true };
        }
        if (kind === 'cartoon') {
            var mk2 = localCutout(src), cc = makeCartoon(src, 6, 55);
            return { kind: kind, label: 'Cartoon (quick)', src: cc, mask: mk2, transparent: true };
        }
        if (kind === 'engrave') return { kind: 'engrave', label: 'Engraving style (quick)', src: makeEngrave(src), transparent: true };
        return { kind: 'bw', label: 'Black & white (quick)', src: makeBW(src), transparent: true };
    }
    function localCutout(src) {
        var keep = { src: S.src, mask: S.mask, W: S.W, H: S.H, tol: S.tol };
        S.src = src; S.W = src.width; S.H = src.height; S.mask = new Uint8Array(S.W * S.H).fill(255); S.tol = 38;
        var m0 = maskFromCanvas(src).mask; for (var i = 0; i < m0.length; i++) S.mask[i] = m0[i];
        if (!autoRemove(true)) { /* nothing to remove: keep whole image */ }
        keepMain();
        var out = S.mask;
        S.src = keep.src; S.mask = keep.mask; S.W = keep.W; S.H = keep.H; S.tol = keep.tol;
        return out;
    }
    /* photo -> fine engraving: horizontal lines that get thicker where the picture is dark */
    function makeEngrave(src) {
        var w = src.width, h = src.height, c = makeCanvas(w, h), x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0);
        var d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), hist = new Uint32Array(256);
        for (var i = 0; i < w * h; i++) { g[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]; hist[g[i] | 0]++; }
        var p5 = 0, p95 = 255, acc = 0;
        for (var t = 0; t < 256; t++) { acc += hist[t]; if (acc < w * h * 0.04) p5 = t; if (acc < w * h * 0.96) p95 = t; }
        p5 = Math.min(p5, 90); p95 = Math.max(p95, 170);
        var rng = Math.max(50, p95 - p5), sp = Math.max(4, Math.round(Math.max(w, h) / 120)), out = new Uint8ClampedArray(w * h * 4);
        for (var y = 0; y < h; y++) {
            var ph = (y % sp) / sp, dist = Math.abs(ph - 0.5) * 2;           // 0 on the line centre, 1 between lines
            for (var xx = 0; xx < w; xx++) {
                var o = y * w + xx, dark = 1 - clamp((g[o] - p5) / rng, 0, 1);
                dark = Math.pow(dark, 0.85);
                var ink = dist < dark * 1.05 - 0.02 ? 1 : 0;
                out[o * 4] = out[o * 4 + 1] = out[o * 4 + 2] = 12; out[o * 4 + 3] = ink ? 255 : 0;
            }
        }
        x.clearRect(0, 0, w, h); x.putImageData(new ImageData(out, w, h), 0, 0);
        return c;
    }
    function makeBW(src) {
        var w = src.width, h = src.height, c = makeCanvas(w, h), x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0);
        var d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), hist = new Uint32Array(256);
        for (var i = 0; i < w * h; i++) { g[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]; hist[g[i] | 0]++; }
        var p10 = 0, p90 = 255, acc = 0;
        for (var t = 0; t < 256; t++) { acc += hist[t]; if (acc < w * h * 0.08) p10 = t; if (acc < w * h * 0.92) p90 = t; }
        p10 = Math.min(p10, 90); p90 = Math.max(p90, 170);                  // logos are mostly white: keep a sensible black and white point
        var rng = Math.max(40, p90 - p10), out = new Uint8ClampedArray(w * h * 4);
        for (var y = 1; y < h - 1; y++) for (var xx = 1; xx < w - 1; xx++) {
            var o = y * w + xx, l = clamp((g[o] - p10) / rng, 0, 1);
            var gx = -g[o - w - 1] - 2 * g[o - 1] - g[o + w - 1] + g[o - w + 1] + 2 * g[o + 1] + g[o + w + 1];
            var gy = -g[o - w - 1] - 2 * g[o - w] - g[o - w + 1] + g[o + w - 1] + 2 * g[o + w] + g[o + w + 1];
            var edge = clamp(Math.sqrt(gx * gx + gy * gy) / 220, 0, 1);
            var ink = clamp(1.7 * (0.46 - l) + 0.9 * edge, 0, 1);
            var a = clamp((ink - 0.3) / 0.25, 0, 1);
            out[o * 4] = out[o * 4 + 1] = out[o * 4 + 2] = 12; out[o * 4 + 3] = Math.round(a * 255);
        }
        x.putImageData(new ImageData(out, w, h), 0, 0);
        var r = makeCanvas(w, h); r.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
        return r;
    }
    function pushUndo() { }

    function srcData() { return S.src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, S.W, S.H).data; }
    function tolDist() { return 8 + (S.tol / 100) * 110; }

    function autoRemove(silent) {
        var W = S.W, H = S.H, d = srcData(), N = W * H;
        if (!silent) pushUndo();
        // reference colours: the most common colours around the edge
        var hist = {}, ring = [];
        function add(x, y) { var i = (y * W + x) * 4; ring.push(i); var k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4); hist[k] = (hist[k] || 0) + 1; }
        for (var x = 0; x < W; x++) { add(x, 0); add(x, H - 1); }
        for (var y = 1; y < H - 1; y++) { add(0, y); add(W - 1, y); }
        var keys = Object.keys(hist).sort(function (a, b) { return hist[b] - hist[a]; });
        var refs = [];
        keys.slice(0, 3).forEach(function (k) {
            if (hist[k] < ring.length * 0.08) return;
            var p = k.split(',').map(function (v) { return (+v) * 16 + 8; });
            refs.push(p);
        });
        if (!refs.length) { if (!silent) toastMsg(T('The background is too busy to remove automatically. Try the Magic remove tool.')); return false; }
        var tol = silent ? 34 : tolDist(), tol2 = tol * tol;
        function near(i) {
            for (var r = 0; r < refs.length; r++) {
                var dr = d[i] - refs[r][0], dg = d[i + 1] - refs[r][1], db = d[i + 2] - refs[r][2];
                if (dr * dr + dg * dg + db * db <= tol2) return true;
            }
            return false;
        }
        var seen = new Uint8Array(N), stack = new Int32Array(N), sp = 0, removed = 0;
        function seed(x, y) { var p = y * W + x; if (!seen[p] && near(p * 4)) { seen[p] = 1; stack[sp++] = p; } }
        for (var x2 = 0; x2 < W; x2++) { seed(x2, 0); seed(x2, H - 1); }
        for (var y2 = 0; y2 < H; y2++) { seed(0, y2); seed(W - 1, y2); }
        while (sp) {
            var p = stack[--sp], px = p % W, py = (p / W) | 0;
            removed++;
            if (px > 0) { var a = p - 1; if (!seen[a] && near(a * 4)) { seen[a] = 1; stack[sp++] = a; } }
            if (px < W - 1) { var b = p + 1; if (!seen[b] && near(b * 4)) { seen[b] = 1; stack[sp++] = b; } }
            if (py > 0) { var c = p - W; if (!seen[c] && near(c * 4)) { seen[c] = 1; stack[sp++] = c; } }
            if (py < H - 1) { var e = p + W; if (!seen[e] && near(e * 4)) { seen[e] = 1; stack[sp++] = e; } }
        }
        if (removed > N * 0.97) { if (!silent) toastMsg(T('Almost everything would be removed. Lower the background sensitivity.')); return false; }
        for (var i = 0; i < N; i++) if (seen[i]) S.mask[i] = 0;
        peelEdge(seen);
        return removed > N * 0.02;
    }
    /* removes the one-pixel halo of background colour left around the subject */
    function peelEdge(bg) {
        var W = S.W, H = S.H, kill = [];
        for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
            var p = y * W + x;
            if (S.mask[p] && (!S.mask[p - 1] || !S.mask[p + 1] || !S.mask[p - W] || !S.mask[p + W])) kill.push(p);
        }
        // only peel light-halo edges that sit next to removed background
        var d = srcData();
        kill.forEach(function (p) { var i = p * 4; if (d[i] + d[i + 1] + d[i + 2] > 690) S.mask[p] = 0; });
    }

    function components() {
        var W = S.W, H = S.H, N = W * H, lab = new Int32Array(N), list = [], stack = new Int32Array(N);
        for (var s = 0; s < N; s++) {
            if (!S.mask[s] || lab[s]) continue;
            var id = list.length + 1, sp = 0, cnt = 0;
            lab[s] = id; stack[sp++] = s;
            while (sp) {
                var p = stack[--sp]; cnt++;
                var x = p % W;
                if (x > 0 && S.mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
                if (x < W - 1 && S.mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
                if (p >= W && S.mask[p - W] && !lab[p - W]) { lab[p - W] = id; stack[sp++] = p - W; }
                if (p < N - W && S.mask[p + W] && !lab[p + W]) { lab[p + W] = id; stack[sp++] = p + W; }
            }
            list.push(cnt);
        }
        return { lab: lab, sizes: list };
    }
    function keepMain() {
        pushUndo();
        var c = components(), big = 0;
        c.sizes.forEach(function (n) { if (n > big) big = n; });
        if (!big) return;
        for (var i = 0; i < c.lab.length; i++) {
            if (!c.lab[i]) continue;
            if (c.sizes[c.lab[i] - 1] < big * 0.12) S.mask[i] = 0;
        }
    }


    function makeCartoon(src0, levels, line) {
        var k = Math.min(1, 640 / Math.max(src0.width, src0.height)), w = Math.round(src0.width * k), h = Math.round(src0.height * k);
        var c = makeCanvas(w, h), cx = c.getContext('2d');
        cx.imageSmoothingQuality = 'high';
        // flatten transparent areas to white so they do not create dark edges
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(src0, 0, 0, w, h);
        var img = cx.getImageData(0, 0, w, h), a = img.data;
        // bilateral smoothing (2 passes)
        var R = 3, sc = 2 * 28 * 28;
        for (var pass = 0; pass < 2; pass++) {
            var out = new Uint8ClampedArray(a.length);
            for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
                var i = (y * w + x) * 4, sr = 0, sg = 0, sb = 0, sw = 0;
                for (var dy = -R; dy <= R; dy++) {
                    var yy = y + dy; if (yy < 0 || yy >= h) continue;
                    for (var dx = -R; dx <= R; dx++) {
                        var xx = x + dx; if (xx < 0 || xx >= w) continue;
                        var j = (yy * w + xx) * 4, dr = a[j] - a[i], dg = a[j + 1] - a[i + 1], db = a[j + 2] - a[i + 2];
                        var wt = Math.exp(-(dr * dr + dg * dg + db * db) / sc - (dx * dx + dy * dy) / 12);
                        sr += a[j] * wt; sg += a[j + 1] * wt; sb += a[j + 2] * wt; sw += wt;
                    }
                }
                out[i] = sr / sw; out[i + 1] = sg / sw; out[i + 2] = sb / sw; out[i + 3] = 255;
            }
            a = out;
        }
        // grey map for the outlines (before flattening)
        var gray = new Float32Array(w * h);
        for (var p = 0; p < w * h; p++) gray[p] = 0.3 * a[p * 4] + 0.59 * a[p * 4 + 1] + 0.11 * a[p * 4 + 2];
        // flatten colours + lift saturation a little
        var step = 255 / (levels - 1);
        for (var q = 0; q < w * h; q++) {
            var r = a[q * 4], g = a[q * 4 + 1], b = a[q * 4 + 2], m = (r + g + b) / 3;
            r = m + (r - m) * 1.25; g = m + (g - m) * 1.25; b = m + (b - m) * 1.25;
            a[q * 4] = clamp(Math.round(r / step) * step, 0, 255);
            a[q * 4 + 1] = clamp(Math.round(g / step) * step, 0, 255);
            a[q * 4 + 2] = clamp(Math.round(b / step) * step, 0, 255);
        }
        if (line > 0) {
            var th = 95 - line * 0.7;
            for (var yy2 = 1; yy2 < h - 1; yy2++) for (var xx2 = 1; xx2 < w - 1; xx2++) {
                var o = yy2 * w + xx2;
                var gx = -gray[o - w - 1] - 2 * gray[o - 1] - gray[o + w - 1] + gray[o - w + 1] + 2 * gray[o + 1] + gray[o + w + 1];
                var gy = -gray[o - w - 1] - 2 * gray[o - w] - gray[o - w + 1] + gray[o + w - 1] + 2 * gray[o + w] + gray[o + w + 1];
                var mag = Math.sqrt(gx * gx + gy * gy) / 4;
                if (mag > th * 0.55) {
                    var t = clamp((mag - th * 0.55) / (th * 0.6), 0, 1), i2 = o * 4;
                    a[i2] = a[i2] * (1 - t) + 42 * t; a[i2 + 1] = a[i2 + 1] * (1 - t) + 26 * t; a[i2 + 2] = a[i2 + 2] * (1 - t) + 29 * t;
                }
            }
        }
        var res = new ImageData(a, w, h);
        cx.putImageData(res, 0, 0);
        var full = makeCanvas(src0.width, src0.height), fx = full.getContext('2d');
        fx.imageSmoothingQuality = 'high'; fx.drawImage(c, 0, 0, src0.width, src0.height);
        return full;
    }

    /* builds the artwork canvas: the working image (or cartoon) with the mask as its transparency */

    function renderArtRect(x, y, w, h) {
        var base = S.src;
        x = Math.max(0, x | 0); y = Math.max(0, y | 0); w = Math.min(S.W - x, w | 0); h = Math.min(S.H - y, h | 0);
        if (w < 1 || h < 1) return;
        var cx = S.art.getContext('2d');
        cx.clearRect(x, y, w, h);
        cx.drawImage(base, x, y, w, h, x, y, w, h);
        var img = cx.getImageData(x, y, w, h), d = img.data, W = S.W, H = S.H, m = S.mask;
        for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
            var gx = x + xx, gy = y + yy, p = gy * W + gx, v = m[p];
            if (gx > 0 && gx < W - 1 && gy > 0 && gy < H - 1 && (v !== m[p - 1] || v !== m[p + 1] || v !== m[p - W] || v !== m[p + W])) {
                v = (m[p] * 4 + m[p - 1] + m[p + 1] + m[p - W] + m[p + W]) / 8;
            }
            var i = (yy * w + xx) * 4;
            d[i + 3] = Math.min(d[i + 3], v);
        }
        cx.putImageData(img, x, y);
    }
    function rebuildArt() {
        if (!S.src) return;
        if (!S.art) S.art = makeCanvas(S.W, S.H);
        renderArtRect(0, 0, S.W, S.H);
        artChanged();
    }
    function artChanged() { S.artVer = (S.artVer || 0) + 1; cutCache = null; updateBBox(); }
    var cutCache = null;

    /* the part of the image that is actually kept: placement works on this box */
    function updateBBox() {
        var W = S.W, H = S.H, m = S.mask, x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (var y = 0; y < H; y++) {
            var row = y * W;
            for (var x = 0; x < W; x++) if (m[row + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        var old = S.cb;
        if (x1 < 0) { S.cb = { x: 0, y: 0, w: W, h: H, empty: true }; }
        else S.cb = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
        if (old && !old.empty && !S.cb.empty && old.w !== S.cb.w) S.p.w = S.p.w * S.cb.w / old.w;
    }

    function hasArt() { for (var i = 0; i < S.mask.length; i += 7) if (S.mask[i]) return true; return false; }

    /* ------------------------------ 5. cut line ------------------------------ */
    var CPPM = 8;          // pixels per mm for the cut-line maths
    SHAPES.forEach(function (s) {            // exact box of each shape, measured once
        var c = makeCanvas(160, 160), x = c.getContext('2d');
        x.translate(30, 30); x.fill(s.path);
        var d = x.getImageData(0, 0, 160, 160).data, x0 = 160, y0 = 160, x1 = 0, y1 = 0;
        for (var y = 0; y < 160; y++) for (var xx = 0; xx < 160; xx++) if (d[(y * 160 + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        s.box = [x0 - 30, y0 - 30, x1 + 1 - 30, y1 + 1 - 30];
    });

    function dilate(src, r) {
        if (r < 0.5) { var same = makeCanvas(src.width, src.height); same.getContext('2d').drawImage(src, 0, 0); return same; }
        var out = makeCanvas(src.width, src.height), cx = out.getContext('2d');
        cx.drawImage(src, 0, 0);
        [r, r * 0.5].forEach(function (rr) {
            var n = clamp(Math.ceil(Math.PI * 2 * rr / 1.1), 12, 140);
            for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; cx.drawImage(src, Math.cos(a) * rr, Math.sin(a) * rr); }
        });
        return out;
    }
    function invert(src) {
        var out = makeCanvas(src.width, src.height), cx = out.getContext('2d');
        cx.fillStyle = '#000'; cx.fillRect(0, 0, out.width, out.height);
        cx.globalCompositeOperation = 'destination-out'; cx.drawImage(src, 0, 0);
        return out;
    }
    function erode(src, r) { return r < 0.5 ? src : invert(dilate(invert(src), r)); }

    function drawArtTransformed(cx, ppm, ox, oy, p) {
        var k = p.w * ppm / S.cb.w;
        cx.save();
        cx.translate(ox, oy);
        cx.rotate(p.rot * Math.PI / 180);
        cx.scale(k, k);
        cx.translate(-(S.cb.x + S.cb.w / 2), -(S.cb.y + S.cb.h / 2));
        cx.drawImage(S.art, 0, 0);
        cx.restore();
    }

    /* binary silhouette (alpha 255/0) of the artwork, centred in a canvas */
    function artSilhouette(sizePx, off) {
        var c = makeCanvas(sizePx, sizePx), cx = c.getContext('2d');
        drawArtTransformed(cx, CPPM, sizePx / 2, sizePx / 2, { w: S.p.w, rot: S.p.rot });
        var img = cx.getImageData(0, 0, sizePx, sizePx), d = img.data;
        for (var i = 3; i < d.length; i += 4) { d[i - 3] = d[i - 2] = d[i - 1] = 0; d[i] = d[i] > 40 ? 255 : 0; }
        cx.putImageData(img, 0, 0);
        return c;
    }

    function fillHolesAndTrace(canvas) {
        var w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, N = w * h;
        var bin = new Uint8Array(N);
        for (var i = 0; i < N; i++) bin[i] = d[i * 4 + 3] > 127 ? 1 : 0;
        // fill holes: flood the outside, everything else is inside
        var out = new Uint8Array(N), stack = new Int32Array(N), sp = 0;
        function seed(x, y) { var p = y * w + x; if (!bin[p] && !out[p]) { out[p] = 1; stack[sp++] = p; } }
        for (var x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
        for (var y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
        while (sp) {
            var p = stack[--sp], px = p % w;
            if (px > 0 && !bin[p - 1] && !out[p - 1]) { out[p - 1] = 1; stack[sp++] = p - 1; }
            if (px < w - 1 && !bin[p + 1] && !out[p + 1]) { out[p + 1] = 1; stack[sp++] = p + 1; }
            if (p >= w && !bin[p - w] && !out[p - w]) { out[p - w] = 1; stack[sp++] = p - w; }
            if (p < N - w && !bin[p + w] && !out[p + w]) { out[p + w] = 1; stack[sp++] = p + w; }
        }
        for (var j = 0; j < N; j++) bin[j] = out[j] ? 0 : 1;
        // largest separate piece + how many significant pieces there are
        var lab = new Int32Array(N), sizes = [], startAt = [];
        for (var s0 = 0; s0 < N; s0++) {
            if (!bin[s0] || lab[s0]) continue;
            var id = sizes.length + 1, cnt = 0; sp = 0; lab[s0] = id; stack[sp++] = s0;
            while (sp) {
                var q = stack[--sp]; cnt++; var qx = q % w;
                if (qx > 0 && bin[q - 1] && !lab[q - 1]) { lab[q - 1] = id; stack[sp++] = q - 1; }
                if (qx < w - 1 && bin[q + 1] && !lab[q + 1]) { lab[q + 1] = id; stack[sp++] = q + 1; }
                if (q >= w && bin[q - w] && !lab[q - w]) { lab[q - w] = id; stack[sp++] = q - w; }
                if (q < N - w && bin[q + w] && !lab[q + w]) { lab[q + w] = id; stack[sp++] = q + w; }
            }
            sizes.push(cnt); startAt.push(s0);
        }
        if (!sizes.length) return { poly: [], pieces: 0, area: 0 };
        var big = 0; sizes.forEach(function (n, k) { if (n > sizes[big]) big = k; });
        var pieces = sizes.filter(function (n) { return n > sizes[big] * 0.03; }).length;
        var only = new Uint8Array(N);
        for (var t = 0; t < N; t++) only[t] = lab[t] === big + 1 ? 1 : 0;
        return { poly: traceContour(only, w, h), pieces: pieces, area: sizes[big], bin: only };
    }

    function traceContour(bin, w, h) {
        var sx = -1, sy = -1;
        outer: for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (bin[y * w + x]) { sx = x; sy = y; break outer; }
        if (sx < 0) return [];
        var D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        function fg(x, y) { return x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x] === 1; }
        var cx = sx, cy = sy, bx = sx - 1, by = sy, pts = [], guard = 0, limit = w * h * 2;
        do {
            pts.push([cx, cy]);
            var k = 0;
            for (var i = 0; i < 8; i++) if (cx + D[i][0] === bx && cy + D[i][1] === by) { k = i; break; }
            var found = false;
            for (var j = 1; j <= 8; j++) {
                var d = (k + j) % 8, nx = cx + D[d][0], ny = cy + D[d][1];
                if (fg(nx, ny)) {
                    var pd = (d + 7) % 8;
                    bx = cx + D[pd][0]; by = cy + D[pd][1];
                    cx = nx; cy = ny; found = true; break;
                }
            }
            if (!found) break;
        } while ((cx !== sx || cy !== sy) && ++guard < limit);
        return pts;
    }

    function simplify(pts, eps) {
        if (pts.length < 4) return pts;
        function dp(a, b) {
            var maxD = 0, idx = -1, x1 = pts[a][0], y1 = pts[a][1], x2 = pts[b][0], y2 = pts[b][1], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
            for (var i = a + 1; i < b; i++) { var d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > maxD) { maxD = d; idx = i; } }
            if (maxD > eps) return dp(a, idx).slice(0, -1).concat(dp(idx, b));
            return [pts[a], pts[b]];
        }
        var half = pts.length >> 1;
        var A = dp(0, half), B = dp(half, pts.length - 1);
        return A.slice(0, -1).concat(B);
    }
    function chaikin(pts, n) {
        for (var it = 0; it < n; it++) {
            var out = [];
            for (var i = 0; i < pts.length; i++) {
                var a = pts[i], b = pts[(i + 1) % pts.length];
                out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
            }
            pts = out;
        }
        return pts;
    }
    function toMM(pts, w, h) { return pts.map(function (p) { return [(p[0] + 0.5 - w / 2) / CPPM, (p[1] + 0.5 - h / 2) / CPPM]; }); }
    function shift(poly, dx, dy) { return poly.map(function (p) { return [p[0] + dx, p[1] + dy]; }); }
    function bbox(poly) {
        var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        poly.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
        return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
    }

    /* the cut outline around its own centre (cached) */
    function cutBase() {
        if (S.finish === 'print') return null;
        var key;
        if (S.finish === 'around') key = ['a', S.artVer, num(S.p.w, 2), num(S.p.rot, 1), num(S.off, 2), num(S.smooth, 2)].join('|');
        else key = ['s', S.shape, num(S.sh.w, 2), num(S.sh.prop, 3)].join('|');
        if (cutCache && cutCache.key === key) return cutCache;
        var res = { key: key, poly: [], safe: [], pieces: 1 };
        if (S.finish === 'around') {
            var ext = Math.hypot(S.p.w, artH()) / 2 + S.off + S.smooth + 3, size = Math.ceil(ext * 2 * CPPM);
            size = Math.min(size, 1400);
            var sil = artSilhouette(size);
            var grown = dilate(sil, (S.off + S.smooth) * CPPM);
            if (S.smooth > 0.2) grown = erode(grown, S.smooth * CPPM);
            var t = fillHolesAndTrace(grown);
            res.pieces = t.pieces;
            res.poly = toMM(chaikin(simplify(t.poly, 0.9), 2), size, size);
            res.safe = res.poly;
        } else {
            var sh = shapeById(S.shape), w = S.sh.w, h = S.sh.w * S.sh.prop, pad = 4;
            var cw = Math.ceil((w + pad * 2) * CPPM), ch = Math.ceil((h + pad * 2) * CPPM);
            var c = makeCanvas(cw, ch), cx = c.getContext('2d');
            function fillShape(cx2, ww, hh) {
                var bx = sh.box;
                cx2.save(); cx2.translate(cw / 2, ch / 2);
                cx2.scale(ww * CPPM / (bx[2] - bx[0]), hh * CPPM / (bx[3] - bx[1]));
                cx2.translate(-(bx[0] + bx[2]) / 2, -(bx[1] + bx[3]) / 2);
                cx2.fill(sh.path); cx2.restore();
            }
            cx.fillStyle = '#000'; fillShape(cx, w, h);
            var t1 = fillHolesAndTrace(c);
            res.poly = toMM(simplify(t1.poly, 0.45), cw, ch);
            var inner = erode(c, SAFE * CPPM), t2 = fillHolesAndTrace(inner);
            res.safe = t2.poly.length ? toMM(simplify(t2.poly, 0.45), cw, ch) : [];
            res.pieces = 1;
        }
        cutCache = res;
        return res;
    }
    /* cut outline in cake coordinates (mm, origin top-left) */
    function getCut() {
        var b = cutBase();
        if (!b || !b.poly.length) return null;
        var cx = S.finish === 'around' ? S.p.x : S.sh.x, cy = S.finish === 'around' ? S.p.y : S.sh.y;
        var poly = shift(b.poly, cx, cy), safe = b.safe && b.safe.length ? shift(b.safe, cx, cy) : null;
        return { poly: poly, safe: safe, box: bbox(poly), pieces: b.pieces, conn: connector(poly) };
    }
    /* a thin bridge from the cut to the nearest cake edge, so the die can cut in one path */
    function connector(poly) {
        var W = surfW(), H = surfH(), b = bbox(poly);
        var gaps = [
            { g: H - b.y1, side: 'bottom' }, { g: b.y0, side: 'top' }, { g: b.x0, side: 'left' }, { g: W - b.x1, side: 'right' }
        ];
        gaps.sort(function (a, c) { return a.g - c.g; });
        var bottom = gaps.filter(function (g) { return g.side === 'bottom'; })[0];
        if (S.orient === 'portrait' && bottom.g <= gaps[0].g + 6) gaps.unshift(bottom);
        var best = gaps[0], pt;
        if (best.side === 'bottom') { pt = poly.reduce(function (m, p) { return p[1] > m[1] ? p : m; }, poly[0]); return { a: pt, b: [pt[0], H], gap: best.g }; }
        if (best.side === 'top') { pt = poly.reduce(function (m, p) { return p[1] < m[1] ? p : m; }, poly[0]); return { a: pt, b: [pt[0], 0], gap: best.g }; }
        if (best.side === 'left') { pt = poly.reduce(function (m, p) { return p[0] < m[0] ? p : m; }, poly[0]); return { a: pt, b: [0, pt[1]], gap: best.g }; }
        pt = poly.reduce(function (m, p) { return p[0] > m[0] ? p : m; }, poly[0]); return { a: pt, b: [W, pt[1]], gap: best.g };
    }


    /* ------------------------------ 6. drawing ------------------------------ */
    var FIT = { circle: .72, square: .96, rounded: .94, heart: .66, clover: .7, star: .55, scallop: .8, hexagon: .85, drop: .6, cloud: .72, arch: .8 };

    function polyPath(cx, poly, ppm, keep) {
        if (!keep) cx.beginPath();
        poly.forEach(function (p, i) { if (i) cx.lineTo(p[0] * ppm, p[1] * ppm); else cx.moveTo(p[0] * ppm, p[1] * ppm); });
        cx.closePath();
    }
    function roundRect(cx, x, y, w, h, r) {
        cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
    }
    var goldCache = {};
    function goldTexture(W, H, ppm) {
        var key = W + 'x' + H + '@' + ppm; if (goldCache[key]) return goldCache[key];
        var c = document.createElement('canvas'); c.width = Math.max(2, Math.round(W * ppm)); c.height = Math.max(2, Math.round(H * ppm));
        var x = c.getContext('2d'), w = c.width, h = c.height;
        var g = x.createLinearGradient(0, 0, w, h);
        [[0, '#9A722A'], [.14, '#D8B455'], [.3, '#F6E5A3'], [.46, '#C99F3F'], [.62, '#E9CC7C'], [.8, '#B58B34'], [1, '#E3C26C']].forEach(function (a) { g.addColorStop(a[0], a[1]); });
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        // soft sheen band, like light moving across polished gold
        var sh = x.createLinearGradient(w * .1, 0, w * .9, h * .55);
        sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.42, 'rgba(255,248,214,0)'); sh.addColorStop(.5, 'rgba(255,248,214,.5)'); sh.addColorStop(.58, 'rgba(255,248,214,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = sh; x.fillRect(0, 0, w, h);
        // fine brushed lines + speckle (seeded so it never flickers)
        var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
        for (var i = 0; i < h; i += 1) { if (rnd() < .55) { x.fillStyle = rnd() < .5 ? 'rgba(255,245,200,' + (rnd() * .10) + ')' : 'rgba(110,75,15,' + (rnd() * .08) + ')'; x.fillRect(0, i, w, 1); } }
        for (var k = 0; k < w * h / 90; k++) { x.fillStyle = rnd() < .5 ? 'rgba(255,255,235,' + (rnd() * .18) + ')' : 'rgba(90,60,10,' + (rnd() * .14) + ')'; x.fillRect(rnd() * w, rnd() * h, 1, 1); }
        // bevelled edge
        x.lineWidth = Math.max(1, ppm * .35); x.strokeStyle = 'rgba(255,248,214,.75)'; x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
        x.strokeStyle = 'rgba(100,70,15,.35)'; x.strokeRect(x.lineWidth * 1.5, x.lineWidth * 1.5, w - x.lineWidth * 3, h - x.lineWidth * 3);
        goldCache[key] = c; return c;
    }
    var cakeCache = {};
    function cakeTexture(W, H, ppm) {
        var key = W + 'x' + H + '@' + ppm; if (cakeCache[key]) return cakeCache[key];
        var c = document.createElement('canvas'); c.width = Math.max(2, Math.round(W * ppm)); c.height = Math.max(2, Math.round(H * ppm));
        var x = c.getContext('2d'), w = c.width, h = c.height;
        var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#FFFCF6'); g.addColorStop(.55, '#F8F2E6'); g.addColorStop(1, '#EFE5D1');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
        // the fine layers of the sponge
        var step = Math.max(3, ppm * 0.95);
        for (var y = step / 2; y < h; y += step) { x.fillStyle = 'rgba(176,132,86,' + (0.07 + rnd() * 0.08) + ')'; x.fillRect(0, y, w, Math.max(1, ppm * 0.16)); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, y + ppm * 0.2, w, 1); }
        // tiny air pockets
        for (var k = 0; k < w * h / 140; k++) { x.fillStyle = rnd() < .6 ? 'rgba(170,130,90,' + (rnd() * .10) + ')' : 'rgba(255,255,255,' + (rnd() * .45) + ')'; var r = .5 + rnd() * 1.1; x.beginPath(); x.arc(rnd() * w, rnd() * h, r, 0, 7); x.fill(); }
        // soft light and a gentle shaded edge, like a thick slice
        var v = x.createRadialGradient(w * .4, h * .35, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .75); v.addColorStop(0, 'rgba(255,255,255,.28)'); v.addColorStop(1, 'rgba(120,85,45,.14)');
        x.fillStyle = v; x.fillRect(0, 0, w, h);
        x.lineWidth = Math.max(1.5, ppm * .35); x.strokeStyle = 'rgba(150,110,70,.28)'; x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
        cakeCache[key] = c; return c;
    }
    function ivoryFill(cx, W, H, ppm) {
        if (!ISCAKE) { cx.fillStyle = cx.createPattern(goldTexture(W, H, ppm), 'no-repeat'); return; }
        cx.fillStyle = cx.createPattern(cakeTexture(W, H, ppm), 'no-repeat');
    }
    function artBox(cx, ppm) {
        var w = S.p.w * ppm, h = artH() * ppm;
        cx.save(); cx.translate(S.p.x * ppm, S.p.y * ppm); cx.rotate(S.p.rot * Math.PI / 180);
        cx.strokeStyle = 'rgba(30,120,160,.65)'; cx.lineWidth = 1.2; cx.setLineDash([5, 4]);
        cx.strokeRect(-w / 2, -h / 2, w, h);
        cx.restore();
    }

    function drawScene(cv, ppm, mode, opts) {
        opts = opts || {};
        var W = surfW(), H = surfH();
        var framed = mode !== 'print' && !opts.bare, FO = frameOff(), FF = frameF();
        cv.width = Math.round((framed ? FF : W) * ppm); cv.height = Math.round((framed ? FF : H) * ppm);
        var cx = cv.getContext('2d');
        cx.clearRect(0, 0, cv.width, cv.height);
        if (framed) cx.translate(FO.x * ppm, FO.y * ppm);
        cx.imageSmoothingQuality = 'high';
        var cut = S.finish === 'print' ? null : getCut();

        if (mode === 'print') {
            cx.save(); cx.beginPath(); cx.rect(BORDER * ppm, BORDER * ppm, (W - 2 * BORDER) * ppm, (H - 2 * BORDER) * ppm); cx.clip();
            drawArtTransformed(cx, ppm, S.p.x * ppm, S.p.y * ppm, S.p);
            cx.restore();
            return cut;
        }

        if (mode === 'edit') {
            roundRect(cx, 0, 0, W * ppm, H * ppm, 0.8 * ppm); ivoryFill(cx, W, H, ppm); cx.fill();
            cx.save(); cx.beginPath(); cx.rect(BORDER * ppm, BORDER * ppm, (W - 2 * BORDER) * ppm, (H - 2 * BORDER) * ppm); cx.clip();
            drawArtTransformed(cx, ppm, S.p.x * ppm, S.p.y * ppm, S.p);
            cx.restore();
            // unprinted outer edge
            if (MARGIN > 0) { cx.save(); cx.fillStyle = 'rgba(200,70,70,.10)'; cx.beginPath(); cx.rect(0, 0, W * ppm, H * ppm); cx.rect(MARGIN * ppm, MARGIN * ppm, (W - 2 * MARGIN) * ppm, (H - 2 * MARGIN) * ppm); cx.fill('evenodd');
            cx.strokeStyle = 'rgba(200,70,70,.55)'; cx.lineWidth = 1.2; cx.setLineDash([4, 4]); cx.strokeRect(MARGIN * ppm, MARGIN * ppm, (W - 2 * MARGIN) * ppm, (H - 2 * MARGIN) * ppm);
            cx.setLineDash([]); cx.fillStyle = 'rgba(150,40,40,.8)'; cx.font = '600 ' + Math.round(ppm * 0.9) + 'px sans-serif'; cx.textAlign = 'center'; cx.fillText(MARGIN + ' mm', W * ppm / 2, MARGIN * ppm * 0.7); cx.restore(); }
            if (cut) {
                // dim what will be cut away
                cx.save(); cx.fillStyle = 'rgba(70,50,40,.30)'; cx.beginPath(); cx.rect(0, 0, W * ppm, H * ppm); polyPath(cx, cut.poly, ppm, true); cx.fill('evenodd'); cx.restore();
                if (S.finish === 'shape' && cut.safe) {
                    polyPath(cx, cut.safe, ppm); cx.save(); cx.setLineDash([6, 5]); cx.lineWidth = 1.4; cx.strokeStyle = '#1b7fa6'; cx.stroke(); cx.restore();
                }
                polyPath(cx, cut.poly, ppm); cx.lineWidth = 1.8; cx.strokeStyle = '#3a2a2e'; cx.stroke();
                if (cut.conn.gap > 0.4) { cx.beginPath(); cx.moveTo(cut.conn.a[0] * ppm, cut.conn.a[1] * ppm); cx.lineTo(cut.conn.b[0] * ppm, cut.conn.b[1] * ppm); cx.lineWidth = 1.6; cx.stroke(); }
            }
            artBox(cx, ppm);
            return cut;
        }

        /* preview: the finished cake */
        if (!cut) {
            roundRect(cx, 0, 0, W * ppm, H * ppm, 0.8 * ppm); ivoryFill(cx, W, H, ppm); cx.fill();
            cx.strokeStyle = 'rgba(90,70,60,.55)'; cx.lineWidth = 1.5; cx.stroke();
            cx.save(); cx.beginPath(); cx.rect(BORDER * ppm, BORDER * ppm, (W - 2 * BORDER) * ppm, (H - 2 * BORDER) * ppm); cx.clip();
            cx.globalCompositeOperation = 'multiply'; cx.globalAlpha = ISCAKE ? 0.86 : 0.94;
            drawArtTransformed(cx, ppm, S.p.x * ppm, S.p.y * ppm, S.p);
            cx.restore();
            return null;
        }
        // the part that is cut away is shown faintly
        cx.save(); roundRect(cx, 0, 0, W * ppm, H * ppm, 0.8 * ppm); cx.fillStyle = 'rgba(160,140,120,.14)'; cx.fill();
        cx.setLineDash([4, 4]); cx.strokeStyle = 'rgba(120,100,90,.35)'; cx.lineWidth = 1; cx.stroke(); cx.restore();
        cx.save(); polyPath(cx, cut.poly, ppm); cx.clip();
        ivoryFill(cx, W, H, ppm); cx.fillRect(0, 0, W * ppm, H * ppm);
        cx.save(); cx.beginPath(); cx.rect(BORDER * ppm, BORDER * ppm, (W - 2 * BORDER) * ppm, (H - 2 * BORDER) * ppm); cx.clip();
        cx.globalCompositeOperation = 'multiply'; cx.globalAlpha = ISCAKE ? 0.86 : 0.94;
        drawArtTransformed(cx, ppm, S.p.x * ppm, S.p.y * ppm, S.p);
        cx.restore(); cx.restore();
        if (opts.tol) {
            cx.save(); polyPath(cx, cut.poly, ppm); cx.lineJoin = 'round'; cx.lineWidth = TOL * 2 * ppm; cx.strokeStyle = 'rgba(214,60,60,.26)'; cx.stroke(); cx.restore();
        }
        polyPath(cx, cut.poly, ppm); cx.lineWidth = Math.max(1.3, ppm / 8); cx.strokeStyle = '#5f5357'; cx.stroke();
        if (cut.conn.gap > 0.4) { cx.beginPath(); cx.moveTo(cut.conn.a[0] * ppm, cut.conn.a[1] * ppm); cx.lineTo(cut.conn.b[0] * ppm, cut.conn.b[1] * ppm); cx.stroke(); }
        return cut;
    }


    /* ------------------------------ checks ------------------------------ */
    function runChecks() {
        var out = [], W = surfW(), H = surfH();
        if (!S.src || S.cb.empty) return [{ l: 'bad', t: T('There is no artwork left. Use Restore in step 2 or start again.') }];
        var ppmm = ((look() === 'original' ? S.origW : S.W) * (S.cb.w / S.W)) / S.p.w, dpi = ppmm * 25.4;
        if (dpi < 150) out.push({ l: 'warn', t: T('Your image is enlarged a lot (about') + ' ' + Math.round(dpi) + ' dpi). ' + T('The print may look soft. A larger original file gives a sharper result.') });
        else out.push({ l: 'ok', t: T('Image sharpness is good for printing.') });

        if (S.limited && MARGIN <= 0) out.push({ l: 'warn', t: T('The design is at the largest size that fits on the chocolate.') });
        else if (S.limited) out.push({ l: 'warn', t: T('The design is at the largest size that keeps') + ' ' + MARGIN + ' mm ' + T('clear on every side.') });
        var cut = S.finish === 'print' ? null : getCut();
        var A = makeCanvas(W * CPPM, H * CPPM), ax = A.getContext('2d');
        drawArtTransformed(ax, CPPM, S.p.x * CPPM, S.p.y * CPPM, S.p);
        function alphaCount(cv) { var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; }
        var total = alphaCount(A);
        if (!total) return [{ l: 'bad', t: ISCAKE ? T('Your artwork is outside the cake. Use Centre or Fit to cake.') : T('Your artwork is outside the chocolate. Use Centre or Fit.') }];

        var inner = makeCanvas(A.width, A.height), ix = inner.getContext('2d');
        ix.fillStyle = '#000'; ix.fillRect(BORDER * CPPM, BORDER * CPPM, A.width - 2 * BORDER * CPPM, A.height - 2 * BORDER * CPPM);
        var out1 = makeCanvas(A.width, A.height), o1 = out1.getContext('2d');
        o1.drawImage(A, 0, 0); o1.globalCompositeOperation = 'destination-out'; o1.drawImage(inner, 0, 0);
        if (alphaCount(out1) > total * 0.02) out.push({ l: 'warn', t: T('Part of the artwork reaches the outer edge of the cake. The outer 1.5 mm is not printed, so it will be trimmed.') });

        if (cut) {
            var region = makeCanvas(A.width, A.height), rx = region.getContext('2d');
            rx.fillStyle = '#000'; polyPath(rx, cut.poly, CPPM); rx.fill();
            var cropped = makeCanvas(A.width, A.height), cxx = cropped.getContext('2d');
            cxx.drawImage(A, 0, 0); cxx.globalCompositeOperation = 'destination-out'; cxx.drawImage(region, 0, 0);
            var cr = alphaCount(cropped) / total;
            if (S.finish === 'shape') {
                if (cr > 0.35) out.push({ l: 'bad', t: T('Most of your artwork is outside the cut shape and would be cut off. Make the shape bigger or the artwork smaller.') });
                else if (cr > 0.06) out.push({ l: 'warn', t: T('Some of the artwork is outside the cut shape and will be cut off.') });
                if (cut.safe) {
                    var safeC = makeCanvas(A.width, A.height), sx = safeC.getContext('2d');
                    sx.fillStyle = '#000'; polyPath(sx, cut.safe, CPPM); sx.fill();
                    var ring = makeCanvas(A.width, A.height), gx = ring.getContext('2d');
                    gx.drawImage(region, 0, 0); gx.globalCompositeOperation = 'destination-out'; gx.drawImage(safeC, 0, 0);
                    gx.globalCompositeOperation = 'destination-in'; gx.drawImage(A, 0, 0);
                    if (alphaCount(ring) > total * 0.04) out.push({ l: 'warn', t: T('Some artwork is inside the 2 mm safe margin. Background colour may cross the cut line, but keep logos, text and faces inside the dotted line.') });
                }
            } else if (cr > 0.02) {
                out.push({ l: 'warn', t: T('Fine parts of the artwork stick out beyond the cut line. Increase "Space around artwork".') });
            }
            var bx = cut.box;
            if (bx.x0 < BORDER - 0.2 || bx.y0 < BORDER - 0.2 || bx.x1 > W - BORDER + 0.2 || bx.y1 > H - BORDER + 0.2) out.push({ l: 'warn', t: T('The cut line touches the edge of the cake. Make the design a little smaller.') });
            if (Math.min(bx.w, bx.h) < 12) out.push({ l: 'warn', t: T('The cut is very small. Small details may be hard to produce.') });
            if (S.finish === 'around' && cut.pieces > 1) out.push({ l: 'warn', t: T('Your artwork has separate parts that are not connected. Increase "Smooth outline" so the cut stays in one piece.') });
        }
        if (out.every(function (o) { return o.l === 'ok'; })) out.push({ l: 'ok', t: T('Automatic check complete. Please confirm that everything essential sits inside the dotted line.') });
        return out;
    }
    function renderChecks(el, list) {
        el.innerHTML = list.map(function (c) { return '<li class="' + c.l + '"><span aria-hidden="true">' + (c.l === 'ok' ? '✓' : c.l === 'warn' ? '!' : '×') + '</span>' + esc(c.t) + '</li>'; }).join('');
    }
    var checkTimer = 0;
    function schedChecks() { clearTimeout(checkTimer); checkTimer = setTimeout(function () { try { renderChecks($('#pl-checks'), runChecks()); } catch (e) { } }, 220); }

    /* ------------------------------ 7. placement ------------------------------ */
    var sceneCv, rafScene = 0, drag = null, pointers = {};
    var FIT = { circle: .72, square: .96, rounded: .94, heart: .66, clover: .7, star: .55, scallop: .8, hexagon: .85, drop: .6, cloud: .72, arch: .8 };

    function usable() { var W = surfW(), H = surfH(); return { x0: MARGIN, y0: MARGIN, x1: W - MARGIN, y1: H - MARGIN, w: W - 2 * MARGIN, h: H - 2 * MARGIN }; }
    function rotBox(w) { var ar = S.cb.h / S.cb.w, r = S.p.rot * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r)); return { w: w * (c + ar * s), h: w * (s + ar * c) }; }

    /* nothing may pass the clear zone (5 mm on every side for the cake) */
    function enforce() {
        if (!S.cb || S.cb.empty) return;
        var u = usable(), lim = false, i, b;
        if (S.finish === 'shape') {
            var wmax = Math.min(u.w, u.h / S.sh.prop);
            if (S.sh.w > wmax + 0.01) { S.sh.w = wmax; lim = true; }
            b = cutBase(); b = b && b.poly.length ? bbox(b.poly) : { x0: -S.sh.w / 2, x1: S.sh.w / 2, y0: -S.sh.w * S.sh.prop / 2, y1: S.sh.w * S.sh.prop / 2 };
            S.sh.x = clamp(S.sh.x, u.x0 - b.x0, u.x1 - b.x1); S.sh.y = clamp(S.sh.y, u.y0 - b.y0, u.y1 - b.y1);
            S.p.x = clamp(S.p.x, u.x0, u.x1); S.p.y = clamp(S.p.y, u.y0, u.y1);
        } else if (S.finish === 'around') {
            for (i = 0; i < 4; i++) {
                b = cutBase(); b = b && b.poly.length ? bbox(b.poly) : null;
                if (!b || (b.w <= u.w + 0.02 && b.h <= u.h + 0.02)) break;
                S.p.w *= Math.min(u.w / b.w, u.h / b.h) * 0.99; lim = true; cutCache = null;
            }
            b = cutBase(); b = b && b.poly.length ? bbox(b.poly) : { x0: -S.p.w / 2, x1: S.p.w / 2, y0: -artH() / 2, y1: artH() / 2 };
            S.p.x = clamp(S.p.x, u.x0 - b.x0, u.x1 - b.x1); S.p.y = clamp(S.p.y, u.y0 - b.y0, u.y1 - b.y1);
        } else {
            var rb = rotBox(S.p.w);
            if (rb.w > u.w + 0.01 || rb.h > u.h + 0.01) { S.p.w *= Math.min(u.w / rb.w, u.h / rb.h); lim = true; rb = rotBox(S.p.w); }
            S.p.x = clamp(S.p.x, u.x0 + rb.w / 2, u.x1 - rb.w / 2); S.p.y = clamp(S.p.y, u.y0 + rb.h / 2, u.y1 - rb.h / 2);
        }
        S.limited = lim;
    }
    function fitArt() {
        if (!S.cb || S.cb.empty) return;
        var u = usable(), tw, th, ar = S.cb.h / S.cb.w, r = S.p.rot * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
        if (S.finish === 'shape') {
            var f = FIT[S.shape] || .75;
            tw = Math.min(S.sh.w - 2 * SAFE, S.sh.w * f); th = Math.min(S.sh.w * S.sh.prop - 2 * SAFE, S.sh.w * S.sh.prop * f);
            S.p.x = S.sh.x; S.p.y = S.sh.y;
        } else if (S.finish === 'around') {
            var pad = S.off + S.smooth * 0.4 + 0.3;
            tw = u.w - 2 * pad; th = u.h - 2 * pad; S.p.x = surfW() / 2; S.p.y = surfH() / 2;
        } else { tw = u.w; th = u.h; S.p.x = surfW() / 2; S.p.y = surfH() / 2; }
        S.p.w = clamp(Math.min(tw / (c + ar * s), th / (s + ar * c)), 4, 120);
        S.fitted = true;
    }
    function shapeLimits() {
        var wmax = Math.min(surfW() - 2 * MARGIN, (surfH() - 2 * MARGIN) / S.sh.prop);
        var r = $('#pl-ssize'); r.max = num(wmax, 1);
        S.sh.w = clamp(S.sh.w, 12, wmax);
    }
    function syncControls() {
        if (ISCAKE) shapeLimits();
        function set(id, v, label) { var r = $(id); if (r) r.value = v; var o = $(id + '-o'); if (o) o.textContent = label; }
        set('#pl-size', S.p.w, num(S.p.w, 1) + ' mm');
        set('#pl-rot', S.p.rot, Math.round(S.p.rot) + '°');
        if (ISCAKE) {
            set('#pl-ssize', S.sh.w, num(S.sh.w, 1) + ' mm');
            set('#pl-sprop', S.sh.prop * 100, Math.round(S.sh.prop * 100) + '%');
            set('#pl-off', S.off, num(S.off, 1) + ' mm');
            set('#pl-smooth', S.smooth, num(S.smooth, 1) + ' mm');
            $('#pl-shapes-wrap').hidden = S.finish !== 'shape';
            $('#pl-around-wrap').hidden = S.finish !== 'around';
            $('#pl-move-wrap').hidden = $('#pl-move-wrap2').hidden = S.finish !== 'shape';
            $$('#pl-shapes button').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.id === S.shape ? 'true' : 'false'); b.classList.toggle('on', b.dataset.id === S.shape); });
        }
    }
    function schedScene() {
        if (rafScene) return;
        rafScene = requestAnimationFrame(function () { rafScene = 0; if (S.cb) { drawScene(sceneCv, 14, 'edit'); if (!ISCAKE) drawBoxMap(); } schedChecks(); updateSummary(); });
    }
    function afterChange() { enforce(); syncControls(); schedScene(); }

    function setupPlacement() {
        sceneCv = $('#st-scene');
        if (ISCAKE) {
            $('#pl-shapes').innerHTML = SHAPES.map(function (s) {
                var b = s.box;
                return '<button type="button" role="radio" data-id="' + s.id + '" aria-checked="false" title="' + esc(T(s.label)) + '">' +
                    '<svg viewBox="' + (b[0] - 6) + ' ' + (b[1] - 6) + ' ' + (b[2] - b[0] + 12) + ' ' + (b[3] - b[1] + 12) + '" aria-hidden="true"><path d="' + s.d + '" fill="currentColor"/></svg><span>' + esc(T(s.label)) + '</span></button>';
            }).join('');
            $('#pl-shapes').addEventListener('click', function (e) {
                var b = e.target.closest('button'); if (!b) return;
                S.shape = b.dataset.id; shapeLimits(); fitArt(); afterChange();
            });
            $$('input[name=finish]').forEach(function (r) {
                r.addEventListener('change', function () {
                    S.finish = r.value; S.finishChosen = true; cutCache = null;
                    if (S.finish === 'shape') { S.sh.x = surfW() / 2; S.sh.y = surfH() / 2; S.move = 'art'; $('input[name=move][value=art]').checked = true; }
                    fitArt(); afterChange();
                });
            });
            $$('input[name=move]').forEach(function (r) { r.addEventListener('change', function () { S.move = r.value; }); });
            $$('input[name=orient]').forEach(function (r) {
                r.addEventListener('change', function () {
                    var ow = surfW(), oh = surfH();
                    S.orient = r.value;
                    S.p.x *= surfW() / ow; S.p.y *= surfH() / oh; S.sh.x = surfW() / 2; S.sh.y = surfH() / 2;
                    fitArt(); afterChange();
                });
            });
        }
        function bind(id, fn) { var el = $(id); if (el) el.addEventListener('input', function () { fn(+this.value); afterChange(); }); }
        bind('#pl-size', function (v) { S.p.w = v; });
        bind('#pl-rot', function (v) { S.p.rot = v; });
        bind('#pl-ssize', function (v) { S.sh.w = v; });
        bind('#pl-sprop', function (v) { S.sh.prop = v / 100; });
        bind('#pl-off', function (v) { S.off = v; });
        bind('#pl-smooth', function (v) { S.smooth = v; });
        $('#pl-center').addEventListener('click', function () {
            if (S.finish === 'shape' && S.move === 'shape') { S.sh.x = surfW() / 2; S.sh.y = surfH() / 2; }
            else if (S.finish === 'shape') { S.p.x = S.sh.x; S.p.y = S.sh.y; }
            else { S.p.x = surfW() / 2; S.p.y = surfH() / 2; }
            afterChange();
        });
        $('#pl-fit').addEventListener('click', function () { fitArt(); afterChange(); });

        function mm(e) { var r = sceneCv.getBoundingClientRect(), F = frameF(), o = frameOff(); return { x: (e.clientX - r.left) / r.width * F - o.x, y: (e.clientY - r.top) / r.height * F - o.y }; }
        sceneCv.addEventListener('pointerdown', function (e) {
            if (!S.cb) return;
            e.preventDefault(); sceneCv.setPointerCapture(e.pointerId);
            pointers[e.pointerId] = mm(e);
            var ids = Object.keys(pointers);
            if (ids.length === 1) {
                var m = pointers[e.pointerId], mvShape = S.finish === 'shape' && S.move === 'shape';
                drag = { mode: 'move', ox: m.x - (mvShape ? S.sh.x : S.p.x), oy: m.y - (mvShape ? S.sh.y : S.p.y), shape: mvShape };
            } else if (ids.length === 2) {
                var a = pointers[ids[0]], b = pointers[ids[1]];
                drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), w0: S.p.w, r0: S.p.rot };
            }
        });
        sceneCv.addEventListener('pointermove', function (e) {
            if (!pointers[e.pointerId] || !drag) return;
            pointers[e.pointerId] = mm(e);
            if (drag.mode === 'move') {
                var m = pointers[e.pointerId];
                if (drag.shape) { S.sh.x = m.x - drag.ox; S.sh.y = m.y - drag.oy; } else { S.p.x = m.x - drag.ox; S.p.y = m.y - drag.oy; }
                if (S.finish === 'shape' && !drag.shape) { /* artwork moves freely under the shape */ }
            } else if (drag.mode === 'pinch') {
                var ids = Object.keys(pointers); if (ids.length < 2) return;
                var a = pointers[ids[0]], b = pointers[ids[1]];
                S.p.w = clamp(drag.w0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0, 4, 120);
                var rot = drag.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - drag.a0) * 180 / Math.PI;
                S.p.rot = ((rot + 540) % 360) - 180;
            }
            afterChange();
        });
        function up(e) { delete pointers[e.pointerId]; drag = null; }
        sceneCv.addEventListener('pointerup', up); sceneCv.addEventListener('pointercancel', up);
        sceneCv.addEventListener('wheel', function (e) {
            if (!S.cb) return;
            e.preventDefault();
            var f = e.deltaY < 0 ? 1.05 : 0.95;
            if (S.finish === 'shape' && S.move === 'shape') S.sh.w = clamp(S.sh.w * f, 12, 80); else S.p.w = clamp(S.p.w * f, 4, 120);
            afterChange();
        }, { passive: false });
    }

    /* ------------------------------ 8. steps + price ------------------------------ */
    var STEP_NAMES = ISCAKE ? ['Upload', 'Design', 'Preview', 'Quantity & order'] : ['Box', 'Design', 'Preview', 'Quantity & order'];
    function setupSteps() {
        $('#st-steps').innerHTML = STEP_NAMES.map(function (n, i) {
            return '<li><button type="button" data-step="' + (i + 1) + '"><i>' + (i + 1) + '</i><span>' + esc(T(n)) + '</span></button></li>';
        }).join('');
        $('#st-steps').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            var n = +b.dataset.step; if (n <= S.maxStep) goStep(n);
        });
        doc.addEventListener('click', function (e) {
            var g = e.target.closest('[data-go]');
            if (g) { e.preventDefault(); goStep(+g.dataset.go); }
        });
    }
    var booted = false;
    function goStep(n) {
        if (n > 1 && !S.src && (ISCAKE || n > 2)) return;
        if (n >= 3 && !ISCAKE) {
            for (var pi = 0; pi < pieces(); pi++) {
                var okp = withSlot(pi, function () { return !!(S.src && S.cb && !S.cb.empty); });
                if (!okp) { toastMsg(T('Piece') + ' ' + (pi + 1) + ' ' + T('has no design yet. Please add one for every piece.')); if (pi !== S.slot) loadSlot(pi); return; }
            }
        } else if (n >= 3 && (!S.cb || S.cb.empty)) { toastMsg(T('There is no artwork left. Please choose another version.')); return; }
        var prevStep = S.step;
        S.step = n; S.maxStep = Math.max(S.maxStep, n);
        $$('.st-card').forEach(function (c) { c.hidden = +c.dataset.step !== n; });
        $$('#st-steps li').forEach(function (li, i) {
            li.className = i + 1 === n ? 'on' : (i + 1 < n ? 'done' : (i + 1 <= S.maxStep ? 'avail' : ''));
            li.querySelector('button').disabled = i + 1 > S.maxStep;
            if (i + 1 === n) li.querySelector('button').setAttribute('aria-current', 'step'); else li.querySelector('button').removeAttribute('aria-current');
        });
        if (!ISCAKE) renderSlots();
        if (n === 2 && S.src) { if (!S.fitted) fitArt(); afterChange(); }
        if (n === 3) renderPreview();
        if (n === 4) renderPricing();
        updateSummary();
        var top = $('#st-steps'); if (top && top.scrollIntoView && booted && (ISCAKE || prevStep !== n)) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function finishLabel() { return !ISCAKE ? T('Print only') : S.finish === 'around' ? T('Cut around artwork') : S.finish === 'shape' ? T('Cut shape') + ': ' + T(shapeById(S.shape).label) : T('Print only'); }
    function versionLabel() { var v = S.versions[S.ver]; return v ? T(v.label) : ''; }
    function renderPreview() {
        if (!ISCAKE) return renderBoxPreview();
        var cut = drawScene($('#st-preview'), 16, 'preview', { tol: $('#pv-tol').checked });
        var rows = [[T('Finish'), finishLabel()], [T('Cake surface'), num(surfW(), 1) + ' × ' + num(surfH(), 1) + ' mm'], [T('Artwork'), versionLabel()]];
        if (cut) rows.push([T('Cut size'), num(cut.box.w, 1) + ' × ' + num(cut.box.h, 1) + ' mm']);
        if (S.designer) rows.push([T('Designer'), T('Will create a proof for you')]);
        $('#st-prev-dl').innerHTML = rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
        renderChecks($('#pv-checks'), runChecks());
        $('#pv-tolwrap').hidden = !cut;
        $('#pv-conn').hidden = !cut;
    }
    /* chocolate: the whole box with every piece, one print per piece */
    function renderBoxPreview() {
        var np = pieces(), sel = clamp(S.pvPiece || 0, 0, np - 1); S.pvPiece = sel;
        withSlot(sel, function () { drawScene($('#st-preview'), 16, 'preview', { tol: false }); });
        var strip = $('#pv-pieces');
        if (strip) {
            strip.hidden = np < 2;
            var cols = np === 9 ? 3 : np;
            strip.innerHTML = '<p class="st-fine">' + esc(T('Your box. Tap a piece to look at it closely.')) + '</p><div class="st-pvbox" style="grid-template-columns:repeat(' + cols + ',1fr)">' +
                Array.apply(null, Array(np)).map(function (_, i) { return '<button type="button" class="st-pvp' + (i === sel ? ' on' : '') + '" data-i="' + i + '" aria-label="' + esc(T('Piece') + ' ' + (i + 1)) + '"><canvas></canvas></button>'; }).join('') + '</div>';
            $$('.st-pvp canvas', strip).forEach(function (cv, i) { withSlot(i, function () { drawScene(cv, 5, 'preview', { tol: false, bare: true }); }); });
        }
        var bs = boxSet(), v = withSlot(sel, function () { return versionLabel(); });
        var rows = [[T('Box'), T(bs.label)], [T('Chocolate size'), num(SURF.w, 1) + ' × ' + num(SURF.h, 1) + ' mm'], [T('Thickness'), thick().label]];
        if (np > 1) rows.push([T('Showing'), T('Piece') + ' ' + (sel + 1) + ' ' + T('of') + ' ' + np]);
        rows.push([T('Artwork'), v]);
        if (anyDesigner()) rows.push([T('Designer'), T('Will create a proof for you')]);
        $('#st-prev-dl').innerHTML = rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
        var all = [], good = true;
        for (var i = 0; i < np; i++) {
            var list = withSlot(i, function () { return runChecks(); });
            list.forEach(function (c) { if (c.l !== 'ok') { good = false; all.push({ l: c.l, t: (np > 1 ? T('Piece') + ' ' + (i + 1) + ': ' : '') + c.t }); } });
        }
        if (good) all.push({ l: 'ok', t: T('Automatic check complete for every piece.') });
        renderChecks($('#pv-checks'), all);
        $('#pv-tolwrap').hidden = true; $('#pv-conn').hidden = true;
    }
    function anyDesigner() { for (var i = 0; i < pieces(); i++) { if (withSlot(i, function () { return S.designer; })) return true; } return false; }
    function tier() { return TIERS[S.qty] || TIERS[0]; }
    function box() { return BOXES.filter(function (b) { return b.id === S.box; })[0] || BOXES[0]; }
    function thick() { return THICK.filter(function (t) { return t.id === S.thick; })[0] || THICK[0]; }
    function discountFor(n) { var off = 0; DISCOUNTS.forEach(function (d) { if (n >= d.min) off = d.off; }); return off; }
    function boxUnit() { var bs = boxSet(); return bs.price * (1 - discountFor(S.nbox) / 100) + thick().extra * bs.pieces; }       // price of one box
    function totalPieces() { return pieces() * S.nbox; }
    function orderQty() { return ISCAKE ? tier().qty : totalPieces(); }
    function totalPrice() {
        var fee = S.designer || anyDesignerSafe() ? DESIGNER_FEE : 0;
        if (!ISCAKE) return Math.round(boxUnit() * S.nbox) + fee;
        var t = tier(), extra = box().extra * t.qty;
        return t.price + extra + fee;
    }
    function anyDesignerSafe() { if (ISCAKE) return false; for (var i = 0; i < pieces(); i++) { var d = i === S.slot ? S.designer : !!(S.slots[i] && S.slots[i].designer); if (d) return true; } return false; }
    function customUnlocked() { return !ISCAKE && totalPieces() >= MOQ; }
    function renderPricing() {
        if (!ISCAKE) $('#st-tiers').className = 'st-nbwrap';
        $('#st-tiers').innerHTML = !ISCAKE ? boxQtyHtml() : TIERS.map(function (t, i) {
            return '<label class="st-tier' + (i === S.qty ? ' on' : '') + '"><input type="radio" name="tier" value="' + i + '"' + (i === S.qty ? ' checked' : '') + '>' +
                (t.popular ? '<em>' + esc(T('Popular')) + '</em>' : '') +
                '<b>' + t.qty + ' <small>' + esc(T('pcs')) + '</small></b><strong>' + esc(money(t.price)) + '</strong><span>' + esc(money(t.price / t.qty)) + ' ' + esc(T('each')) + '</span></label>';
        }).join('');
        var h = '';
        if (ISCAKE) {
            h = '<h3 class="st-h3">' + esc(T('Box colour')) + '</h3><div class="st-boxes">' + BOXES.map(function (b) {
                return '<label class="st-box' + (b.id === S.box ? ' on' : '') + '"><input type="radio" name="boxc" value="' + b.id + '"' + (b.id === S.box ? ' checked' : '') + '>' +
                    '<i style="background:' + b.color + '"></i><b>' + esc(T(b.label)) + '</b><small>' + (b.extra ? '+' + esc(money(b.extra)) + ' / ' + esc(T('piece')) : esc(T('No extra charge'))) + '</small></label>';
            }).join('') + '</div>';
        } else {
            h = '<h3 class="st-h3">' + esc(T('Thickness')) + '</h3><div class="st-boxes st-two-col">' + THICK.map(function (t) {
                return '<label class="st-box' + (t.id === S.thick ? ' on' : '') + '"><input type="radio" name="thk" value="' + t.id + '"' + (t.id === S.thick ? ' checked' : '') + '>' +
                    '<i class="st-thk" style="height:' + (14 + (+t.id) * 2.6) + 'px"></i><b>' + esc(T(t.label)) + '</b><small>' + (t.extra ? '+' + esc(money(t.extra)) + ' / ' + esc(T('piece')) : esc(T('No extra charge'))) + '</small></label>';
            }).join('') + '</div>';
            var open = customUnlocked();
            h += '<h3 class="st-h3">' + esc(T('Flavour & box')) + '</h3>';
            h += '<div class="st-custom' + (open ? '' : ' locked') + '">' +
                '<p class="st-fine">' + (open ? esc(T('Your quantity unlocks a custom flavour and box. Choose below and we will confirm details and any extra cost with you.'))
                    : esc(T('From')) + ' ' + MOQ + ' ' + esc(T('pieces you can choose your own flavour and a custom box. Select a higher quantity to unlock this.')) + '</p>') +
                '<div class="st-flav" role="radiogroup" aria-label="Flavour">' + FLAVOURS.map(function (f, i) {
                    return '<label class="st-chip-toggle"><input type="radio" name="flav" value="' + i + '"' + (i === S.flavour ? ' checked' : '') + (open || i === 0 ? '' : ' disabled') + '><span>' + esc(T(f)) + '</span></label>';
                }).join('') + '</div>' +
                '<label class="st-check"><input type="checkbox" id="cb-custom"' + (S.customBox ? ' checked' : '') + (open ? '' : ' disabled') + '><span><b>' + esc(T('I would like a custom box')) + '</b><small>' + esc(T('Tell us your idea (colours, logo, size). We will send a proof.')) + '</small></span></label>' +
                '<textarea id="cb-note" rows="3" placeholder="' + esc(T('Describe your custom box')) + '"' + (S.customBox && open ? '' : ' hidden') + '>' + esc(S.boxNote) + '</textarea></div>';
        }
        $('#st-extras').innerHTML = h;
        if (!ISCAKE) wireBoxQty();
        $$('input[name=tier]').forEach(function (r) { r.addEventListener('change', function () { S.qty = +r.value; if (!customUnlocked()) { S.flavour = 0; S.customBox = false; } renderPricing(); updateSummary(); }); });
        $$('input[name=boxc]').forEach(function (r) { r.addEventListener('change', function () { S.box = r.value; renderPricing(); updateSummary(); }); });
        $$('input[name=thk]').forEach(function (r) { r.addEventListener('change', function () { S.thick = r.value; renderPricing(); updateSummary(); }); });
        $$('input[name=flav]').forEach(function (r) { r.addEventListener('change', function () { S.flavour = +r.value; updateSummary(); }); });
        var cb = $('#cb-custom');
        if (cb) { cb.addEventListener('change', function () { S.customBox = cb.checked; $('#cb-note').hidden = !cb.checked; }); $('#cb-note').addEventListener('input', function () { S.boxNote = this.value; }); }
        updateAddBtn();
    }
    function boxQtyHtml() {
        var mins = [MINBOX]; DISCOUNTS.forEach(function (d) { if (d.min > MINBOX && mins.indexOf(d.min) < 0) mins.push(d.min); });
        var off = discountFor(S.nbox), bs = boxSet();
        return '<div class="st-nb"><button type="button" class="st-step" id="nb-dec" aria-label="' + esc(T('Fewer boxes')) + '">−</button>' +
            '<label><input type="number" id="nb-in" inputmode="numeric" min="' + MINBOX + '" max="5000" value="' + S.nbox + '" aria-label="' + esc(T('Number of boxes')) + '"><span>' + esc(T(S.nbox === 1 ? 'box' : 'boxes')) + '</span></label>' +
            '<button type="button" class="st-step" id="nb-inc" aria-label="' + esc(T('More boxes')) + '">+</button></div>' +
            '<div class="st-nb-chips">' + mins.map(function (m) { var o = discountFor(m); return '<button type="button" class="st-chipbtn' + (m === S.nbox ? ' on' : '') + '" data-n="' + m + '"><b>' + m + '</b><small>' + (o ? '−' + o + '%' : esc(T('standard'))) + '</small></button>'; }).join('') + '</div>' +
            '<div class="st-nb-sum"><div><span>' + esc(T(bs.label)) + '</span><b>' + esc(money(bs.price)) + ' ' + esc(T('per box')) + '</b></div>' +
            (off ? '<div><span>' + esc(T('Quantity discount')) + '</span><b>−' + off + '%</b></div>' : '') +
            '<div><span>' + esc(T('Pieces in total')) + '</span><b>' + totalPieces() + '</b></div>' +
            '<div class="st-nb-t"><span>' + esc(T('Your price per box')) + '</span><b>' + esc(money(boxUnit())) + '</b></div></div>' +
            '<p class="st-fine">' + esc(T('Every box is printed with the same set of designs. The price is lower per box when you order more boxes.')) + '</p>';
    }
    function wireBoxQty() {
        function set(n) { S.nbox = clamp(Math.round(n) || MINBOX, MINBOX, 5000); if (!customUnlocked()) { S.flavour = 0; S.customBox = false; } renderPricing(); updateSummary(); }
        $('#nb-dec').addEventListener('click', function () { set(S.nbox - (S.nbox > 25 ? 5 : 1)); });
        $('#nb-inc').addEventListener('click', function () { set(S.nbox + (S.nbox >= 25 ? 5 : 1)); });
        $('#nb-in').addEventListener('change', function () { set(+this.value); });
        $$('.st-nb-chips button').forEach(function (b) { b.addEventListener('click', function () { set(+b.dataset.n); }); });
    }
    function addBusinessDays(d, n) {
        var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        function next() { do { x.setDate(x.getDate() + 1); } while (x.getDay() === 0 || x.getDay() === 6); }
        next();
        for (var i = 0; i < n; i++) next();
        return x;
    }
    function updateSummary() {
        var started = ISCAKE ? S.versions.length > 0 : (function () { for (var z = 0; z < pieces(); z++) if (slotFilled(z)) return true; return false; })();
        var shown = started ? totalPrice() : 0;                                  // nothing to price until the customer has a design
        $('#sum-total').textContent = money(shown);
        $('#bar-total').textContent = money(shown);
        $('#bar-step').textContent = T('Step') + ' ' + S.step + '/4';
        var rows;
        if (ISCAKE) { var t = tier(); rows = [[T('Finish'), finishLabel()], [T('Quantity'), t.qty + ' ' + T('pcs')], [T('Box'), T(box().label)], [T('Per piece'), started ? money(totalPrice() / t.qty) : '\u2014']]; }
        else {
            var done = 0; for (var q = 0; q < pieces(); q++) if (slotFilled(q)) done++;
            rows = [[T('Box'), T(boxSet().label)], [T('Designs ready'), done + ' / ' + pieces()], [T('Boxes'), S.nbox], [T('Pieces in total'), totalPieces()], [T('Thickness'), thick().label], [T('Per box'), started ? money(boxUnit()) : '\u2014']];
        }
        $('#sum-list').innerHTML = rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
        var ship = addBusinessDays(new Date(), LEAD);
        $('#sum-ship').textContent = ship.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        $('#sum-ship-n').textContent = LEAD + ' ' + T('business days from the next business day after confirmation');
    }
    function updateAddBtn() { $('#st-add').disabled = !$$('.st-ap').every(function (c) { return c.checked; }); }

    /* ------------------------------ 9. files + cart ------------------------------ */
    function blobOf(cv, type, q) { return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, type, q); }); }
    function svgOf(cut) {
        var W = surfW(), H = surfH();
        function pts(poly) { return poly.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(3) + ' ' + p[1].toFixed(3); }).join('') + 'Z'; }
        var s = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">\n' +
            '<!-- Grape Tree ' + PRODUCT + '. Units: mm. Origin: top-left of the ' + W + ' x ' + H + ' mm surface. Clear zone: ' + MARGIN + ' mm on every side. -->\n' +
            '<rect id="SURFACE" x="0" y="0" width="' + W + '" height="' + H + '" fill="none" stroke="#999" stroke-width="0.1"/>\n' +
            '<rect id="CLEAR_ZONE_LIMIT" x="' + MARGIN + '" y="' + MARGIN + '" width="' + (W - 2 * MARGIN) + '" height="' + (H - 2 * MARGIN) + '" fill="none" stroke="#e33" stroke-width="0.08" stroke-dasharray="0.6 0.6"/>\n' +
            '<rect id="PRINT_AREA" x="' + BORDER + '" y="' + BORDER + '" width="' + (W - 2 * BORDER) + '" height="' + (H - 2 * BORDER) + '" fill="none" stroke="#bbb" stroke-width="0.1" stroke-dasharray="0.6 0.6"/>\n';
        if (cut) {
            s += '<path id="CUT" d="' + pts(cut.poly) + '" fill="none" stroke="#0057ff" stroke-width="0.15"/>\n';
            if (cut.conn.gap > 0.4) s += '<path id="CONNECTOR" d="M' + cut.conn.a[0].toFixed(3) + ' ' + cut.conn.a[1].toFixed(3) + 'L' + cut.conn.b[0].toFixed(3) + ' ' + cut.conn.b[1].toFixed(3) + '" fill="none" stroke="#0057ff" stroke-width="0.15"/>\n';
        }
        return s + '</svg>\n';
    }
    var buildIdx = null;
    function buildFiles() {
        var pc = makeCanvas(1, 1), cut = drawScene(pc, 600 / 25.4, 'print');
        var vc = makeCanvas(1, 1); drawScene(vc, 16, 'preview', { tol: false, bare: true });
        var theFile = S.file;
        var checks = runChecks(), v = S.versions[S.ver] || {};
        var spec = {
            studio: 'grapetree-studio/2', product: PRODUCT, created: new Date().toISOString(), test: !!S.test,
            surface_mm: { width: surfW(), height: surfH(), orientation: S.orient }, clear_zone_mm: MARGIN, unprinted_border_mm: BORDER, safe_margin_mm: SAFE, tolerance_mm: TOL,
            finish: ISCAKE ? S.finish : 'print',
            shape: ISCAKE && S.finish === 'shape' ? { id: S.shape, width_mm: num(S.sh.w, 2), proportion: num(S.sh.prop, 3), x_mm: num(S.sh.x, 2), y_mm: num(S.sh.y, 2) } : null,
            artwork: { x_mm: num(S.p.x, 2), y_mm: num(S.p.y, 2), width_mm: num(S.p.w, 2), height_mm: num(artH(), 2), rotation_deg: num(S.p.rot, 1), version: v.label, version_kind: v.kind, ai: !!v.ai },
            cut_offset_mm: ISCAKE && S.finish === 'around' ? S.off : null, cut_smooth_mm: ISCAKE && S.finish === 'around' ? S.smooth : null,
            designer_requested: S.designer, designer_note: S.designerNote, legal: legalStudio(),
            quantity: orderQty(), box: ISCAKE ? box().id : (S.customBox ? 'custom' : 'standard'),
            box_set: ISCAKE ? null : { id: boxSet().id, label: boxSet().label, pieces: pieces(), boxes: S.nbox, piece_index: (buildIdx != null ? buildIdx : S.slot) + 1, piece_of: pieces() }, thickness_mm: ISCAKE ? null : +thick().id, flavour: ISCAKE ? null : FLAVOURS[S.flavour], custom_box_note: S.customBox ? S.boxNote : '',
            total: totalPrice(), currency: CFG.currency || 'AED',
            original: { name: theFile.name, type: theFile.type, bytes: theFile.size, width_px: S.origW, height_px: S.origH },
            print_file: { dpi: 600, width_px: pc.width, height_px: pc.height, note: ISCAKE ? 'White is not printed. Transparent background.' : 'One colour (black) printed on gold. Transparent background.' },
            warnings: checks.filter(function (c) { return c.l !== 'ok'; }).map(function (c) { return c.t; })
        };
        return Promise.all([blobOf(pc, 'image/png'), blobOf(vc, 'image/png')]).then(function (b) {
            return { print: b[0], preview: b[1], svg: new Blob([svgOf(cut)], { type: 'image/svg+xml' }), spec: new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), orig: theFile, specObj: spec, previewCanvas: vc };
        });
    }
    function thumb(cv) {
        var c = makeCanvas(200, 200 * cv.height / cv.width); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
        var f = makeCanvas(c.width, c.height), fx = f.getContext('2d'); fx.fillStyle = ISCAKE ? '#FFF7F5' : '#F7F2E7'; fx.fillRect(0, 0, f.width, f.height); fx.drawImage(c, 0, 0);
        return f.toDataURL('image/jpeg', 0.82);
    }
    /* chocolate: one cart line per piece (each with its own print files), the first line carries the price */
    function addBoxToCart() {
        var btn = $('#st-add'), err = $('#st-add-err'), np = pieces();
        err.hidden = true; btn.disabled = true; btn.textContent = T('Preparing your files...');
        saveSlot();
        var infos = [], jobs = [];
        for (var i = 0; i < np; i++) {
            (function (i) {
                withSlot(i, function () {
                    infos.push({ designId: S.designId, name: S.file.name, designer: S.designer, dnote: S.designerNote, look: look(), label: versionLabel(), file: S.file });
                    buildIdx = i; jobs.push(buildFiles()); buildIdx = null;
                });
            })(i);
        }
        Promise.all(jobs).then(function (fs) {
            if (!window.GTStore) throw new Error('store');
            return Promise.all(fs.map(function (f, i) {
                return GTStore.put(infos[i].designId, { created: Date.now(), orig: f.orig, origName: infos[i].name, print: f.print, preview: f.preview, svg: f.svg, spec: f.spec, specObj: f.specObj, finish: 'print' });
            })).then(function () { return fs; });
        }).then(function (fs) {
            var B = backend(), gid = 'bx' + Date.now().toString(36), bs = boxSet(), isTest = !!(B && B.isAdmin && B.isAdmin());
            infos.forEach(function (inf, i) {
                var meta = [[T('Box'), T(bs.label) + ' × ' + S.nbox], [T('Piece'), (i + 1) + ' / ' + np], [T('Chocolate size'), num(SURF.w, 1) + ' × ' + num(SURF.h, 1) + ' mm'], [T('Artwork'), inf.label], [T('Thickness'), thick().label]];
                if (i === 0) { meta.push([T('Flavour'), T(FLAVOURS[S.flavour])]); meta.push([T('Box'), S.customBox ? T('Custom box (we will contact you)') : T('Standard box')]); meta.push([T('Pieces in total'), totalPieces()]); }
                var note = '';
                if (inf.designer) note += 'DESIGNER REQUEST: create print artwork from the uploaded image and send a proof for approval.' + (inf.dnote ? ' Customer note: ' + inf.dnote : '');
                if (i === 0 && S.customBox) note += (note ? ' ' : '') + 'CUSTOM BOX: ' + (S.boxNote || 'customer will describe it');
                var line = {
                    id: 'studio-chocolate', name: T('Custom GildArt chocolates') + ' · ' + T(bs.label) + (np > 1 ? ' · ' + T('print') + ' ' + (i + 1) + '/' + np : ''), img: thumb(fs[i].previewCanvas), qty: 1,
                    unit: i === 0 ? totalPrice() : 0, quote: i === 0, fixed: true, included: i > 0, group: gid,
                    meta: meta, note: note, test: isTest,
                    art: { id: inf.designId, finish: 'print', designer: inf.designer, look: inf.look, qty: S.nbox, product: PRODUCT, piece: i + 1, pieces: np, group: gid, legal: legalStudio() }, sig: 'studio|' + inf.designId
                };
                window.GT.cart.add(line);
            });
            location.href = 'checkout.html';
        }).catch(function () {
            err.hidden = false;
            err.textContent = T('We could not save your design files in this browser (private browsing can block this). Please allow site data, or send your artwork to us on WhatsApp.');
            btn.textContent = T('Add to cart & continue'); updateAddBtn();
        });
    }
    function addToCart() {
        if (!ISCAKE) return addBoxToCart();
        var btn = $('#st-add'), err = $('#st-add-err');
        err.hidden = true; btn.disabled = true; btn.textContent = T('Preparing your files...');
        buildFiles().then(function (f) {
            if (!window.GTStore) throw new Error('store');
            return GTStore.put(S.designId, { created: Date.now(), orig: f.orig, origName: S.file.name, print: f.print, preview: f.preview, svg: f.svg, spec: f.spec, specObj: f.specObj, finish: S.finish })
                .then(function () { return f; });
        }).then(function (f) {
            var t = tier();
            var meta = [[T('Finish'), finishLabel()], [T('Quantity'), t.qty + ' ' + T('pcs')], [ISCAKE ? T('Cake surface') : T('Chocolate size'), num(surfW(), 1) + ' × ' + num(surfH(), 1) + ' mm'], [T('Artwork'), versionLabel()]];
            if (ISCAKE) meta.push([T('Box'), T(box().label)]);
            else { meta.push([T('Thickness'), thick().label]); meta.push([T('Flavour'), T(FLAVOURS[S.flavour])]); meta.push([T('Box'), S.customBox ? T('Custom box (we will contact you)') : T('Standard box')]); }
            if (S.designer) meta.push([T('Designer'), T('Please create the artwork and send a proof')]);
            var note = '';
            if (S.designer) note += 'DESIGNER REQUEST: create print artwork from the uploaded image and send a proof for approval.' + (S.designerNote ? ' Customer note: ' + S.designerNote : '');
            if (S.customBox) note += (note ? ' ' : '') + 'CUSTOM BOX: ' + (S.boxNote || 'customer will describe it');
            var B = backend();
            window.GT.cart.add({
                id: 'studio-' + PRODUCT, name: (ISCAKE ? T('Custom cut-out cakes') : T('Custom GildArt chocolates')) + ' (' + t.qty + ' ' + T('pcs') + ')', img: thumb(f.previewCanvas), qty: 1, unit: totalPrice(), quote: true, fixed: true,
                meta: meta, note: note, test: !!(B && B.isAdmin && B.isAdmin()),
                art: { id: S.designId, finish: S.finish, designer: S.designer, look: look(), qty: t.qty, product: PRODUCT, legal: legalStudio() }, sig: 'studio|' + S.designId
            });
            location.href = 'checkout.html';
        }).catch(function () {
            err.hidden = false;
            err.textContent = T('We could not save your design files in this browser (private browsing can block this). Please allow site data, or send your artwork to us on WhatsApp.');
            btn.textContent = T('Add to cart & continue'); updateAddBtn();
        });
    }

    /* ------------------------------ 10. create-your-own editor ------------------------------ */
    var FONTS = [
        { id: 'Fredoka' }, { id: 'Baloo 2' }, { id: 'Chewy' }, { id: 'Bangers' }, { id: 'Righteous' }, { id: 'Lobster' }, { id: 'Pacifico' }, { id: 'Dancing Script' },
        { id: 'Great Vibes' }, { id: 'Satisfy' }, { id: 'Caveat' }, { id: 'Kalam' }, { id: 'Permanent Marker' }, { id: 'Amatic SC' }, { id: 'Abril Fatface' }, { id: 'Playfair Display' },
        { id: 'Cinzel' }, { id: 'Press Start 2P' },
        { id: 'Cairo', ar: 'مرحبا' }, { id: 'Amiri', ar: 'مرحبا' }, { id: 'Reem Kufi', ar: 'مرحبا' }, { id: 'Lemonada', ar: 'مرحبا' }, { id: 'Aref Ruqaa', ar: 'مرحبا' }
    ];
    var FONTS_PREMIUM = [
        { id: 'Playfair Display' }, { id: 'Cormorant Garamond' }, { id: 'Cinzel' }, { id: 'Bodoni Moda' }, { id: 'Italiana' }, { id: 'Marcellus' }, { id: 'Tenor Sans' },
        { id: 'Libre Baskerville' }, { id: 'Montserrat' }, { id: 'Great Vibes' }, { id: 'Allura' }, { id: 'Pinyon Script' }, { id: 'Dancing Script' }, { id: 'Satisfy' }, { id: 'Abril Fatface' },
        { id: 'Cairo', ar: 'مرحبا' }, { id: 'Amiri', ar: 'مرحبا' }, { id: 'Reem Kufi', ar: 'مرحبا' }, { id: 'Aref Ruqaa', ar: 'مرحبا' }
    ];
    var FONT_LIST = ISCAKE ? FONTS : FONTS_PREMIUM;
    var CHOC_SHAPES = ['circle', 'square', 'rounded', 'oval', 'hexagon', 'octagon', 'diamond', 'arch', 'shield'];
    var MK_COLORS = ISCAKE ? ['#E8587A', '#F59DB5', '#F4B183', '#F7C531', '#E4572E', '#7B3FA0', '#C9B6F2', '#4C8FD6', '#BFD9F2', '#6AB187', '#8BC34A', '#B5835A', '#4a2c2a', '#111111', '#FFFFFF'] : ['#000000', '#FFFFFF'];
    var EMOJIS = ('❤️ 💖 💛 💙 💜 ✨ ⭐ 🌟 🎉 🎂 🍰 🧁 🍫 🍩 🍪 🍦 🍓 🍒 🍇 🍋 🍊 🍉 🌈 ☀️ 🌙 ⚡ 🔥 🎈 🎁 🎀 👑 💎 🐱 🐶 🐰 🐻 🦄 🐼 🐥 🦋 🐝 🐢 🐬 🚗 ✈️ 🚀 ⚽ 🏀 🎵 🎮 📚 🏆 💍 😀 😍 🥳 😎 🤩 🥰 😋 👍 👋 🌺 🌻 🌹 🍀 🌴 🕌 🧿 🎄 🎃 🎆').split(' ');
    var FLOWERS = [
        { id: 'daisy', label: 'Daisy', c: '#F59DB5', c2: '#F7C531' }, { id: 'blossom', label: 'Blossom', c: '#F59DB5', c2: '#F7C531' }, { id: 'sakura', label: 'Sakura', c: '#F9C6D3', c2: '#E8587A' },
        { id: 'rose', label: 'Rose', c: '#E8587A', c2: '#B83255' }, { id: 'tulip', label: 'Tulip', c: '#E8587A', c2: '#6AB187' }, { id: 'sunflower', label: 'Sunflower', c: '#F7C531', c2: '#4a2c2a' },
        { id: 'poppy', label: 'Poppy', c: '#E4572E', c2: '#111111' }, { id: 'hibiscus', label: 'Hibiscus', c: '#E8587A', c2: '#F7C531' }, { id: 'lotus', label: 'Lotus', c: '#F59DB5', c2: '#E8587A' },
        { id: 'daffodil', label: 'Daffodil', c: '#F7C531', c2: '#F28C28' }, { id: 'clover', label: 'Clover', c: '#6AB187', c2: '#4a8a5f' }, { id: 'lavender', label: 'Lavender', c: '#7B3FA0', c2: '#6AB187' },
        { id: 'wreath', label: 'Wreath', c: '#6AB187', c2: '#E8587A' }, { id: 'sprig', label: 'Leaf sprig', c: '#6AB187', c2: '#6AB187' }
    ];
    var FRIENDS = [
        { id: 'cat', label: 'Cat', c: '#F4B183', c2: '#F59DB5' }, { id: 'dog', label: 'Dog', c: '#C9A27A', c2: '#8B5E3C' }, { id: 'bunny', label: 'Bunny', c: '#F6D5DE', c2: '#F59DB5' },
        { id: 'bear', label: 'Bear', c: '#B5835A', c2: '#E8C9A0' }, { id: 'chick', label: 'Chick', c: '#F7D154', c2: '#F28C28' }, { id: 'penguin', label: 'Penguin', c: '#34495E', c2: '#FFFFFF' },
        { id: 'dino', label: 'Dino', c: '#6AB187', c2: '#F7C531' }, { id: 'fish', label: 'Fish', c: '#4C8FD6', c2: '#F7C531' }, { id: 'owl', label: 'Owl', c: '#9B6B43', c2: '#E8C9A0' },
        { id: 'frog', label: 'Frog', c: '#8BC34A', c2: '#E8587A' }, { id: 'ghost', label: 'Ghost', c: '#C9B6F2', c2: '#F59DB5' }, { id: 'robot', label: 'Robot', c: '#9AA5B1', c2: '#BDE7F5' },
        { id: 'sunny', label: 'Sunny', c: '#F7C531', c2: '#F28C28' }, { id: 'starry', label: 'Starry', c: '#F7C531', c2: '#F28C28' }, { id: 'cloudy', label: 'Cloudy', c: '#BFD9F2', c2: '#F59DB5' },
        { id: 'cupcake', label: 'Cupcake', c: '#F59DB5', c2: '#F7C531' }
    ];
    var MK = { items: [], sel: -1, tab: 'text', scratch: false, uid: 1, ppm: 16, font: ISCAKE ? 'Fredoka' : 'Playfair Display' };
    var mkcv, drawFrame = 0, emojiCache = {};

    function mkInk(c) { return ISCAKE ? c : (c && c.toUpperCase() === '#FFFFFF' ? '#FFFFFF' : '#000000'); }
    function shapeBox(id) { var s = shapeById(id), b = s.box; return { w: b[2] - b[0], h: b[3] - b[1], b: b, s: s }; }
    var mcx = makeCanvas(4, 4).getContext('2d');
    function itemSize(it) {
        if (it.type === 'text') {
            var lines = String(it.text || ' ').split('\n'), w = 0;
            mcx.font = '100px "' + it.font + '", sans-serif';
            lines.forEach(function (l) { w = Math.max(w, mcx.measureText(l || ' ').width); });
            return { w: w / 100 * it.s, h: lines.length * it.s * 1.15 };
        }
        if (it.type === 'shape') { var sb = shapeBox(it.shape); return { w: it.s, h: it.s * sb.h / sb.w * (it.prop || 1) }; }
        if (it.type === 'image') return { w: it.s, h: it.s * it.ar };
        return { w: it.s, h: it.s };
    }
    function emojiBitmap(e) {            // always drawn on a fresh canvas so the emoji keeps its own colours
        if (emojiCache[e]) return emojiCache[e];
        var c = makeCanvas(192, 192), x = c.getContext('2d');
        x.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
        x.fillText(e, 96, 104);
        emojiCache[e] = c; return c;
    }
    /* ---- flowers and friends are drawn from simple shapes in a 100 x 100 box centred on 0,0 ---- */
    function P(cx, f, fn) { cx.fillStyle = f; cx.beginPath(); fn(); cx.fill(); }
    function drawFlower(cx, id, c, c2) {
        function circ(x, y, r, f) { P(cx, f, function () { cx.arc(x, y, r, 0, 7); }); }
        function ell(x, y, rx, ry, f, rot) { P(cx, f, function () { cx.ellipse(x, y, rx, ry, rot || 0, 0, 7); }); }
        function around(n, fn) { for (var i = 0; i < n; i++) { cx.save(); cx.rotate(i * 2 * Math.PI / n); fn(i); cx.restore(); } }
        function pointed(len, w, f) { P(cx, f, function () { cx.moveTo(0, 0); cx.quadraticCurveTo(-w, -len * .55, 0, -len); cx.quadraticCurveTo(w, -len * .55, 0, 0); }); }
        if (id === 'daisy') { around(12, function () { ell(0, -30, 9, 21, c); }); circ(0, 0, 15, c2); }
        else if (id === 'blossom') { around(5, function () { circ(0, -26, 22, c); }); circ(0, 0, 11, c2); }
        else if (id === 'sakura') { around(5, function () { P(cx, c, function () { cx.moveTo(0, -4); cx.bezierCurveTo(-26, -16, -20, -50, -5, -47); cx.lineTo(0, -40); cx.lineTo(5, -47); cx.bezierCurveTo(20, -50, 26, -16, 0, -4); }); }); circ(0, 0, 7, c2); around(8, function () { circ(0, -14, 2.2, c2); }); }
        else if (id === 'rose') { circ(0, 0, 44, c); cx.strokeStyle = c2; cx.lineWidth = 4; cx.lineCap = 'round'; [30, 18, 8].forEach(function (r, i) { cx.beginPath(); cx.arc(i * 2, 0, r, 0.4 + i, 5.2 + i); cx.stroke(); }); }
        else if (id === 'sunflower') { around(18, function () { ell(0, -34, 7, 16, c); }); circ(0, 0, 25, c2); for (var i = 0; i < 8; i++) circ(Math.cos(i * 0.9) * i * 2.7, Math.sin(i * 0.9) * i * 2.7, 2.2, c); }
        else if (id === 'poppy') { around(4, function () { circ(15, -15, 24, c); }); circ(0, 0, 11, c2); around(8, function () { circ(0, -17, 2.3, c2); }); }
        else if (id === 'hibiscus') { around(5, function () { ell(0, -26, 21, 28, c); }); cx.strokeStyle = c2; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(10, -34); cx.stroke(); [[10, -36], [6, -30], [14, -30]].forEach(function (p) { circ(p[0], p[1], 3.5, c2); }); circ(0, 0, 8, c2); }
        else if (id === 'lotus') { [-72, -36, 36, 72].forEach(function (a) { cx.save(); cx.rotate(a * Math.PI / 180); pointed(46, 15, c); cx.restore(); }); [-18, 18].forEach(function (a) { cx.save(); cx.rotate(a * Math.PI / 180); pointed(50, 14, c2); cx.restore(); }); pointed(54, 14, c); }
        else if (id === 'daffodil') { around(6, function () { pointed(46, 13, c); }); circ(0, 0, 15, c2); circ(0, 0, 8, c); }
        else if (id === 'clover') { around(4, function () { P(cx, c, function () { cx.moveTo(0, -4); cx.bezierCurveTo(-32, -12, -28, -48, 0, -30); cx.bezierCurveTo(28, -48, 32, -12, 0, -4); }); }); cx.strokeStyle = c2; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 4); cx.quadraticCurveTo(10, 30, 4, 48); cx.stroke(); }
        else if (id === 'lavender') { cx.strokeStyle = c2; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 48); cx.lineTo(0, -34); cx.stroke(); for (var j = 0; j < 7; j++) { var y = 28 - j * 10; cx.save(); cx.translate(0, y); cx.rotate(.5); ell(-9, 0, 9, 4.5, c, 0); cx.restore(); cx.save(); cx.translate(0, y - 5); cx.rotate(-.5); ell(9, 0, 9, 4.5, c, 0); cx.restore(); } ell(0, -40, 5, 10, c); }
        else if (id === 'wreath') { around(14, function (i) { cx.save(); cx.translate(0, -34); cx.rotate(.5); ell(0, 0, 6, 13, c); cx.restore(); }); around(7, function (i) { circ(0, -34, 4, c2); }); }
        else if (id === 'tulip') { cx.strokeStyle = c2; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(0, -2); cx.lineTo(0, 48); cx.stroke(); ell(-13, 32, 8, 18, c2, -.6); ell(13, 36, 8, 16, c2, .6); P(cx, c, function () { cx.moveTo(-24, -34); cx.quadraticCurveTo(-30, 8, 0, 10); cx.quadraticCurveTo(30, 8, 24, -34); cx.lineTo(10, -18); cx.lineTo(0, -40); cx.lineTo(-10, -18); cx.closePath(); }); }
        else { cx.strokeStyle = c; cx.lineWidth = 5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(0, 46); cx.quadraticCurveTo(6, 0, 0, -44); cx.stroke(); for (var k = 0; k < 5; k++) { var yy = 34 - k * 16, s = k % 2 ? 1 : -1; cx.save(); cx.translate(s * 3, yy); cx.rotate(s * .9); ell(s * 12, 0, 14, 6, c); cx.restore(); } ell(0, -46, 6, 12, c); }
    }
    function drawFriend(cx, id, c, c2) {
        var dark = ISCAKE ? '#3a2a2a' : '#000', light = '#fff', onBody = ISCAKE ? dark : light, cheek = ISCAKE ? 'rgba(244,114,140,.55)' : null;
        function circ(x, y, r, f) { P(cx, f, function () { cx.arc(x, y, r, 0, 7); }); }
        function ell(x, y, rx, ry, f, rot) { P(cx, f, function () { cx.ellipse(x, y, rx, ry, rot || 0, 0, 7); }); }
        function tri(a, b, d, f) { P(cx, f, function () { cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.lineTo(d[0], d[1]); cx.closePath(); }); }
        function eyes(y, dx, r, f) { circ(-dx, y, r, f || onBody); circ(dx, y, r, f || onBody); if (ISCAKE) { circ(-dx + r * .3, y - r * .35, r * .3, '#fff'); circ(dx + r * .3, y - r * .35, r * .3, '#fff'); } }
        function smile(x, y, r, f) { cx.strokeStyle = f || onBody; cx.lineWidth = 3; cx.lineCap = 'round'; cx.beginPath(); cx.arc(x, y, r, 0.2 * Math.PI, 0.8 * Math.PI); cx.stroke(); }
        function cheeks(y, dx) { if (cheek) { ell(-dx, y, 6, 4, cheek); ell(dx, y, 6, 4, cheek); } }
        function line(x1, y1, x2, y2, f, w) { cx.strokeStyle = f; cx.lineWidth = w || 2.5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); }
        function eyeW(x, y, r) { circ(x, y, r, '#fff'); circ(x, y, r * .55, dark); }
        if (id === 'cat') { tri([-40, -6], [-34, -46], [-8, -26], c); tri([40, -6], [34, -46], [8, -26], c); tri([-34, -22], [-32, -38], [-18, -27], c2); tri([34, -22], [32, -38], [18, -27], c2); ell(0, 8, 42, 34, c); eyes(4, 16, 4.6); ell(0, 14, 3.6, 2.6, c2); smile(-3, 14, 4); smile(3, 14, 4); line(-24, 14, -46, 10, onBody, 2); line(-24, 19, -46, 21, onBody, 2); line(24, 14, 46, 10, onBody, 2); line(24, 19, 46, 21, onBody, 2); cheeks(18, 26); }
        else if (id === 'dog') { ell(-38, -2, 12, 28, c2, .25); ell(38, -2, 12, 28, c2, -.25); ell(0, 4, 38, 36, c); ell(0, 20, 20, 15, c2); eyes(-2, 15, 4.6); ell(0, 12, 7, 5, onBody === dark ? dark : light); line(0, 17, 0, 24, onBody, 2.5); smile(0, 20, 6); cheeks(10, 28); }
        else if (id === 'bunny') { ell(-17, -30, 10, 28, c, -.12); ell(17, -30, 10, 28, c, .12); ell(-17, -30, 5, 20, c2, -.12); ell(17, -30, 5, 20, c2, .12); ell(0, 16, 38, 32, c); eyes(10, 15, 4.4); ell(0, 19, 4, 3, c2); smile(-3, 21, 4); smile(3, 21, 4); cheeks(22, 25); }
        else if (id === 'bear') { circ(-30, -26, 12, c); circ(30, -26, 12, c); circ(-30, -26, 6, c2); circ(30, -26, 6, c2); circ(0, 6, 40, c); ell(0, 18, 17, 13, c2); eyes(-2, 16, 4.4); ell(0, 12, 5.5, 4, dark); smile(0, 18, 6, dark); cheeks(12, 28); }
        else if (id === 'chick') { ell(-2, -42, 4, 9, c, -.3); ell(4, -44, 4, 9, c, .3); circ(0, 6, 40, c); ell(-38, 14, 8, 14, c2, .35); ell(38, 14, 8, 14, c2, -.35); eyes(0, 15, 4.6); tri([-7, 8], [7, 8], [0, 18], c2 === c ? '#F28C28' : c2); cheeks(10, 27); }
        else if (id === 'penguin') { ell(0, 0, 36, 47, c); ell(-37, 6, 8, 24, c, .25); ell(37, 6, 8, 24, c, -.25); ell(0, 10, 23, 35, c2); eyeW(-13, -18, 7); eyeW(13, -18, 7); tri([-8, -8], [8, -8], [0, 4], ISCAKE ? '#F28C28' : '#000'); if (!ISCAKE) tri([-6, -7], [6, -7], [0, 2], '#fff'); ell(-14, 47, 11, 4, ISCAKE ? '#F28C28' : c); ell(14, 47, 11, 4, ISCAKE ? '#F28C28' : c); }
        else if (id === 'dino') { [[-24, -22, -14, -40, -4, -24], [-4, -30, 6, -48, 16, -30], [14, -24, 24, -40, 32, -18]].forEach(function (t) { tri([t[0], t[1]], [t[2], t[3]], [t[4], t[5]], c2); }); ell(38, 28, 14, 8, c, -.5); ell(0, 8, 42, 36, c); ell(0, 22, 24, 17, c2 === c ? '#F7C531' : c2); eyes(-4, 17, 4.6); circ(-4, 8, 1.6, onBody); circ(4, 8, 1.6, onBody); smile(0, 6, 8); cheeks(8, 29); }
        else if (id === 'fish') { tri([28, 0], [52, -22], [52, 22], c2); tri([-6, -22], [8, -40], [18, -20], c2); ell(-4, 0, 40, 28, c); ell(-4, 8, 26, 12, c2 === c ? '#fff' : c2); eyeW(-24, -6, 7); smile(-24, 8, 7, onBody); P(cx, onBody, function () { cx.arc(10, -6, 0.1, 0, 7); }); circ(-34, 8, 4, cheek || 'rgba(255,255,255,.0)'); }
        else if (id === 'owl') { tri([-34, -30], [-30, -50], [-12, -36], c); tri([34, -30], [30, -50], [12, -36], c); ell(0, 6, 38, 44, c); ell(0, 22, 24, 24, c2); eyeW(-16, -8, 13); eyeW(16, -8, 13); tri([-6, 4], [6, 4], [0, 15], ISCAKE ? '#F28C28' : '#fff'); ell(-37, 12, 9, 24, c, .15); ell(37, 12, 9, 24, c, -.15); }
        else if (id === 'frog') { ell(0, 14, 44, 32, c); circ(-24, -18, 14, c); circ(24, -18, 14, c); eyeW(-24, -18, 9); eyeW(24, -18, 9); smile(0, 6, 22, onBody); circ(-6, 6, 1.8, onBody); circ(6, 6, 1.8, onBody); cheeks(20, 30); if (cheek) { } }
        else if (id === 'ghost') { P(cx, c, function () { cx.moveTo(-36, 44); cx.lineTo(-36, -4); cx.arc(0, -4, 36, Math.PI, 0); cx.lineTo(36, 44); cx.quadraticCurveTo(27, 34, 18, 44); cx.quadraticCurveTo(9, 34, 0, 44); cx.quadraticCurveTo(-9, 34, -18, 44); cx.quadraticCurveTo(-27, 34, -36, 44); cx.closePath(); }); eyes(-6, 14, 5); ell(0, 12, 6, 8, onBody); cheeks(8, 26); }
        else if (id === 'robot') { line(0, -34, 0, -46, c, 4); circ(0, -48, 5, c2); ell(-42, 6, 5, 12, c); ell(42, 6, 5, 12, c); P(cx, c, function () { cx.roundRect ? cx.roundRect(-36, -34, 72, 62, 12) : cx.rect(-36, -34, 72, 62); }); P(cx, c2, function () { cx.roundRect ? cx.roundRect(-27, -24, 54, 32, 8) : cx.rect(-27, -24, 54, 32); }); circ(-12, -8, 5.5, dark); circ(12, -8, 5.5, dark); line(-12, 18, 12, 18, onBody, 3.5); P(cx, c, function () { cx.rect(-18, 28, 36, 14); }); }
        else if (id === 'sunny') { for (var i = 0; i < 12; i++) { cx.save(); cx.rotate(i * Math.PI / 6); ell(0, -42, 5, 9, c2); cx.restore(); } circ(0, 0, 32, c); eyes(-4, 12, 4.2); smile(0, 6, 8); cheeks(8, 21); }
        else if (id === 'starry') { P(cx, c, function () { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; (i ? cx.lineTo : cx.moveTo).call(cx, r * Math.cos(a), 4 + r * Math.sin(a)); } cx.closePath(); }); cx.lineJoin = 'round'; eyes(4, 10, 3.8); smile(0, 12, 6); cheeks(14, 17); }
        else if (id === 'cloudy') { P(cx, c, function () { cx.moveTo(-34, 30); cx.arc(-30, 8, 22, Math.PI * .5, Math.PI * 1.5); cx.arc(-8, -14, 22, Math.PI, Math.PI * 1.9); cx.arc(22, -4, 24, Math.PI * 1.5, Math.PI * .4); cx.arc(34, 14, 16, -.5, Math.PI * .5); cx.lineTo(-34, 30); cx.closePath(); }); eyes(8, 14, 4.2); smile(0, 14, 7); cheeks(18, 24); }
        else { P(cx, c2, function () { cx.moveTo(-34, -4); cx.lineTo(34, -4); cx.lineTo(26, 44); cx.lineTo(-26, 44); cx.closePath(); }); [-14, 0, 14].forEach(function (x) { line(x, 0, x * .78, 40, ISCAKE ? 'rgba(0,0,0,.14)' : '#000', 2.4); }); ell(0, -8, 38, 16, c); ell(0, -24, 28, 14, c); ell(0, -38, 18, 11, c); circ(0, -50, 6, ISCAKE ? '#E4572E' : c2); eyes(-8, 12, 3.6); smile(0, -2, 6); }
    }
    function drawItem(cx, ppm, it) {
        cx.save(); cx.translate(it.x * ppm, it.y * ppm); cx.rotate(it.rot * Math.PI / 180);
        cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
        var col = mkInk(it.color), col2 = mkInk(it.color2 || it.color);
        if (it.type === 'text') {
            var lines = String(it.text || '').split('\n');
            cx.font = (it.s * ppm) + 'px "' + it.font + '", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = col;
            lines.forEach(function (l, i) { cx.fillText(l, 0, (i - (lines.length - 1) / 2) * it.s * 1.15 * ppm); });
        } else if (it.type === 'shape') {
            var sb = shapeBox(it.shape), k = it.s * ppm / sb.w, pr = it.prop || 1;
            cx.scale(k, k * pr); cx.translate(-(sb.b[0] + sb.w / 2), -(sb.b[1] + sb.h / 2));
            if (it.fill) { cx.fillStyle = col; cx.fill(sb.s.path); }
            else { cx.strokeStyle = col; cx.lineWidth = 0.9 * ppm / k; cx.lineJoin = 'round'; cx.stroke(sb.s.path); }
        } else if (it.type === 'emoji') {
            cx.drawImage(emojiBitmap(it.emoji), -it.s * ppm / 2, -it.s * ppm / 2, it.s * ppm, it.s * ppm);
        } else if (it.type === 'flower' || it.type === 'friend') {
            var f = it.s * ppm / 100; cx.scale(f, f); cx.lineJoin = 'round';
            (it.type === 'flower' ? drawFlower : drawFriend)(cx, it.flower || it.friend, col, col2);
        } else if (it.type === 'image') {
            cx.drawImage(it.img, -it.s * ppm / 2, -it.s * it.ar * ppm / 2, it.s * ppm, it.s * it.ar * ppm);
        }
        cx.restore();
    }
    function mkPaint(cv, ppm, edit) {
        var W = surfW(), H = surfH();
        var FO = frameOff(), FF = frameF();
        cv.width = Math.round((edit ? FF : W) * ppm); cv.height = Math.round((edit ? FF : H) * ppm);
        var cx = cv.getContext('2d'); cx.clearRect(0, 0, cv.width, cv.height);
        if (edit) cx.translate(FO.x * ppm, FO.y * ppm);
        if (edit) {
            roundRect(cx, 0, 0, W * ppm, H * ppm, 0.8 * ppm); ivoryFill(cx, W, H, ppm); cx.fill();
            if (MARGIN > 0) { cx.save(); cx.strokeStyle = 'rgba(200,70,70,.55)'; cx.setLineDash([4, 4]); cx.lineWidth = 1.2; cx.strokeRect(MARGIN * ppm, MARGIN * ppm, (W - 2 * MARGIN) * ppm, (H - 2 * MARGIN) * ppm); cx.restore(); }
        }
        MK.items.forEach(function (it) { drawItem(cx, ppm, it); });
        if (edit && MK.sel > -1 && MK.items[MK.sel]) {
            var it = MK.items[MK.sel], sz = itemSize(it);
            cx.save(); cx.translate(it.x * ppm, it.y * ppm); cx.rotate(it.rot * Math.PI / 180);
            cx.strokeStyle = '#2b6cff'; cx.lineWidth = 1.5; cx.setLineDash([5, 4]); cx.strokeRect(-sz.w * ppm / 2 - 3, -sz.h * ppm / 2 - 3, sz.w * ppm + 6, sz.h * ppm + 6); cx.restore();
        }
    }
    function mkRedraw() {
        if (drawFrame) return;
        drawFrame = requestAnimationFrame(function () { drawFrame = 0; if (!$('#mk').hidden) { mkPaint(mkcv, MK.ppm, true); mkSync(); } });
    }
    function ensureFont(it) {
        if (it.type !== 'text' || !document.fonts || !document.fonts.load) return;
        document.fonts.load('40px "' + it.font + '"', it.text || 'Aa').then(mkRedraw, function () { });
    }
    function mkAdd(it) {
        it.id = MK.uid++; if (it.rot == null) it.rot = 0;
        MK.items.push(it); MK.sel = MK.items.length - 1; ensureFont(it); mkRedraw();
    }
    function mkCentre() { return { x: surfW() / 2, y: surfH() / 2 }; }
    var SPOTS = [[0, 0], [-1, -.6], [1, .6], [1, -.6], [-1, .6], [0, -1], [0, 1], [-1.7, 0], [1.7, 0]];
    var spotN = 0;
    function spot() { var p = SPOTS[spotN++ % SPOTS.length], u = Math.min(surfW() - 2 * MARGIN, 60) / 4.4, v = (surfH() - 2 * MARGIN) / 3.4; return { x: surfW() / 2 + p[0] * u, y: surfH() / 2 + p[1] * v }; }
    function addText() {
        var t = $('#mk-text').value.replace(/\s+$/, '') || T('Name');
        var c = spot(); mkAdd({ type: 'text', text: t, font: MK.font, s: Math.min(11, (surfW() - 2 * MARGIN) / Math.max(3, t.length) * 1.7), x: c.x, y: c.y, color: MK_COLORS[0] });
    }
    function thumbIcon(canvas, kind, id, def) {
        var x = canvas.getContext('2d'); x.translate(32, 32); x.scale(0.6, 0.6); x.lineJoin = 'round';
        var c = ISCAKE ? def.c : '#000', c2 = ISCAKE ? def.c2 : '#fff';
        if (ISCAKE && c.toUpperCase() === '#FFFFFF') c = '#cfd6dc';
        (kind === 'flower' ? drawFlower : drawFriend)(x, id, c, c2);
    }
    function mkBuild() {
        var tabs = ISCAKE ? [['text', 'Text'], ['shape', 'Shapes'], ['emoji', 'Emojis'], ['friend', 'Friends'], ['flower', 'Flowers']] : [['text', 'Text'], ['shape', 'Frames']];
        $('#mk-tabs').innerHTML = tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '">' + esc(T(t[1])) + '</button>'; }).join('');
        var fonts = FONT_LIST.map(function (f) { return '<button type="button" class="mk-font" data-font="' + f.id + '" style="font-family:\'' + f.id + '\',sans-serif"' + (f.ar ? ' lang="ar"' : '') + '>' + esc(f.ar ? f.ar + ' ' + f.id : f.id) + '</button>'; }).join('');
        MK.bodies = {
            text: '<label class="mk-lbl" for="mk-text">' + esc(T('Type a name or message')) + '</label><textarea id="mk-text" rows="2" maxlength="60" placeholder="' + esc(T('Name')) + '"></textarea>' +
                '<button type="button" class="gt-btn mk-addbtn" id="mk-addtext">' + esc(T('Add as new text')) + '</button>' +
                '<p class="mk-lbl">' + esc(T('Font')) + '</p><div class="mk-fonts" id="mk-fonts">' + fonts + '</div>',
            shape: (ISCAKE ? '' : '<p class="st-fine">' + esc(T('Simple frames, drawn as a fine line. Add your text inside with the Text tab.')) + '</p>') + '<div class="mk-grid" id="mk-shapes">' + SHAPES.filter(function (s) { return ISCAKE || CHOC_SHAPES.indexOf(s.id) > -1; }).map(function (s) { var b = s.box; return '<button type="button" data-shape="' + s.id + '" title="' + esc(T(s.label)) + '"><svg viewBox="' + (b[0] - 6) + ' ' + (b[1] - 6) + ' ' + (b[2] - b[0] + 12) + ' ' + (b[3] - b[1] + 12) + '"><path d="' + s.d + '" fill="currentColor"/></svg></button>'; }).join('') + '</div>',
            emoji: '<div class="mk-grid mk-emoji" id="mk-emojis">' + EMOJIS.map(function (e) { return '<button type="button" data-emoji="' + e + '">' + e + '</button>'; }).join('') + '</div>' + (ISCAKE ? '' : '<p class="st-fine">' + esc(T('On chocolate, emojis print as one-colour ink.')) + '</p>'),
            friend: '<p class="st-fine">' + esc(T('Our own friendly characters. You can change their colours.')) + '</p><div class="mk-grid mk-flowers" id="mk-friends">' + FRIENDS.map(function (f) { return '<button type="button" data-friend="' + f.id + '"><canvas width="64" height="64" data-k="friend" data-f="' + f.id + '"></canvas><span>' + esc(T(f.label)) + '</span></button>'; }).join('') + '</div>',
            flower: '<div class="mk-grid mk-flowers" id="mk-flowers">' + FLOWERS.map(function (f) { return '<button type="button" data-flower="' + f.id + '"><canvas width="64" height="64" data-k="flower" data-f="' + f.id + '"></canvas><span>' + esc(T(f.label)) + '</span></button>'; }).join('') + '</div>'
        };
        $('#mk-sel').innerHTML =
            '<div class="mk-sel-top"><b>' + esc(T('Selected')) + '</b><span><button type="button" class="st-btn" id="mk-dup">' + esc(T('Duplicate')) + '</button> <button type="button" class="st-btn" id="mk-front">' + esc(T('To front')) + '</button> <button type="button" class="st-btn" id="mk-del">' + esc(T('Delete')) + '</button></span></div>' +
            '<div class="mk-colors" id="mk-cols"></div><div class="mk-colors" id="mk-cols2" hidden></div>' +
            '<label class="st-check mk-outline" id="mk-s-fill" hidden><input type="checkbox" id="mk-fill"><span><b>' + esc(T('Filled')) + '</b></span></label>' +
            '<label class="st-range"><span>' + esc(T('Size')) + '</span><input type="range" id="mk-size" min="3" max="60" step="0.5"><output id="mk-size-o"></output></label>' +
            '<label class="st-range" id="mk-prop-w"><span>' + esc(T('Stretch (height)')) + '</span><input type="range" id="mk-prop" min="25" max="250" step="1"><output id="mk-prop-o"></output></label>' +
            '<label class="st-range"><span>' + esc(T('Rotation')) + '</span><input type="range" id="mk-rot" min="-180" max="180" step="1"><output id="mk-rot-o"></output></label>';
        function sw(cols, id) { return cols.map(function (c) { return '<button type="button" class="mk-sw" data-c="' + c + '" data-for="' + id + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join(''); }
        $('#mk-cols').innerHTML = '<small id="mk-cols-l">' + esc(T('Colour')) + '</small>' + sw(MK_COLORS, 1);
        $('#mk-cols2').innerHTML = '<small id="mk-cols2-l"></small>' + sw(MK_COLORS, 2);
        var tb = $('#mk-tabbody'), selItem = function () { return MK.items[MK.sel]; };
        $('#mk-tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.tab !== MK.tab) { MK.sel = -1; mkTab(b.dataset.tab); mkRedraw(); } });
        tb.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return; var c = spot(), f;
            if (b.id === 'mk-addtext') return addText();
            if (b.dataset.font) { MK.font = b.dataset.font; var it0 = selItem(); if (it0 && it0.type === 'text') { it0.font = MK.font; ensureFont(it0); } mkRedraw(); return; }
            if (b.dataset.shape) { if (!ISCAKE) c = mkCentre(); mkAdd({ type: 'shape', shape: b.dataset.shape, s: ISCAKE ? 16 : 34, prop: 1, fill: ISCAKE, x: c.x, y: c.y, color: MK_COLORS[0] }); }
            if (b.dataset.emoji) mkAdd({ type: 'emoji', emoji: b.dataset.emoji, s: 12, x: c.x, y: c.y, color: '#000' });
            if (b.dataset.flower) { f = FLOWERS.filter(function (z) { return z.id === b.dataset.flower; })[0]; mkAdd({ type: 'flower', flower: f.id, s: 15, x: c.x, y: c.y, color: ISCAKE ? f.c : '#000000', color2: ISCAKE ? f.c2 : '#FFFFFF' }); }
            if (b.dataset.friend) { f = FRIENDS.filter(function (z) { return z.id === b.dataset.friend; })[0]; mkAdd({ type: 'friend', friend: f.id, s: 20, x: c.x, y: c.y, color: ISCAKE ? f.c : '#000000', color2: ISCAKE ? f.c2 : '#FFFFFF' }); }
        });
        tb.addEventListener('input', function (e) { if (e.target.id === 'mk-text') { var it = selItem(); if (it && it.type === 'text') { it.text = e.target.value || ' '; mkRedraw(); } } });
        $('#mk-sel').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return; var it = selItem(); if (!it) return;
            if (b.id === 'mk-del') { MK.items.splice(MK.sel, 1); MK.sel = -1; }
            else if (b.id === 'mk-dup') { var cp = {}; for (var k in it) cp[k] = it[k]; cp.x += 3; cp.y += 3; cp.id = MK.uid++; MK.items.push(cp); MK.sel = MK.items.length - 1; }
            else if (b.id === 'mk-front') { MK.items.push(MK.items.splice(MK.sel, 1)[0]); MK.sel = MK.items.length - 1; }
            else if (b.classList.contains('mk-sw')) { if (b.dataset.for === '2') it.color2 = b.dataset.c; else it.color = b.dataset.c; }
            mkRedraw();
        });
        $('#mk-fill').addEventListener('change', function () { var it = selItem(); if (it) { it.fill = this.checked; mkRedraw(); } });
        $('#mk-size').addEventListener('input', function () { var it = selItem(); if (it) { it.s = +this.value; mkRedraw(); } });
        $('#mk-prop').addEventListener('input', function () { var it = selItem(); if (it) { it.prop = +this.value / 100; mkRedraw(); } });
        $('#mk-rot').addEventListener('input', function () { var it = selItem(); if (it) { it.rot = +this.value; mkRedraw(); } });
    }
    function mkTab(t) {
        MK.tab = t;
        $$('#mk-tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); b.classList.toggle('on', b.dataset.tab === t); });
        $('#mk-tabbody').innerHTML = MK.bodies[t];
        if (t === 'text') FONT_LIST.forEach(function (f) { if (document.fonts && document.fonts.load) document.fonts.load('20px "' + f.id + '"').catch(function () { }); });
        $$('#mk-tabbody canvas[data-f]').forEach(function (c) {
            var list = c.dataset.k === 'flower' ? FLOWERS : FRIENDS;
            thumbIcon(c, c.dataset.k, c.dataset.f, list.filter(function (z) { return z.id === c.dataset.f; })[0]);
        });
        mkSyncTab();
    }
    function mkSyncTab() {
        if (MK.tab !== 'text') return;
        var it = MK.items[MK.sel], ta = $('#mk-text'), cur = it && it.type === 'text' ? it.font : MK.font;
        if (ta && it && it.type === 'text' && document.activeElement !== ta) ta.value = it.text;
        $$('#mk-fonts .mk-font').forEach(function (x) { x.classList.toggle('on', x.dataset.font === cur); });
    }
    function mkSync() {
        mkSyncTab();
        var it = MK.items[MK.sel], on = !!it;
        $('#mk-sel').hidden = !on; if (!on) return;
        $('#mk-cols').hidden = it.type === 'emoji' || it.type === 'image';
        var two = it.type === 'flower' || it.type === 'friend';
        $('#mk-cols2').hidden = !two; if (two) $('#mk-cols2-l').textContent = it.type === 'flower' ? T('Centre') : T('Accent');
        $('#mk-s-fill').hidden = it.type !== 'shape'; $('#mk-fill').checked = !!it.fill;
        $('#mk-prop-w').hidden = it.type !== 'shape'; if (it.type === 'shape') { $('#mk-prop').value = (it.prop || 1) * 100; $('#mk-prop-o').textContent = Math.round((it.prop || 1) * 100) + '%'; }
        $$('#mk-cols .mk-sw').forEach(function (b) { b.classList.toggle('on', b.dataset.c.toUpperCase() === String(it.color || '').toUpperCase()); });
        $$('#mk-cols2 .mk-sw').forEach(function (b) { b.classList.toggle('on', b.dataset.c.toUpperCase() === String(it.color2 || '').toUpperCase()); });
        $('#mk-size').value = it.s; $('#mk-size-o').textContent = num(it.s, 1) + ' mm';
        $('#mk-rot').value = it.rot; $('#mk-rot-o').textContent = Math.round(it.rot) + '°';
    }
    function mkHit(p) {
        for (var i = MK.items.length - 1; i >= 0; i--) {
            var it = MK.items[i], sz = itemSize(it), r = -it.rot * Math.PI / 180, dx = p.x - it.x, dy = p.y - it.y;
            var lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r), pad = 1.2;
            if (Math.abs(lx) <= sz.w / 2 + pad && Math.abs(ly) <= sz.h / 2 + pad) return i;
        }
        return -1;
    }
    function mkPointer() {
        var ptr = {}, g = null;
        function mm(e) { var r = mkcv.getBoundingClientRect(), F = frameF(), o = frameOff(); return { x: (e.clientX - r.left) / r.width * F - o.x, y: (e.clientY - r.top) / r.height * F - o.y }; }
        mkcv.addEventListener('pointerdown', function (e) {
            e.preventDefault(); mkcv.setPointerCapture(e.pointerId); ptr[e.pointerId] = mm(e);
            var ids = Object.keys(ptr);
            if (ids.length === 1) {
                var h = mkHit(ptr[e.pointerId]); MK.sel = h; mkRedraw();
                if (h > -1) { var it = MK.items[h]; g = { mode: 'move', ox: ptr[e.pointerId].x - it.x, oy: ptr[e.pointerId].y - it.y }; } else g = null;
            } else if (ids.length === 2 && MK.items[MK.sel]) {
                var a = ptr[ids[0]], b = ptr[ids[1]], it2 = MK.items[MK.sel];
                g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), s0: it2.s, r0: it2.rot };
            }
        });
        mkcv.addEventListener('pointermove', function (e) {
            if (!ptr[e.pointerId] || !g) return; ptr[e.pointerId] = mm(e);
            var it = MK.items[MK.sel]; if (!it) return;
            if (g.mode === 'move') { var m = ptr[e.pointerId]; it.x = clamp(m.x - g.ox, 0, surfW()); it.y = clamp(m.y - g.oy, 0, surfH()); }
            else { var ids = Object.keys(ptr); if (ids.length < 2) return; var a = ptr[ids[0]], b = ptr[ids[1]]; it.s = clamp(g.s0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0, 3, 60); var r = g.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - g.a0) * 180 / Math.PI; it.rot = ((r + 540) % 360) - 180; }
            mkRedraw();
        });
        function up(e) { delete ptr[e.pointerId]; if (!Object.keys(ptr).length) g = null; }
        mkcv.addEventListener('pointerup', up); mkcv.addEventListener('pointercancel', up);
        mkcv.addEventListener('wheel', function (e) { var it = MK.items[MK.sel]; if (!it) return; e.preventDefault(); it.s = clamp(it.s * (e.deltaY < 0 ? 1.05 : 0.95), 3, 60); mkRedraw(); }, { passive: false });
    }
    function mkSnapshot() {
        if (!S.cb || S.cb.empty || !S.art) return null;
        var c = makeCanvas(S.cb.w, S.cb.h); c.getContext('2d').drawImage(S.art, S.cb.x, S.cb.y, S.cb.w, S.cb.h, 0, 0, c.width, c.height);
        return { type: 'image', img: c, s: S.p.w, ar: S.cb.h / S.cb.w, x: S.p.x, y: S.p.y, rot: S.p.rot, id: MK.uid++, color: '#000' };
    }
    function mkOpen(scratch) {
        MK.scratch = !!scratch;
        var cur = S.versions[S.ver];
        if (cur && cur.kind === 'made' && cur.items) MK.items = cur.items.map(function (i) { var c = {}; for (var k in i) c[k] = i[k]; return c; });
        else { MK.items = []; var im = !scratch && mkSnapshot(); if (im) MK.items.push(im); }
        MK.sel = -1; spotN = 0;
        $('#mk').hidden = false; document.body.classList.add('mk-lock');
        mkTab(MK.tab || 'text'); mkRedraw();
        MK.items.forEach(ensureFont);
    }
    function mkClose() { $('#mk').hidden = true; document.body.classList.remove('mk-lock'); }
    function hasInk(c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (var i = 3; i < d.length; i += 16) if (d[i] > 20) return true; return false; }
    function mkDone() {
        if (!MK.items.length) { toastMsg(T('Add something first: text, a shape, an emoji or a flower.')); return; }
        var items = MK.items, scratch = MK.scratch;
        if (finishMade(items, scratch)) mkClose();
    }
    function finishMade(items, scratch) {
        var keep = MK.items; MK.items = items;
        var ppm = Math.min(24, WORK / surfW()), c = makeCanvas(surfW() * ppm, surfH() * ppm);
        mkPaint(c, ppm, false); MK.items = keep;
        if (!hasInk(c)) { toastMsg(T('Nothing to print yet.')); return false; }
        var v = { kind: 'made', label: 'My design', src: c, transparent: true, items: items.map(function (i) { return i; }) };
        if (scratch && !S.versions.length) {
            canvasBlob(c).then(function (b) { var f = new File([b], 'my-design.png', { type: 'image/png' }); startDesign(f, c, c.width, c.height, v); });
            return true;
        }
        var idx = -1; S.versions.forEach(function (x, i) { if (x.kind === 'made') idx = i; });
        if (idx > 0) { var m = maskFromCanvas(c); v.mask = m.mask; v.thumb = thumbOf(c); v.id = S.versions[idx].id; S.versions[idx] = v; S.fitted = false; selectVersion(idx); }
        else { S.fitted = false; addVersion(v); }
        goStep(2);
        return true;
    }
    /* pick a ready-made friendly character: no photo needed */
    function startFriend(id) {
        var f = FRIENDS.filter(function (z) { return z.id === id; })[0]; if (!f) return;
        var u = Math.min(surfW(), surfH()) - 2 * MARGIN;
        var item = { type: 'friend', friend: f.id, s: Math.max(10, u * 0.92), x: surfW() / 2, y: surfH() / 2, rot: 0, id: MK.uid++, color: ISCAKE ? f.c : '#000000', color2: ISCAKE ? f.c2 : '#FFFFFF' };
        finishMade([item], !S.versions.length);
    }
    function buildFriendGallery() {
        var box = $('#st-friends'); if (!box) return;
        box.innerHTML = FRIENDS.map(function (f) { return '<button type="button" data-friend="' + f.id + '" title="' + esc(T(f.label)) + '"><canvas width="64" height="64" data-f="' + f.id + '"></canvas><span>' + esc(T(f.label)) + '</span></button>'; }).join('');
        $$('canvas[data-f]', box).forEach(function (c) { thumbIcon(c, 'friend', c.dataset.f, FRIENDS.filter(function (z) { return z.id === c.dataset.f; })[0]); });
        box.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) startFriend(b.dataset.friend); });
    }

    /* - / + buttons beside every slider, so values can be changed one step at a time (hold to repeat) */
    function enhanceRanges(root) {
        $$('.st-range input[type=range]', root).forEach(function (inp) {
            if (inp.parentNode.classList.contains('st-rng')) return;
            var w = doc.createElement('div'); w.className = 'st-rng';
            var minus = doc.createElement('button'), plus = doc.createElement('button');
            minus.type = plus.type = 'button'; minus.className = plus.className = 'st-step';
            minus.textContent = '−'; plus.textContent = '+'; minus.setAttribute('aria-label', 'Decrease'); plus.setAttribute('aria-label', 'Increase');
            inp.parentNode.insertBefore(w, inp); w.appendChild(minus); w.appendChild(inp); w.appendChild(plus);
            function bump(dir) {
                var st = +inp.step || 1, v = +inp.value + dir * st, mn = +inp.min, mx = +inp.max;
                v = Math.round(Math.max(mn, Math.min(mx, v)) / st) * st; inp.value = v;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
            function hold(btn, dir) {
                var t1 = 0, t2 = 0;
                function stop() { clearTimeout(t1); clearInterval(t2); }
                btn.addEventListener('pointerdown', function (e) { e.preventDefault(); bump(dir); t1 = setTimeout(function () { t2 = setInterval(function () { bump(dir); }, 70); }, 380); });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
                btn.addEventListener('click', function (e) { if (e.detail === 0) bump(dir); });
            }
            hold(minus, -1); hold(plus, 1);
        });
    }
    function setupEditor() {
        mkcv = $('#mk-cv'); mkBuild(); mkPointer();
        enhanceRanges(doc);
        $('#mk-cancel').addEventListener('click', mkClose);
        $('#mk-done').addEventListener('click', mkDone);
        $('#st-create').addEventListener('click', function () { if (!rightsOk()) return; mkOpen(!S.versions.length); });
        $('#st-decor').addEventListener('click', function () { mkOpen(false); });
        if ($('#st-chars')) $('#st-chars').addEventListener('click', function () { MK.tab = 'friend'; mkOpen(true); });
        buildFriendGallery();
        doc.addEventListener('keydown', function (e) {
            if ($('#mk').hidden) return;
            if (e.key === 'Escape') mkClose();
            if ((e.key === 'Delete' || e.key === 'Backspace') && MK.sel > -1 && !/TEXTAREA|INPUT/.test(e.target.tagName)) { MK.items.splice(MK.sel, 1); MK.sel = -1; mkRedraw(); }
        });
        window.addEventListener('resize', function () { if (!$('#mk').hidden) mkRedraw(); });
    }

    /* ------------------------------ admin test mode ------------------------------ */
    function updateTest() {
        var B = backend(), on = !!(B && B.isAdmin && B.isAdmin());
        S.test = on; var el = $('#st-test'); if (el) el.hidden = !on;
    }

    function applyText() {
        var h = $('.st-hero h1'), l = $('.st-lead'), ch = $$('.st-chips li');
        if (ST.title && h) h.textContent = ST.title;
        if (ST.lead && l) l.textContent = ST.lead;
        if (ST.chips && ST.chips.length && ch.length) { var ul = $('.st-chips'); ul.innerHTML = ST.chips.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join(''); }
    }


    /* ------------------------------ legal protection: reminders, agreements, content check ------------------------------ */
    function LG() { return window.GTLegal ? GTLegal.get() : null; }
    var RIGHTS_KEY = 'gt-rights-ok';
    function rightsOk(msg) {
        var cb = $('#st-rights-ok'); if (!cb) return true;
        if (cb.checked) return true;
        var box = $('#st-rights'); if (box) { box.classList.add('bad'); if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        if (msg !== false) showUpErr(T('Please tick the box in "Before you upload" first.'));
        return false;
    }
    function setupLegal() {
        var L = LG(); if (!L) return;
        var host = $('#st-uploadpane') || $('#st-drop').parentNode, first = $('#st-drop');
        var box = doc.createElement('div'); box.className = 'st-rights'; box.id = 'st-rights';
        box.innerHTML = '<p class="st-rights-t">' + esc(T('Before you upload')) + '</p><ul>' + L.reminder.map(function (r) { return '<li>' + esc(T(r)) + '</li>'; }).join('') + '</ul>' +
            '<label class="st-agree"><input type="checkbox" id="st-rights-ok"><span>' + GTLegal.withLinks(L.consent.upload) + '</span></label>';
        if (first && first.parentNode === host) host.insertBefore(box, first); else host.insertBefore(box, host.firstChild);
        var cb = $('#st-rights-ok');
        try { cb.checked = sessionStorage.getItem(RIGHTS_KEY) === '1'; } catch (e) {}
        cb.addEventListener('change', function () { try { sessionStorage.setItem(RIGHTS_KEY, cb.checked ? '1' : '0'); } catch (e) {} box.classList.toggle('bad', !cb.checked && false); if (cb.checked) { box.classList.remove('bad'); showUpErr(''); } });
        // stop the file chooser from opening until the customer has agreed
        var drop = $('#st-drop'); if (drop) drop.addEventListener('click', function (e) { if (!rightsOk()) { e.preventDefault(); e.stopPropagation(); } }, true);
        // the four approvals on the last step: review, rights, lawful content, tolerance
        var ap = $('.st-approve'); if (ap) {
            var labels = $$('label.st-check', ap), keep0 = labels[0] && labels[0].outerHTML, keep2 = labels[labels.length - 1] && labels[labels.length - 1].outerHTML;
            var mid = L.consent.studio.map(function (t) { return '<label class="st-check"><input type="checkbox" class="st-ap"><span>' + GTLegal.withLinks(t) + '</span></label>'; }).join('');
            ap.innerHTML = keep0 + mid + keep2;
            $$('.st-ap').forEach(function (c) { c.addEventListener('change', updateAddBtn); });
        }
    }
    function legalStudio() {
        var L = LG(); if (!L) return null;
        return { version: L.version, accepted_at: new Date().toISOString(), uploaded_confirmed: !!($('#st-rights-ok') && $('#st-rights-ok').checked), statements: L.consent.studio.map(function (t) { return GTLegal.plain(t); }) };
    }
    /* words we never draw: protected brands and characters, famous people, religious figures, adult or illegal subjects */
    var BLOCKED = /\b(disney|mickey|minnie|pixar|marvel|spider-?man|batman|superman|avengers|iron ?man|hulk|pokemon|pikachu|hello ?kitty|sanrio|nike|adidas|puma|gucci|louis ?vuitton|chanel|dior|hermes|prada|rolex|cartier|tiffany|coca-?cola|pepsi|starbucks|mcdonald|kfc|ferrari|lamborghini|porsche|bugatti|real ?madrid|barcelona|manchester|liverpool|chelsea|arsenal|messi|ronaldo|trump|biden|putin|naruto|goku|dragon ?ball|one ?piece|frozen|elsa|minecraft|mario|nintendo|playstation|barbie|lego|paw ?patrol|peppa|cocomelon|bluey|snoopy|winnie|doraemon|totoro|ghibli|star ?wars|harry ?potter|simpsons|shrek|minions?|jesus|allah|prophet|quran|bible|nude|naked|nsfw|porn|sex|sexy|cannabis|marijuana|weed|cocaine|drugs?|gun|rifle|pistol|bomb|terror\w*|swastika|isis|hitler)\b/i;
    function blockedSubject(q) { return BLOCKED.test(String(q || '')); }

    /* ------------------------------ AI drawing from words (chocolate) ------------------------------ */
    function setupAiDraw() {
        var open = $('#st-aidraw-open'); if (!open) return;
        var box = $('#st-aidraw'), txt = $('#st-aidraw-text'), go = $('#st-aidraw-go'), err = $('#st-aidraw-err'), st = $('#st-aidraw-status'), style = ISCAKE ? 'cute' : 'sketch', busy = false;
        function showErr(m, html) { if (html) err.innerHTML = m; else err.textContent = m || ''; err.hidden = !m; }
        open.addEventListener('click', function () { box.hidden = !box.hidden; if (!box.hidden) { txt.focus(); box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } });
        $('#st-aidraw-ex').addEventListener('click', function (e) { var b = e.target.closest('.st-chip'); if (b) { txt.value = b.textContent; txt.focus(); } });
        $('#st-aidraw-styles').addEventListener('click', function (e) {
            var b = e.target.closest('.st-sty'); if (!b) return; style = b.dataset.style;
            $$('.st-sty').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        });
        go.addEventListener('click', function () {
            var q = txt.value.trim(); showErr('');
            if (busy) return;
            if (q.length < 3) return showErr(T('Please describe what you would like to see.'));
            if (!rightsOk(false)) return showErr(T('Please tick the box in "Before you upload" first.'));
            if (blockedSubject(q)) return showErr(T('We cannot draw protected brands, cartoon characters, real people, religious figures or sensitive subjects. Please describe something original, for example a landmark, an animal or an object.'));
            if (needLogin()) return showErr(esc(T('AI drawing is free for signed-in customers.')) + ' ' + LOGIN_HTML, true);
            if (!aiOn()) return showErr(T('AI drawing is not available right now. Please upload your own picture, or choose "Write a message or monogram".'));
            busy = true; go.disabled = true; st.hidden = false; st.textContent = T('Drawing your design... this takes about 30 seconds.');
            B_ready().then(function () { return backend().studioGenerate(q, style, PRODUCT); })
                .then(blobToCanvas)
                .then(function (c) {
                    if (ISCAKE) { var fc = new File([new Blob([''], { type: 'image/png' })], 'ai-drawing.png', { type: 'image/png' }); return startDesign(fc, c, c.width, c.height); }
                    var ink = bwToAlpha(c), f = new File([new Blob([''], { type: 'image/png' })], 'ai-drawing.png', { type: 'image/png' });
                    startDesign(f, ink, c.width, c.height, { kind: 'bw', label: 'AI drawing', src: ink, gen: true, ai: true, transparent: true });
                })
                .catch(function (e) { try { console.error('AI draw failed:', e && e.message, e && e.detail); } catch (_x) {} showErr(T(/limit|describe|sign in|used your|busy/i.test(e && e.message) ? e.message : 'We could not draw this right now. Please try different words, or upload your own picture.') + (S.test && e && (e.detail || e.message) ? ' [admin: ' + (e.detail || e.message) + ']' : '')); })
                .then(function () { busy = false; go.disabled = false; st.hidden = true; });
        });
    }
    /* ------------------------------ start ------------------------------ */
    function init() {
        setupSteps(); setupPlacement(); setupEditor(); setupAiDraw(); setupLegal();
        var file = $('#st-file'), drop = $('#st-drop');
        file.addEventListener('change', function () { loadFile(file.files[0]); file.value = ''; });
        ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
        ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
        drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
        $('#st-up-change').addEventListener('click', function () { file.click(); });
        $('#st-up-remove').addEventListener('click', resetDesign);
        var file2 = $('#st-file2');
        file2.addEventListener('change', function () { loadFile(file2.files[0]); file2.value = ''; });
        $('#st-photo-change').addEventListener('click', function () { file2.click(); });
        var rmBtn = $('#st-photo-remove'), rmTimer = 0, rmText = rmBtn.textContent;      // two taps instead of a pop-up (pop-ups can be blocked)
        rmBtn.addEventListener('click', function () {
            if (!rmBtn.classList.contains('armed')) {
                rmBtn.classList.add('armed'); rmBtn.textContent = T('Tap again to remove this design');
                rmTimer = setTimeout(function () { rmBtn.classList.remove('armed'); rmBtn.textContent = rmText; }, 4000); return;
            }
            clearTimeout(rmTimer); rmBtn.classList.remove('armed'); rmBtn.textContent = rmText; resetDesign();
        });
        if (!ISCAKE) {
            renderBoxSet();
            setupBoxMap(); $('#st-copyall').addEventListener('click', copyToAll);
            $('#st-nextpiece').addEventListener('click', function () { loadSlot(S.slot + 1); });
            $('#pv-pieces').addEventListener('click', function (e) { var b = e.target.closest('.st-pvp'); if (b) { S.pvPiece = +b.dataset.i; renderPreview(); } });
            var mh = $('.mk-hint'); if (mh) mh.textContent = T('Tap an item to select it. Drag to move, pinch to resize.');
        }
        $('#st-sample').addEventListener('click', function () {
            var c = sampleCanvas();
            canvasBlob(c).then(function (b) { var f = new File([b], (ISCAKE ? 'sample-character.png' : 'sample-logo.png'), { type: 'image/png' }); startDesign(f, c, 800, 800); });
        });
        $$('.st-ai').forEach(function (b) { b.addEventListener('click', function () { generate(b.dataset.kind); }); });
        $('#ai-retry').addEventListener('click', function () { generate(S.lastKind || (ISCAKE ? 'cutout' : 'bw')); });
        $('#ver-strip').addEventListener('click', function (e) { var b = e.target.closest('.st-ver'); if (b) selectVersion(+b.dataset.i); });
        $('#st-designer').addEventListener('change', function () { S.designer = this.checked; $('#st-dnote-wrap').hidden = !this.checked; updateSummary(); });
        $('#st-dnote').addEventListener('input', function () { S.designerNote = this.value; });
        $('#pv-tol').addEventListener('change', renderPreview);
        $$('.st-ap').forEach(function (c) { c.addEventListener('change', updateAddBtn); });
        $('#st-add').addEventListener('click', addToCart);

        var g = $('#st-guide');
        $('#st-guide-open').addEventListener('click', function (e) { e.preventDefault(); g.hidden = false; });
        $('#st-guide-close').addEventListener('click', function () { g.hidden = true; });
        g.addEventListener('click', function (e) { if (e.target === g) g.hidden = true; });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') g.hidden = true; });

        window.addEventListener('resize', function () { if (S.step === 2) schedScene(); });
        var B = backend();
        if (B) { B.ready.then(function () { updateTest(); if (B.onAuth) { B.onAuth(updateTest); B.onAuth(refreshAiMode); } refreshAiMode(); }); }
        applyText();
        if (B && B.ready && B.content) B.ready.then(function () { return B.content(); }).then(function (c) {
            if (!c || !c.studio) return;
            applyCfg(c.studio); applyText();
            if (S.qty > TIERS.length - 1) S.qty = TIERS.length - 1;
            if (S.boxSet > BOXSETS.length - 1) S.boxSet = 0;
            if (S.nbox < MINBOX) S.nbox = MINBOX;
            if (!ISCAKE) renderBoxSet();
            if (!BOXES.some(function (b) { return b.id === S.box; })) S.box = BOXES[0].id;
            if (!THICK.some(function (t) { return t.id === S.thick; })) S.thick = THICK[0].id;
            if (S.step === 4) renderPricing(); updateSummary();
        }).catch(function () { });
        goStep(1);
        booted = true;
        updateSummary();
        window.GTStudio = { state: S, goStep: goStep, product: PRODUCT };
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
