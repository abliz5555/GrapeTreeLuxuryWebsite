/* Remembers where a visitor came from (Instagram, TikTok, WhatsApp, a QR code...) for 30 days,
   so every order says which channel it came from. Nothing personal is stored.
   Use links like  https://grapetree.ae/links.html?utm_source=instagram&utm_medium=bio  */
(function () {
    'use strict';
    var KEY = 'gt-src', DAYS = 30;
    function get() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && Date.now() - o.t < DAYS * 864e5) return o; } catch (e) {} return null; }
    function param(n) { var m = new RegExp('[?&]' + n + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 60) : ''; }
    var src = param('utm_source') || param('ref') || (param('fbclid') ? 'facebook/instagram' : '') || (param('ttclid') ? 'tiktok' : '');
    if (src) {
        try { localStorage.setItem(KEY, JSON.stringify({ s: src, m: param('utm_medium'), c: param('utm_campaign'), t: Date.now() })); } catch (e) {}
    } else if (!get() && document.referrer) {
        try {
            var h = new URL(document.referrer).hostname.replace(/^www\./, '');
            if (h && h !== location.hostname) localStorage.setItem(KEY, JSON.stringify({ s: h, m: 'referral', c: '', t: Date.now() }));
        } catch (e) {}
    }
    window.GT = window.GT || {};
    window.GT.source = function () {
        var o = get(); if (!o) return '';
        return o.s + (o.m ? ' / ' + o.m : '') + (o.c ? ' / ' + o.c : '');
    };
})();
