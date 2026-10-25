/* =====================================================================
   GRAPE TREE - CHECKOUT
   Shows the cart, checks the delivery form, then sends the order request:
     1. by email (through your Formspree form, see shop-data.js)
     2. and offers a ready-made WhatsApp message
   No payment is taken here. You confirm the price on WhatsApp first.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {} };
    var CFG = DATA.config || {};

    var esc = function (s) { return window.GT.esc(s); };
    var money = function (n) { return window.GT.money(n); };
    var cartApi = function () { return window.GT.cart; };
    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

    var finished = false;

    /* ------------------------------ dates ------------------------------ */
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function minDate() {
        var d = new Date();
        d.setDate(d.getDate() + (CFG.leadDays || 2));
        return iso(d);
    }
    function niceDate(s) {
        if (!s) return '';
        var p = s.split('-');
        return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /* ------------------------------ summary ------------------------------ */
    function linePrice(l) {
        if (CFG.showPrices === false) return 'Price on request';
        if (l.included) return 'Included';
        if (l.quote && !l.unit && !l.fee) return 'Quoted';
        return money(cartApi().lineTotal(l));
    }

    function renderSummary() {
        var items = cartApi().items();
        var form = $('#co-form'), empty = $('#co-empty'), summary = $('#co-summary'), done = $('#co-done');
        if (finished) return;

        form.hidden = !items.length;
        empty.hidden = !!items.length;
        summary.hidden = !items.length;
        done.hidden = true;
        $('#checkout').classList.toggle('is-empty', !items.length);

        $('#co-lines').innerHTML = items.map(function (l) {
            var meta = (l.meta || []).map(function (m) {
                return '<li><span>' + esc(m[0]) + '</span> ' + esc(m[1]) + '</li>';
            }).join('');
            return '<div class="co-line">' +
                '<img src="' + esc(l.img) + '" alt="">' +
                '<div>' +
                '<h4>' + esc(l.name) + '</h4>' +
                (meta ? '<ul class="gt-li-meta">' + meta + '</ul>' : '') +
                (l.fixed ? '' :
                '<div class="gt-qty" role="group" aria-label="Quantity">' +
                '<button type="button" data-act="dec" data-key="' + l.key + '" aria-label="Decrease">&minus;</button>' +
                '<span>' + l.qty + '</span>' +
                '<button type="button" data-act="inc" data-key="' + l.key + '" aria-label="Increase">+</button></div>') +
                '<button type="button" class="gt-rm" data-act="rm" data-key="' + l.key + '" style="display:block">Remove</button>' +
                '</div>' +
                '<span class="co-price">' + esc(linePrice(l)) + '</span></div>';
        }).join('');

        var t = cartApi().totals();
        $('#co-totals').innerHTML =
            '<div class="gt-sum"><span>Estimated total' + (t.hasQuote ? ' <em>(quoted items extra)</em>' : '') + '</span>' +
            '<strong>' + esc(CFG.showPrices === false ? 'On request' : money(t.subtotal)) + '</strong></div>' +
            '<p class="gt-fine">' + esc(CFG.deliveryNote || '') + '</p>';

        /* default the date to the latest custom-order date, if there is one */
        var dateInput = $('#f-date');
        var wanted = items.reduce(function (m, l) { return l.date && l.date > m ? l.date : m; }, '');
        if (!dateInput.value && wanted) dateInput.value = wanted;
    }

    /* ------------------------------ form ------------------------------ */
    function field(id) { return $('#' + id).closest('.field'); }
    function setInvalid(id, bad) { field(id).classList.toggle('invalid', !!bad); return !!bad; }

    /* legal reminders + the agreement the customer must tick (the text comes from the admin Legal tab) */
    function drawLegal() {
        if (!window.GTLegal) return;
        var L = GTLegal.get(), ul = $('#co-legal-list'), tx = $('#co-agree-text');
        if (ul) ul.innerHTML = L.reminder.map(function (r) { return '<li>' + GTLegal.esc(T(r)) + '</li>'; }).join('');
        if (tx) tx.innerHTML = GTLegal.withLinks(L.consent.checkout);
    }
    drawLegal(); doc.addEventListener('gt:content', drawLegal);
    function legalRecord() {
        var L = window.GTLegal ? GTLegal.get() : { version: 1, consent: { checkout: '' } };
        return { version: L.version, accepted: true, client_time: new Date().toISOString(), statements: [window.GTLegal ? GTLegal.plain(L.consent.checkout) : 'Terms accepted'] };
    }
    function validate() {
        var bad = [];
        var ag = $('#co-agree'); if (ag) { var miss = !ag.checked; $('#co-agree-err').hidden = !miss; $('#co-legal').classList.toggle('bad', miss); if (miss) bad.push('co-agree'); }
        if (setInvalid('f-name', !$('#f-name').value.trim())) bad.push('f-name');
        var digits = $('#f-phone').value.replace(/\D/g, '');
        if (setInvalid('f-phone', digits.length < 7)) bad.push('f-phone');
        var email = $('#f-email').value.trim();
        if (setInvalid('f-email', !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) bad.push('f-email');
        if (setInvalid('f-emirate', !$('#f-emirate').value)) bad.push('f-emirate');
        if (setInvalid('f-address', $('#f-address').value.trim().length < 6)) bad.push('f-address');
        var d = $('#f-date').value;
        if (setInvalid('f-date', !d || d < minDate())) bad.push('f-date');
        if (bad.length) { var fe = $('#' + bad[0]); if (fe) { fe.focus(); if (bad[0] === 'co-agree' && fe.scrollIntoView) fe.scrollIntoView({ block: 'center' }); } }
        return !bad.length;
    }

    function orderText(c, no) {
        var items = cartApi().items(), t = cartApi().totals();
        var out = ['*New order request - Grape Tree*' + (no ? ' #' + no : ''), '',
            'Name: ' + c.name,
            'Phone: ' + c.phone];
        if (c.email) out.push('Email: ' + c.email);
        out.push('Emirate: ' + c.emirate, 'Address: ' + c.address, 'Delivery date: ' + niceDate(c.date), '', '*Items*');
        items.forEach(function (l, i) {
            var price = CFG.showPrices === false ? '' : ' - ' + (l.included ? 'included' : l.quote && !l.unit && !l.fee ? 'quoted' : money(cartApi().lineTotal(l)));
            out.push((i + 1) + '. ' + l.name + ' x ' + l.qty + price);
            (l.meta || []).forEach(function (m) { out.push('   - ' + m[0] + ': ' + m[1]); });
            if (l.note) out.push('   - Notes: ' + l.note);
        });
        if (CFG.showPrices !== false) out.push('', 'Estimated total: ' + money(t.subtotal) + (t.hasQuote ? ' + quoted items' : ''));
        if (c.notes) out.push('', 'Notes: ' + c.notes);
        out.push('', 'Payment: ' + (c.pay === 'bank' ? 'Bank transfer' : 'Confirm on WhatsApp'));
        var from = window.GT && window.GT.source ? window.GT.source() : '';
        if (from) out.push('', 'Came from: ' + from);
        return out.join('\n');
    }

    function sendEmail(payload) {
        if (!CFG.formEndpoint) return Promise.reject(new Error('no endpoint'));
        var ctl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
        return fetch(CFG.formEndpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctl ? ctl.signal : undefined
        }).then(function (r) {
            clearTimeout(timer);
            if (!r.ok) throw new Error('bad status ' + r.status);
            return true;
        });
    }

    function showDone(ok, text, name, extra) {
        extra = extra || {};
        finished = true;
        var wa = 'https://wa.me/' + (CFG.whatsapp || '971555577478') + '?text=' + encodeURIComponent(text);
        var first = esc((name || '').split(' ')[0]);
        $('#co-form').hidden = true;
        $('#co-summary').hidden = true;
        $('#co-empty').hidden = true;
        $('#checkout').classList.add('is-done');
        var box = $('#co-done');
        box.hidden = false;
        box.innerHTML = ok
            ? '<div class="co-success"><div class="tick" aria-hidden="true"></div>' +
              '<h2>Thank you' + (first ? ', ' + first : '') + '</h2>' +
              (extra.no ? '<p class="co-no">' + esc(T('Order number')) + ': <strong>#' + esc(extra.no) + '</strong></p>' : '') +
              '<p>Your order request has been sent. We will confirm availability, price and delivery with you shortly. For the fastest reply, you can also send it to us on WhatsApp now.</p>' +
              (extra.pay === 'bank' && bankText ? '<div class="co-bank"><strong>' + esc(T('Bank details')) + '</strong><pre dir="ltr">' + esc(bankText) + '</pre><p>' + esc(T('Please send the transfer receipt on WhatsApp with your order number. We prepare your order once the payment arrives.')) + '</p></div>' : '') +
              '<a class="gt-btn" href="' + wa + '" target="_blank" rel="noopener">Send on WhatsApp</a>' +
              (extra.no ? '<a class="gt-btn gt-btn-outline" href="order-track.html?no=' + esc(extra.no) + '">' + esc(T('Track this order')) + '</a>' : '') +
              '<a class="gt-btn gt-btn-outline" href="invoice.html?last=1&print=1" target="_blank" rel="noopener">Download order PDF</a>' +
              '<a class="gt-btn gt-btn-outline" href="shop.html">Back to the shop</a></div>'
            : '<div class="co-success"><h2>One more step</h2>' +
              '<p>We could not send your request by email just now. Please send it to us on WhatsApp instead. Your order details are already filled in.</p>' +
              '<a class="gt-btn" href="' + wa + '" target="_blank" rel="noopener">Send on WhatsApp</a>' +
              '<button type="button" class="gt-btn gt-btn-outline" id="co-retry">Try again</button></div>';

        if (ok) studioAfter(box, extra, wa);
        if (ok) cartApi().clear();
        var retry = $('#co-retry');
        if (retry) retry.addEventListener('click', function () {
            finished = false;
            $('#co-done').hidden = true;
            $('#checkout').classList.remove('is-done');
            renderSummary();
        });
        var top = $('.page-title');
        if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }


    /* design files from the cake studio: tidy up once uploaded, or let the customer download them */
    function studioAfter(box, extra, wa) {
        var arts = extra.arts || [], items = extra.items || [], failed = [];
        arts.forEach(function (a, i) {
            if (!a || !items[i] || !items[i].art) return;
            if (a.failed || !extra.no) failed.push(items[i].art.id);
            else if (window.GTStore) window.GTStore.del(items[i].art.id).catch(function () {});
        });
        if (!failed.length || !window.GTStore) return;
        var note = doc.createElement('div');
        note.className = 'co-bank';
        note.innerHTML = '<strong>' + esc(T('Your design files')) + '</strong><p>' + esc(T('We could not upload your design files automatically. Please download them below and send them to us on WhatsApp together with your order.')) + '</p><div class="co-files"></div>';
        box.querySelector('.co-success').appendChild(note);
        failed.forEach(function (id) {
            window.GTStore.get(id).then(function (d) {
                if (!d) return;
                [['print', 'print-file.png', 'Print file'], ['preview', 'preview.png', 'Preview'], ['svg', 'cut-line.svg', 'Cut line'], ['orig', d.origName || 'original', 'Original image']].forEach(function (f) {
                    if (!d[f[0]]) return;
                    var a = doc.createElement('a');
                    a.className = 'gt-link'; a.style.display = 'inline-block'; a.style.margin = '4px 14px 4px 0';
                    a.href = URL.createObjectURL(d[f[0]]); a.download = f[1]; a.textContent = T(f[2]);
                    note.querySelector('.co-files').appendChild(a);
                });
            });
        });
    }

    function onSubmit(e) {
        e.preventDefault();
        if (!validate()) return;
        var c = {
            name: $('#f-name').value.trim(),
            phone: $('#f-phone').value.trim(),
            email: $('#f-email').value.trim(),
            emirate: $('#f-emirate').value,
            address: $('#f-address').value.trim(),
            date: $('#f-date').value,
            notes: $('#f-notes').value.trim()
        };
        if ($('[name="_gotcha"]').value) return;      // a bot filled the hidden field
        c.pay = ($('input[name=pay]:checked') || {}).value || 'whatsapp';
        var btn = $('#co-submit');
        btn.disabled = true;
        btn.textContent = T('Sending...');

        var B = window.GT.backend;
        var cartItems = cartApi().items(), lines = [], artResults = [];
        var useDb = !!(B && B.enabled);
        var artUp = (useDb && B.uploadStudio) ? Promise.all(cartItems.map(function (l) {
            if (!l.art) return null;
            return B.uploadStudio(l.art).catch(function () { return { id: l.art.id, failed: true }; });
        })) : Promise.resolve(cartItems.map(function (l) { return l.art ? { id: l.art.id, failed: true } : null; }));
        var saved = artUp.then(function (arts) {
            artResults = arts;
            lines = cartItems.map(function (l, i) {
                var o = { test: !!l.test, id: l.id, name: l.name, qty: l.qty, total: cartApi().lineTotal(l), quote: !!l.quote, meta: l.meta || [], note: l.note || '' };
                if (l.art) o.art = arts[i];
                return o;
            });
            if (!useDb) return null;
            return B.placeOrder({ name: c.name, phone: c.phone, email: c.email, emirate: c.emirate, address: c.address,
                delivery_date: c.date, notes: c.notes, payment_method: c.pay, items: lines, legal: legalRecord(),
                source: lines.some(function (x) { return x.test; }) ? 'admin-test' : (window.GT.source ? window.GT.source() : '') }).catch(function () { return null; });
        });
        saved.then(function (res) {
            var no = res && res.order_no, text = orderText(c, no);
            var payload = {
                _subject: (lines.some(function (x) { return x.test; }) ? '[TEST] ' : '') + 'New order request' + (no ? ' #' + no : '') + ' - Grape Tree',
                name: c.name, phone: c.phone, email: c.email, emirate: c.emirate,
                address: c.address, delivery_date: c.date, notes: c.notes, order: text
            };
            var tot = cartApi().totals();
            return sendEmail(payload).then(function () { return true; }, function () { return false; }).then(function (mailOk) {
                try {
                    localStorage.setItem('gt-last-order', JSON.stringify({ order_no: no || '', created_at: new Date().toISOString(), name: c.name, phone: c.phone, email: c.email,
                        emirate: c.emirate, address: c.address, delivery_date: c.date, notes: c.notes, payment_method: c.pay, items: lines,
                        subtotal: tot.subtotal, has_quote: !!tot.hasQuote, status: 'new', payment_status: 'unpaid' }));
                } catch (e) {}
                showDone(!!(no || mailOk), text, c.name, { no: no, pay: c.pay, arts: artResults, items: cartItems });
            });
        }).then(function () {
            btn.disabled = false;
            btn.textContent = T('Send order request');
        });
    }

    /* ------------------------------ start ------------------------------ */
    function init() {
        if (!$('#co-form')) return;

        var sel = $('#f-emirate');
        sel.innerHTML = '<option value="">Choose an emirate</option>' +
            (CFG.emirates || []).map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('');

        $('#f-date').min = minDate();
        $('#co-note').textContent = (CFG.paymentNote || '');
        $('#co-note').hidden = !CFG.paymentNote;

        $('#co-form').addEventListener('submit', onSubmit);
        $('#co-form').addEventListener('input', function (e) {
            var f = e.target.closest('.field');
            if (f) f.classList.remove('invalid');
        });

        $('#co-summary').addEventListener('click', function (e) {
            var t = e.target.closest('[data-act]');
            if (!t) return;
            var key = t.getAttribute('data-key');
            var line = cartApi().items().filter(function (l) { return l.key === key; })[0];
            var act = t.getAttribute('data-act');
            if (act === 'rm') cartApi().remove(key);
            else if (line && act === 'inc') cartApi().setQty(key, line.qty + 1);
            else if (line && act === 'dec') { if (line.qty > 1) cartApi().setQty(key, line.qty - 1); else cartApi().remove(key); }
        });

        cartApi().onChange(renderSummary);
        renderSummary();
        setupPayment();
        prefill();
    }

    /* ------------------------------ payment choice + saved details ------------------------------ */
    var bankText = '';
    function T(s) { return window.GT.lang ? window.GT.lang.t(s) : s; }
    function setupPayment() {
        var B = window.GT.backend;
        var opts = [{ v: 'whatsapp', t: 'Confirm on WhatsApp', d: 'We confirm the price and send you a secure payment link.' }];
        function draw() {
            var box = $('#co-pay-options');
            box.innerHTML = opts.map(function (o, i) {
                return '<label class="co-opt"><input type="radio" name="pay" value="' + o.v + '"' + (i === 0 ? ' checked' : '') + '>' +
                    '<span><strong>' + esc(o.t) + '</strong><small>' + esc(o.d) + '</small></span></label>';
            }).join('');
            $('#co-pay').hidden = opts.length < 2;
            $$('input[name=pay]', box).forEach(function (r) { r.addEventListener('change', showBank); });
            showBank();
        }
        function showBank() {
            var v = ($('input[name=pay]:checked') || {}).value, b = $('#co-bank');
            b.hidden = !(v === 'bank' && bankText);
            if (!b.hidden) b.innerHTML = '<strong>' + esc(T('Bank details')) + '</strong><pre dir="ltr">' + esc(bankText) + '</pre><p>' + esc(T('Please send the transfer receipt on WhatsApp with your order number. We prepare your order once the payment arrives.')) + '</p>';
        }
        draw();
        if (B && B.enabled) B.content().then(function (c) {
            var st = (c && c.settings) || {};
            if (st.bank_details && String(st.bank_details).trim()) {
                bankText = String(st.bank_details).trim();
                opts.push({ v: 'bank', t: 'Bank transfer', d: 'Pay by transfer to our bank account. Details are shown after you order.' });
                draw();
            }
        });
    }
    function prefill() {
        var B = window.GT.backend;
        if (!B || !B.enabled) return;
        function fill() {
            var p = B.profile, u = B.user();
            if (!u) return;
            function set(id, v) { var el = $(id); if (el && !el.value && v) el.value = v; }
            set('#f-name', p && p.full_name); set('#f-phone', p && p.phone); set('#f-email', u.email);
            B.myAddresses().then(function (rows) {
                if (rows && rows[0]) { set('#f-address', rows[0].address); var s = $('#f-emirate'); if (s && !s.value) s.value = rows[0].emirate; }
            }, function () {});
        }
        B.ready.then(fill);
        B.onAuth(fill);
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})();
