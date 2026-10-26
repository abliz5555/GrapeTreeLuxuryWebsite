/* GRAPE TREE - tax and delivery maths (one place, used by checkout, receipts and emails)
   Settings come from the admin Business info page (saved as business: trn, vat_percent, prices_include_vat,
   delivery_fee, free_delivery, free_over). The server repeats this maths when the order is placed. */
(function () {
    'use strict';
    var G = window.GT = window.GT || {};
    function num(v, d) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : d; }
    function cfg() {
        var B = G.backend, c = (B && B.contentCached && B.contentCached()) || {}, b = c.business || {};
        return {
            trn: String(b.trn || '').trim(),
            vatRate: num(b.vat_percent, 5),
            incl: b.prices_include_vat === 'yes',
            fee: num(b.delivery_fee, 25),
            free: b.free_delivery === 'yes',
            freeOver: num(b.free_over, 200),
            fees: b
        };
    }
    function r2(n) { return Math.round(n * 100) / 100; }
    /* calc(subtotal) -> { subtotal, deliveryFee, freeDelivery, vatRate, vat, total, incl, trn } */
    function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
    /* delivery charge for an emirate: its own price from Business info, else the standard charge */
    function feeFor(c, emirate) {
        var k = 'fee_' + slug(emirate), v = c.fees && c.fees[k];
        return emirate && v !== undefined && v !== null && String(v).trim() !== '' && isFinite(parseFloat(v)) && parseFloat(v) >= 0 ? parseFloat(v) : c.fee;
    }
    function calc(subtotal, emirate, cfgOverride) {
        var c = cfgOverride || cfg(), sub = Number(subtotal) || 0;
        var fee = feeFor(c, emirate);
        if (c.free || (c.freeOver > 0 && sub >= c.freeOver)) fee = 0;
        var vat, total;
        if (c.incl) { vat = r2((sub + fee) * c.vatRate / (100 + c.vatRate)); total = sub + fee; }
        else { vat = r2((sub + fee) * c.vatRate / 100); total = sub + fee + vat; }
        return { subtotal: sub, deliveryFee: fee, freeDelivery: fee === 0, vatRate: c.vatRate, vat: vat, total: r2(total), incl: c.incl, trn: c.trn, standardFee: fee === 0 ? feeFor(c, emirate) : fee, freeOver: c.freeOver };
    }
    /* the figures of a saved order (older orders have no breakdown: they show only their subtotal) */
    function ofOrder(o) {
        if (o && o.total != null && o.total !== '') return { subtotal: Number(o.subtotal) || 0, deliveryFee: Number(o.delivery_fee) || 0, freeDelivery: !(Number(o.delivery_fee) > 0), vatRate: Number(o.vat_rate) || 0, vat: Number(o.vat_amount) || 0, total: Number(o.total), incl: !!o.prices_include_vat, trn: o.trn || '', legacy: false };
        var s = Number(o && o.subtotal) || 0;
        return { subtotal: s, deliveryFee: 0, freeDelivery: false, vatRate: 0, vat: 0, total: s, incl: false, trn: '', legacy: true };
    }
    if (!G.money) G.money = function (n) { n = Number(n) || 0; return 'AED ' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    /* a quote line with no price is "open" (price on request); a quote line WITH a price is only an estimate that is already inside the total */
    function openQuote(o) { if (o && o.quote_open != null) return !!o.quote_open; return !!(o && o.items || []).some(function (l) { return l && l.quote && !(Number(l.total) > 0); }); }
    /* A chocolate box set is stored as one line per print (so staff get every file), but a customer should see ONE line:
       "9-piece gift box x 25". rows = [{ name, qty, total, quote, meta, note, parts, grouped, art }] */
    function groupItems(items, totalFn) {
        var rows = [], idx = {}; totalFn = totalFn || function (l) { return Number(l.total) || 0; };
        (items || []).forEach(function (l) {
            if (!l) return;
            var g = (l.art && l.art.group) || l.group;
            if (!g) { var bx = !!(l.art && l.art.same_all); rows.push({ boxes: bx, name: l.name, qty: bx ? (l.art.qty || l.qty) : l.qty, total: totalFn(l), quote: !!l.quote, meta: l.meta || [], note: l.note || '', parts: [l], grouped: false, art: l.art, line: l }); return; }
            if (idx[g] == null) { idx[g] = rows.length; rows.push({ parts: [], grouped: true, group: g }); }
            rows[idx[g]].parts.push(l);
        });
        rows.forEach(function (r) {
            if (!r.grouped) return;
            var lead = r.parts.filter(function (l) { return l.art ? Number(l.art.piece) === 1 : !l.included; })[0] || r.parts[0];
            r.line = lead; r.art = lead.art;
            r.name = String(lead.name || '').replace(/\s*\u00b7[^\u00b7]*\d+\s*\/\s*\d+\s*$/, '');
            r.qty = (lead.art && lead.art.qty) || lead.qty || 1;
            r.total = r.parts.reduce(function (s, l) { return s + totalFn(l); }, 0);
            r.quote = r.parts.some(function (l) { return !!l.quote; });
            r.note = r.parts.map(function (l) { return l.note || ''; }).filter(Boolean).join(' ');
            r.meta = (lead.meta || []).filter(function (m, i) { return i !== 1 && i !== 3; });      // drop "Piece 1 / 9" and the single artwork label
            if (r.parts.length > 1) r.meta.push(['Prints', r.parts.length + ' different designs']);
        });
        return rows;
    }
    G.pricing = { slug: slug, cfg: cfg, calc: calc, ofOrder: ofOrder, openQuote: openQuote, groupItems: groupItems };
})();
