/* =====================================================================
   GRAPE TREE - CUSTOM ORDER BUILDER
   Reads the steps from shop-data.js (builders), keeps the live summary,
   and adds the finished custom order to the cart.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {}, builders: {} };
    var CFG = DATA.config || {};
    var BUILDERS = DATA.builders || {};
    var STEP_LABEL = { design: 'Design', product: 'Gift', motif: 'Gold motif', qty: 'Quantity' };

    var esc = function (s) { return window.GT.esc(s); };
    var money = function (n) { return window.GT.money(n); };
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

    var state, B, bid;

    /* ------------------------------ dates ------------------------------ */
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function minDate() {
        var d = new Date();
        d.setDate(d.getDate() + (CFG.leadDays || 2));
        return iso(d);
    }
    function niceDate(s) {
        var p = s.split('-');
        return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /* ------------------------------ state ------------------------------ */
    function fresh() {
        return { sel: {}, qty: 1, extras: {}, extraText: {}, date: '', notes: '' };
    }
    function stepById(id) {
        return B.steps.filter(function (s) { return s.id === id; })[0];
    }
    function optById(step, id) {
        return (step.options || []).filter(function (o) { return o.id === id; })[0];
    }

    function setBuilder(id, preselect) {
        if (!BUILDERS[id]) id = Object.keys(BUILDERS)[0];
        bid = id;
        B = BUILDERS[id];
        state = fresh();
        if (preselect) {
            Object.keys(preselect).forEach(function (k) {
                var st = stepById(k);
                if (st && st.type === 'tiles' && optById(st, preselect[k])) state.sel[k] = preselect[k];
            });
        }
        renderSwitch();
        renderSteps();
        renderSummary();
    }

    /* ------------------------------ calculation ------------------------------ */
    function calc() {
        var unit = 0, fee = 0, quote = false, meta = [], img = B.cover, missing = [];

        B.steps.forEach(function (s) {
            if (s.type === 'tiles') {
                var o = optById(s, state.sel[s.id]);
                if (o) {
                    unit += o.price || 0;
                    if (o.quote) quote = true;
                    if (o.img) img = o.img;
                    meta.push([STEP_LABEL[s.id] || s.title, o.label]);
                } else if (s.required) {
                    missing.push(s.title.charAt(0).toLowerCase() + s.title.slice(1));
                }
            }
            if (s.type === 'checks') {
                s.options.forEach(function (o) {
                    if (!state.extras[o.id]) return;
                    var label = o.label;
                    if (o.text) {
                        var t = (state.extraText[o.id] || '').trim();
                        if (!t) missing.push('write your card message');
                        else label += ': “' + t + '”';
                    }
                    if (o.quote) quote = true;
                    var p = o.price || 0;
                    if (o.per === 'unit') unit += p; else fee += p;
                    meta.push(['Extra', label]);
                });
            }
        });

        if (!state.date) missing.push('pick a delivery date');
        else if (state.date < minDate()) missing.push('pick a later delivery date');

        return {
            unit: unit, fee: fee, quote: quote, meta: meta, img: img, missing: missing,
            total: unit * state.qty + fee
        };
    }

    function totalText(c) {
        if (CFG.showPrices === false) return 'Price on request';
        if (c.quote && c.total === 0) return 'Quoted';
        return money(c.total) + (c.quote ? ' +' : '');
    }

    /* ------------------------------ render: switch ------------------------------ */
    function renderSwitch() {
        var host = $('#builder-switch');
        host.innerHTML = Object.keys(BUILDERS).map(function (id) {
            var b = BUILDERS[id];
            return '<button type="button" class="switch-card' + (id === bid ? ' active' : '') + '" data-builder="' + esc(id) + '" aria-pressed="' + (id === bid) + '">' +
                '<img src="' + esc(b.cover) + '" alt="">' +
                '<span><strong>' + esc(b.label) + '</strong><span>' + esc(b.blurb) + '</span></span></button>';
        }).join('');
    }

    /* ------------------------------ render: steps ------------------------------ */
    function tileHTML(s, o) {
        var price = '';
        if (o.quote) price = 'Price quoted';
        else if (o.price > 0 && CFG.showPrices !== false) price = money(o.price) + (B.unit ? ' per ' + B.unit : '');
        var inner = o.img
            ? '<span class="t-img"><img src="' + esc(o.img) + '" alt="" loading="lazy"></span>'
            : '<span class="t-plain" aria-hidden="true">' + (o.quote ? '+' : '○') + '</span>';
        var on = state.sel[s.id] === o.id;
        return '<button type="button" class="tile' + (o.img ? '' : ' no-img') + (on ? ' selected' : '') + '" role="radio" aria-checked="' + on + '" data-step="' + esc(s.id) + '" data-opt="' + esc(o.id) + '">' +
            inner +
            '<span class="t-text"><span class="t-name">' + esc(o.label) + '</span>' +
            (price ? '<span class="t-price">' + esc(price) + '</span>' : '') +
            (o.help ? '<span class="t-help">' + esc(o.help) + '</span>' : '') +
            '</span></button>';
    }

    function stepHTML(s, n) {
        var head = '<div class="b-head"><span class="b-num">' + n + '</span><h3>' + esc(s.title) + '</h3></div>';
        var body = '';

        if (s.type === 'tiles') {
            body = '<div class="tiles" role="radiogroup" aria-label="' + esc(s.title) + '">' +
                s.options.map(function (o) { return tileHTML(s, o); }).join('') + '</div>';
        }

        if (s.type === 'qty') {
            body = '<div class="qty-row">' +
                '<div class="gt-qty" role="group" aria-label="Quantity">' +
                '<button type="button" data-q="dec" aria-label="Decrease">&minus;</button>' +
                '<input type="number" id="qty-input" inputmode="numeric" min="' + (s.min || 1) + '" max="' + (s.max || 999) + '" value="' + state.qty + '" aria-label="Quantity">' +
                '<button type="button" data-q="inc" aria-label="Increase">+</button></div>' +
                '<div class="presets">' + (s.presets || []).map(function (p) {
                    return '<button type="button" class="chip" data-preset="' + p + '">' + p + '</button>';
                }).join('') + '</div></div>' +
                (s.help ? '<p class="b-help">' + esc(s.help) + '</p>' : '');
        }

        if (s.type === 'checks') {
            body = s.options.map(function (o) {
                var price = o.quote ? 'Quoted' : (CFG.showPrices === false ? '' : '+ ' + money(o.price || 0));
                var on = !!state.extras[o.id];
                return '<label class="check' + (on ? ' on' : '') + '" data-extra="' + esc(o.id) + '">' +
                    '<input type="checkbox"' + (on ? ' checked' : '') + '>' +
                    '<span class="box" aria-hidden="true"></span>' +
                    '<span class="c-main"><span class="c-name">' + esc(o.label) + '</span>' +
                    (o.help ? '<span class="c-help">' + esc(o.help) + '</span>' : '') + '</span>' +
                    '<span class="c-price">' + esc(price) + '</span></label>' +
                    (o.text
                        ? '<div class="field check-text' + (on ? ' show' : '') + '" data-text-for="' + esc(o.id) + '">' +
                          '<label for="txt-' + esc(o.id) + '">' + esc(o.text) + '</label>' +
                          '<textarea id="txt-' + esc(o.id) + '" rows="2" maxlength="140" placeholder="e.g. Happy birthday, Sara!">' + esc(state.extraText[o.id] || '') + '</textarea></div>'
                        : '');
            }).join('');
        }

        if (s.type === 'details') {
            body = '<div class="f-grid">' +
                '<div class="field"><label for="d-date">Delivery date</label>' +
                '<input type="date" id="d-date" min="' + minDate() + '" value="' + esc(state.date) + '"></div>' +
                '<div class="field full"><label for="d-notes">Notes <span class="opt">(optional)</span></label>' +
                '<textarea id="d-notes" placeholder="Occasion, colours, allergies, delivery instructions...">' + esc(state.notes) + '</textarea></div>' +
                '</div>' +
                '<p class="b-help">Earliest delivery date is ' + esc(niceDate(minDate())) + '. Need it sooner? Message us on WhatsApp.</p>';
        }

        return '<div class="b-step" data-step-id="' + esc(s.id) + '">' + head + body + '</div>';
    }

    function renderSteps() {
        $('#steps').innerHTML = B.steps.map(function (s, i) { return stepHTML(s, i + 1); }).join('');
    }

    /* ------------------------------ render: summary ------------------------------ */
    var lastImg = '';
    function renderSummary() {
        var c = calc();

        $('#sum-title').textContent = B.label;

        var rows = c.meta.slice();
        var unitWord = B.unit ? (state.qty > 1 ? B.unit + (/(x|s|ch|sh)$/.test(B.unit) ? 'es' : 's') : B.unit) : '';
        rows.push(['Quantity', state.qty + (unitWord ? ' ' + unitWord : '')]);
        if (state.date) rows.push(['Deliver by', niceDate(state.date)]);
        $('#sum-list').innerHTML = rows.map(function (r) {
            return '<li><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></li>';
        }).join('');

        var t = totalText(c);
        $('#sum-total').textContent = t;
        $('#bar-total').textContent = t;
        $('#sum-note').textContent = c.quote
            ? 'Includes items we quote after seeing your request. This is an estimate; we confirm the final price with you before payment.'
            : 'This is an estimate. We confirm the final price and delivery with you before payment.';

        var ready = c.missing.length === 0;
        $('#sum-add').disabled = !ready;
        $('#bar-add').disabled = !ready;
        $('#sum-missing').textContent = ready ? '' : 'To continue: ' + c.missing[0] + '.';

        /* preview picture, with a quick cross-fade */
        var img = $('#sum-img');
        if (c.img !== lastImg) {
            lastImg = c.img;
            img.style.opacity = '0';
            setTimeout(function () { img.src = c.img; img.style.opacity = '1'; }, 160);
        }

        /* WhatsApp shortcut with the current choices */
        var lines = ['Hello Grape Tree, I would like to place a custom order:', '', B.label];
        rows.forEach(function (r) { lines.push('- ' + r[0] + ': ' + r[1]); });
        if (state.notes.trim()) lines.push('- Notes: ' + state.notes.trim());
        lines.push('', 'Estimate: ' + t);
        $('#sum-wa').href = 'https://wa.me/' + (CFG.whatsapp || '971555577478') + '?text=' + encodeURIComponent(lines.join('\n'));
    }

    /* ------------------------------ actions ------------------------------ */
    function setQty(n, s) {
        var min = (s && s.min) || 1, max = (s && s.max) || 999;
        n = parseInt(n, 10);
        if (isNaN(n)) n = min;
        state.qty = Math.max(min, Math.min(max, n));
        var input = $('#qty-input');
        if (input && doc.activeElement !== input) input.value = state.qty;
        renderSummary();
    }

    function addToCart() {
        var c = calc();
        if (c.missing.length) { renderSummary(); return; }
        var ids = B.steps.filter(function (s) { return s.type === 'tiles'; })
            .map(function (s) { return state.sel[s.id]; }).join('-');
        var meta = c.meta.slice();
        meta.push(['Deliver by', niceDate(state.date)]);
        window.GT.cart.add({
            id: 'custom-' + bid + '-' + ids,
            name: B.label + ' (custom order)',
            img: c.img,
            unit: c.unit,
            fee: c.fee,
            qty: state.qty,
            quote: c.quote,
            meta: meta,
            date: state.date,
            note: state.notes.trim()
        });
        window.GT.toast('Custom order added to your cart', true);
    }

    /* ------------------------------ events ------------------------------ */
    function bind() {
        var steps = $('#steps');

        $('#builder-switch').addEventListener('click', function (e) {
            var b = e.target.closest('[data-builder]');
            if (!b || b.getAttribute('data-builder') === bid) return;
            setBuilder(b.getAttribute('data-builder'));
            try { history.replaceState(null, '', location.pathname + '?builder=' + bid); } catch (err) {}
        });

        steps.addEventListener('click', function (e) {
            var tile = e.target.closest('.tile');
            if (tile) {
                var sid = tile.getAttribute('data-step');
                state.sel[sid] = tile.getAttribute('data-opt');
                $$('.tile[data-step="' + sid + '"]', steps).forEach(function (t) {
                    var on = t === tile;
                    t.classList.toggle('selected', on);
                    t.setAttribute('aria-checked', on);
                });
                renderSummary();
                return;
            }
            var q = e.target.closest('[data-q]');
            if (q) { setQty(state.qty + (q.getAttribute('data-q') === 'inc' ? 1 : -1), stepById('qty')); return; }
            var pr = e.target.closest('[data-preset]');
            if (pr) { setQty(pr.getAttribute('data-preset'), stepById('qty')); }
        });

        steps.addEventListener('change', function (e) {
            var chk = e.target.closest('.check');
            if (chk && e.target.type === 'checkbox') {
                var id = chk.getAttribute('data-extra');
                state.extras[id] = e.target.checked;
                chk.classList.toggle('on', e.target.checked);
                var tx = $('[data-text-for="' + id + '"]', steps);
                if (tx) {
                    tx.classList.toggle('show', e.target.checked);
                    if (e.target.checked) $('textarea', tx).focus();
                }
                renderSummary();
                return;
            }
            if (e.target.id === 'qty-input') { setQty(e.target.value, stepById('qty')); e.target.value = state.qty; }
            if (e.target.id === 'd-date') { state.date = e.target.value; renderSummary(); }
        });

        steps.addEventListener('input', function (e) {
            if (e.target.id === 'qty-input' && e.target.value !== '') setQty(e.target.value, stepById('qty'));
            else if (e.target.id === 'd-notes') { state.notes = e.target.value; renderSummary(); }
            else if (e.target.id === 'd-date') { state.date = e.target.value; renderSummary(); }
            else if (e.target.closest('[data-text-for]')) {
                state.extraText[e.target.closest('[data-text-for]').getAttribute('data-text-for')] = e.target.value;
                renderSummary();
            }
        });

        $('#sum-add').addEventListener('click', addToCart);
        $('#bar-add').addEventListener('click', addToCart);
    }

    /* ------------------------------ start ------------------------------ */
    function init() {
        if (!$('#steps')) return;
        var params = {};
        (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
            if (!kv) return;
            var p = kv.split('=');
            params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
        });
        bind();
        setBuilder(params.builder, params);
        if (params.builder && Object.keys(params).length > 1) {
            var el = $('#builder');
            if (el && el.scrollIntoView) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350);
        }
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})();
