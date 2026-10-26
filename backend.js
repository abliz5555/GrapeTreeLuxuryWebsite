/* =====================================================================
   GRAPE TREE - BACKEND LAYER  (talks to Supabase)
   ---------------------------------------------------------------------
   Everything that needs the database goes through here: login, products,
   orders, website images. If Supabase is not set up (or cannot be reached)
   the site keeps working from shop-data.js, so a customer never sees a
   broken shop.
   Settings live in shop-data.js:  supabaseUrl  and  supabaseKey.
   ===================================================================== */
(function () {
    'use strict';

    var doc = document;
    var DATA = window.GT_DATA || { config: {}, products: [] };
    var CFG = DATA.config || {};
    var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
    var LIB2 = 'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';      // backup source if the first is blocked

    window.GT = window.GT || {};
    var B = {
        enabled: !!(CFG.supabaseUrl && CFG.supabaseKey),
        client: null,
        session: null,
        profile: null
    };
    window.GT.backend = B;

    /* Website images the admin can change. key -> label + where it appears. */
    B.SLOTS = [
        { key: 'hero_kat',   label: 'Home page: Katanukiya photo',  where: 'Home page, left side (big photo)' },
        { key: 'hero_gild',  label: 'Home page: GildArt photo',     where: 'Home page, right side (big photo)' }
    ];

    function $(s, c) { return (c || doc).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
    function withTimeout(p, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
            p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
        });
    }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (window.supabase && window.supabase.createClient) return resolve();
            var s = doc.createElement('script');
            s.src = src; s.async = true; s.crossOrigin = 'anonymous';
            s.onload = resolve; s.onerror = function () { reject(new Error('library not loaded')); };
            doc.head.appendChild(s);
        });
    }

    /* ------------------------------ protection ------------------------------ */
    /* the site must never be shown inside another website's frame (click-jacking) */
    try { if (window.top !== window.self) { doc.documentElement.style.display = 'none'; window.top.location = window.self.location; } } catch (e) { doc.documentElement.style.display = 'none'; }
    /* slow down password guessing: after 5 wrong tries this browser waits 5 minutes (the server has its own limits too) */
    var FAILS = 'gt-login-fails';
    function failState() { try { return JSON.parse(localStorage.getItem(FAILS) || '{}') || {}; } catch (e) { return {}; } }
    function failSave(s) { try { localStorage.setItem(FAILS, JSON.stringify(s)); } catch (e) {} }

    /* ------------------------------ start-up ------------------------------ */
    var authListeners = [];
    B.onAuth = function (fn) { authListeners.push(fn); };
    function emitAuth() { authListeners.forEach(function (fn) { try { fn(B.session, B.profile); } catch (e) {} }); renderAccountLink(); }

    B.ready = (function () {
        if (!B.enabled) return Promise.resolve(false);
        return withTimeout(loadScript(LIB), 9000).catch(function () { return withTimeout(loadScript(LIB2), 9000); }).then(function () {
            B.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
            });
            B.client.auth.onAuthStateChange(function (event, session) {
                B.session = session || null;
                if (event === 'PASSWORD_RECOVERY') B.recovery = true;
                if (!session) { B.profile = null; emitAuth(); return; }
                /* never call the database inside this callback itself (supabase rule), so defer */
                setTimeout(function () { loadProfile().then(function () { return sessionGuard(event); }).then(function () { emitAuth(); doc.dispatchEvent(new CustomEvent('gt:auth', { detail: { event: event } })); }); }, 0);
            });
            return B.client.auth.getSession().then(function (r) {
                B.session = (r && r.data && r.data.session) || null;
                return B.session ? loadProfile().then(function () { return sessionGuard('INIT'); }) : null;
            }).then(function () { emitAuth(); return true; });
        }).catch(function () { B.enabled = false; return false; });
    })();

    function loadProfile() {
        if (!B.client || !B.session) { B.profile = null; return Promise.resolve(null); }
        return B.client.from('profiles').select('*').eq('id', B.session.user.id).maybeSingle().then(function (r) {
            B.profile = (r && r.data) || { id: B.session.user.id, email: B.session.user.email, role: 'customer' };
            return B.profile;
        }, function () { B.profile = { id: B.session.user.id, email: B.session.user.email, role: 'customer' }; return B.profile; });
    }
    B.isAdmin = function () { return !!(B.profile && B.profile.role === 'admin'); };
    B.can = function (k) { if (!B.profile) return false; if (B.profile.role === 'admin') return true; return B.profile.role === 'staff' && (B.profile.perms || []).indexOf(k) >= 0; };
    B.isStaff = function () { return !!(B.profile && (B.profile.role === 'admin' || B.profile.role === 'staff')); };   // admin or staff: may manage orders
    B.user = function () { return B.session ? B.session.user : null; };
    function ok(r) { if (r && r.error) throw r.error; return r ? r.data : null; }


    /* ------------------- safety: one device per account + automatic sign-out when idle ------------------- */
    var IDLE_TEAM = 30 * 60000, IDLE_CUSTOMER = 2 * 3600000, ACT = 'gt-last-active';
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function sKey() { return 'gt-sess-' + (B.session && B.session.user ? B.session.user.id : ''); }
    function notice(msg) {
        try {
            var d = doc.createElement('div'); d.setAttribute('role', 'alert');
            d.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;max-width:520px;margin:0 auto;z-index:99999;background:#2a1810;color:#fff;padding:14px 16px;border-radius:12px;font:500 15px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);text-align:center';
            d.textContent = msg; doc.body.appendChild(d); setTimeout(function () { d.remove(); }, 12000);
        } catch (e) {}
    }
    function forceOut(msg) {
        if (!B.session) return Promise.resolve();
        lsSet(sKey(), null);
        return B.client.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () { B.session = null; B.profile = null; emitAuth(); notice(msg); });
    }
    function idleLimit() { return B.isStaff() ? IDLE_TEAM : IDLE_CUSTOMER; }
    function idleCheck() {
        if (!B.session) return Promise.resolve(false);
        var last = +lsGet(ACT) || 0;
        if (last && Date.now() - last > idleLimit()) { return forceOut('You were signed out because the account was not used for a while. Please sign in again.').then(function () { return true; }); }
        return Promise.resolve(false);
    }
    function sessionCheck() {
        if (!B.session || !B.client) return Promise.resolve();
        var mine = lsGet(sKey()); if (!mine) return Promise.resolve();
        return B.client.rpc('session_ok', { p_key: mine }).then(function (r) {
            if (r && !r.error && r.data === false) return forceOut('You were signed out because this account was signed in on another device.');
        }, function () {});
    }
    function sessionGuard(event) {
        if (!B.session || !B.client) return Promise.resolve();
        return idleCheck().then(function (out) {
            if (out) return;
            var fresh = B.fresh || event === 'PASSWORD_RECOVERY' || !lsGet(sKey());
            B.fresh = false; lsSet(ACT, String(Date.now()));
            if (fresh) {
                var key = Math.random().toString(36).slice(2) + Date.now().toString(36);
                lsSet(sKey(), key);
                return B.client.rpc('claim_session', { p_key: key }).then(function () {}, function () {});
            }
            return sessionCheck();
        });
    }
    (function () {
        var lastTouch = 0;
        function touch() { var n = Date.now(); if (n - lastTouch > 15000) { lastTouch = n; if (B.session) lsSet(ACT, String(n)); } }
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) { doc.addEventListener(ev, touch, { passive: true, capture: true }); });
        setInterval(function () { if (!B.session) return; idleCheck().then(function (out) { if (!out && !doc.hidden) sessionCheck(); }); }, 30000);
        doc.addEventListener('visibilitychange', function () { if (!doc.hidden && B.session) idleCheck().then(function (out) { if (!out) sessionCheck(); }); });
        window.addEventListener('focus', function () { if (B.session) idleCheck().then(function (out) { if (!out) sessionCheck(); }); });
    })();

    /* ------------------------------ accounts ------------------------------ */
    function here(page) { return new URL(page, location.href).href.split('#')[0]; }
    B.signUp = function (email, password, name, phone) {
        return B.ready.then(function () {
            return B.client.auth.signUp({ email: email, password: password, options: { data: { full_name: name || '', phone: phone || '' }, emailRedirectTo: here('account.html') } });
        }).then(ok);
    };
    B.signIn = function (email, password) {
        var fs = failState();
        if (fs.until && Date.now() < fs.until) return Promise.reject(new Error('Too many wrong attempts. Please wait ' + Math.ceil((fs.until - Date.now()) / 60000) + ' minute(s) and try again, or use "Forgot password".'));
        B.fresh = true;
        return B.ready.then(function () { return B.client.auth.signInWithPassword({ email: email, password: password }); }).then(ok).then(function (d) { failSave({}); return d; }, function (e) {
            var s = failState(); s.n = (s.n || 0) + 1; if (s.n >= 5) { s.until = Date.now() + 5 * 60000; s.n = 0; } failSave(s); throw e;
        });
    };
    B.signOut = function () { return B.ready.then(function () { var k = sKey(); lsSet(k, null); return B.client.auth.signOut({ scope: 'local' }); }).then(function () { B.session = null; B.profile = null; emitAuth(); }); };
    B.resetPassword = function (email) { return B.ready.then(function () { return B.client.auth.resetPasswordForEmail(email, { redirectTo: here('account.html') }); }).then(ok); };
    B.setPassword = function (pw) { return B.ready.then(function () { return B.client.auth.updateUser({ password: pw }); }).then(ok); };
    B.saveProfile = function (name, phone) {
        return B.client.from('profiles').update({ full_name: name, phone: phone }).eq('id', B.session.user.id).then(ok).then(function () {
            if (B.profile) { B.profile.full_name = name; B.profile.phone = phone; }
        });
    };
    B.myOrders = function () { return B.client.from('orders').select('*').eq('user_id', B.session.user.id).order('created_at', { ascending: false }).limit(100).then(ok); };
    /* order tracking: order number + the phone or email used on the order (a signed-in owner needs no contact) */
    B.trackOrder = function (no, contact) {
        return B.ready.then(function (on) {
            if (!on) throw new Error('offline');
            return B.client.rpc('track_order', { p_no: Number(no), p_contact: String(contact || '') });
        }).then(ok);
    };
    /* team (admin only) */
    B.teamList = function () { return B.client.rpc('team_list').then(ok); };
    B.teamSet = function (email, role) { return B.client.rpc('team_set', { p_email: email, p_role: role }).then(ok); };
    B.myAddresses = function () { return B.client.from('addresses').select('*').order('created_at', { ascending: false }).then(ok); };
    B.addAddress = function (a) { a.user_id = B.session.user.id; return B.client.from('addresses').insert(a).then(ok); };
    B.deleteAddress = function (id) { return B.client.from('addresses').delete().eq('id', id).then(ok); };

    /* ------------------------------ products ------------------------------ */
    function fromRow(r) {
        return {
            id: r.id, brand: r.brand, name: r.name, short: r.short || '', desc: r.description || '',
            details: Array.isArray(r.details) ? r.details : [], price: Number(r.price) || 0,
            img: r.image_url || '', customize: r.customize || null, active: r.active !== false, sort: r.sort_order, featured: !!r.featured
        };
    }
    var productsPromise = null;
    B.products = function (force) {
        if (productsPromise && !force) return productsPromise;
        productsPromise = B.ready.then(function (on) {
            if (!on) return DATA.products || [];
            return withTimeout(B.client.from('products').select('*').eq('active', true).order('sort_order', { ascending: true }).then(ok), 4500)
                .then(function (rows) { return (rows || []).map(fromRow); });      // never show old sample prices when the live list cannot be read
        }).catch(function () { return []; });
        return productsPromise;
    };
    B.allProductsAdmin = function () { return B.client.from('products').select('*').order('sort_order', { ascending: true }).then(ok).then(function (rows) { return rows.map(fromRow); }); };
    B.saveProduct = function (p, isNew) {
        var row = {
            id: p.id, brand: p.brand, name: p.name, short: p.short, description: p.desc, details: p.details,
            price: p.price, image_url: p.img, customize: p.customize || null, active: p.active, featured: !!p.featured, sort_order: p.sort, updated_at: new Date().toISOString()
        };
        var q = isNew ? B.client.from('products').insert(row) : B.client.from('products').update(row).eq('id', p.id);
        return q.then(ok);
    };
    B.setFeatured = function (id, on) { return B.client.from('products').update({ featured: !!on }).eq('id', id).then(ok); };
    B.deleteProduct = function (id) { return B.client.from('products').delete().eq('id', id).then(ok); };

    /* ------------------------------ website content ------------------------------ */
    var CKEY = 'gt-content-v1';
    B.content = function () {
        return B.ready.then(function (on) {
            if (!on) return {};
            return withTimeout(B.client.from('site_content').select('*').then(ok), 4500).then(function (rows) {
                var out = {};
                (rows || []).forEach(function (r) { out[r.key] = r.value; });
                try { localStorage.setItem(CKEY, JSON.stringify(out)); } catch (e) {}
                return out;
            });
        }).catch(function () { return {}; });
    };
    B.contentCached = function () { return cached(); };
    B.saveContent = function (key, value) {
        return B.client.from('site_content').upsert({ key: key, value: value, updated_at: new Date().toISOString() }).then(ok);
    };
    function cached() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}') || {}; } catch (e) { return {}; } }

    /* put the admin-chosen images/text onto the page */
    function applyContent(c) {
        try { doc.dispatchEvent(new CustomEvent('gt:content', { detail: c || {} })); } catch (e) {}
        var imgs = (c && c.images) || {};
        $$('[data-slot]').forEach(function (el) {
            var url = imgs[el.getAttribute('data-slot')];
            if (!url) return;
            if (el.tagName === 'IMG') el.src = url;
            else el.style.setProperty('--img', 'url("' + String(url).replace(/"/g, '%22') + '")');
        });
        var st = (c && c.settings) || {};
        if (st.announcement && !$('.gt-announce') && !doc.body.hasAttribute('data-admin')) {
            var bar = doc.createElement('div');
            bar.className = 'gt-announce'; bar.textContent = st.announcement;
            var h = $('.gt-hdr') || $('header'); if (h && h.parentNode) h.parentNode.insertBefore(bar, h.nextSibling);
            doc.documentElement.classList.add('has-announce');
        }
    }
    B.applyContent = applyContent;
    function runContent() {
        applyContent(cached());
        if (B.enabled) B.content().then(applyContent);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', runContent); else runContent();

    /* ------------------------------ orders ------------------------------ */
    B.placeOrder = function (payload) {
        return B.ready.then(function (on) {
            if (!on) throw new Error('backend off');
            return withTimeout(B.client.rpc('place_order', { payload: payload }).then(ok), 12000);
        });
    };

    /* ------------------------------ cake studio design files ------------------------------ */
    /* uploads the print PNG, preview, cut line, spec and the customer's original image to the private 'order-art' bucket */
    B.uploadStudio = function (art) {
        return B.ready.then(function (on) {
            if (!on || !window.GTStore) throw new Error('backend off');
            return window.GTStore.get(art.id);
        }).then(function (d) {
            if (!d) throw new Error('design files not found');
            var ext = (String(d.origName || '').match(/\.(png|jpe?g|webp|gif)$/i) || [0, 'png'])[1].toLowerCase();
            var jobs = [['orig', 'original.' + ext, d.orig], ['print', 'print.png', d.print], ['preview', 'preview.png', d.preview], ['cutline', 'cutline.svg', art.product === 'chocolate' ? null : d.svg], ['spec', 'spec.json', d.spec]];   // chocolate is printed, not cut: no cut-line file
            var files = {}, chain = Promise.resolve();
            /* phones (iPhone Safari especially) can send an empty body when a file comes straight out of the browser's
               storage, so each file is first read into memory and then sent as plain bytes; one retry per file */
            function readBytes(b) {
                return new Promise(function (res, rej) {
                    var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error || new Error('could not read file')); };
                    r.readAsArrayBuffer(b);
                });
            }
            function sendClient(path, buf, type) {
                return withTimeout(B.client.storage.from('order-art').upload(path, buf, { contentType: type, upsert: false }), 90000).then(function (r) {
                    if (r.error && !/exist|duplicate/i.test(String(r.error.message || r.error.error || ''))) throw r.error;
                });
            }
            /* second way in: plain fetch straight to the storage API (works even if the client library misbehaves on a phone) */
            function sendDirect(path, buf, type) {
                var tok = (B.session && B.session.access_token) || CFG.supabaseKey, ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 90000);
                return fetch(CFG.supabaseUrl + '/storage/v1/object/order-art/' + path.split('/').map(encodeURIComponent).join('/'), {
                    method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + tok, 'Content-Type': type, 'x-upsert': 'false', 'cache-control': 'max-age=3600' }, body: buf, signal: ctl ? ctl.signal : undefined
                }).then(function (r) {
                    clearTimeout(t);
                    if (r.ok) return;
                    return r.text().then(function (txt) { if (/exist|duplicate/i.test(txt)) return; throw new Error('storage ' + r.status + ' ' + String(txt).slice(0, 160)); });
                }, function (e) { clearTimeout(t); throw e; });
            }
            function sendOne(path, buf, type) {
                var tries = [sendClient, sendDirect, sendClient], i = 0, last;
                function next() {
                    if (i >= tries.length) throw last;
                    var fn = tries[i++];
                    return fn(path, buf, type).catch(function (e) {
                        last = e;
                        if (/policy|not allowed|jwt|unauthor/i.test(String(e && (e.message || e.error)))) throw e;
                        return new Promise(function (r) { setTimeout(r, 1000 * i); }).then(next);
                    });
                }
                return next();
            }
            jobs.forEach(function (j) {
                chain = chain.then(function () {
                    var blob = j[2]; if (!blob) return;
                    if (typeof blob === 'string') blob = new Blob([blob]);
                    var ex = (j[1].match(/\.([a-z]+)$/) || [0, ''])[1], path = art.id + '/' + j[1],
                        type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', json: 'application/json' }[ex] || 'application/octet-stream';
                    return readBytes(blob).then(function (buf) {
                        if (!buf || !buf.byteLength) { if (j[0] === 'print' || j[0] === 'preview') throw new Error('the ' + j[0] + ' file is empty (' + j[1] + ')'); return; }
                        return sendOne(path, buf, type).then(function () { files[j[0]] = j[1]; });
                    });
                });
            });
            return chain.then(function () {
                if (!files.print) throw new Error('upload incomplete (no print file)');
                return { id: art.id, folder: art.id, files: files, finish: art.finish, designer: !!art.designer, look: art.look, legal: art.legal || null };
            });
        });
    };

    /* ------------------------------ studio AI (Supabase Edge Function 'studio-ai') ------------------------------ */
    /* kind: 'cutout' | 'cartoon' | 'bw'. blob: the customer's image (PNG). Resolves to a PNG Blob. */
    /* the real reason an Edge Function failed (supabase-js only says "non-2xx status code") */
    function fnError(r) {
        var e = r.error, ctx = e && e.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { var x = new Error((j && j.error) || e.message || 'ai failed'); x.detail = j && j.detail; x.status = ctx.status; throw x; }, function () { var x = new Error(e.message || 'ai failed'); x.status = ctx.status; throw x; });
        throw new Error((e && e.message) || (r.data && r.data.error) || 'ai failed');
    }
    B.studioAI = function (kind, blob, prompt, product) {
        return B.ready.then(function (on) {
            if (!on) throw new Error('backend off');
            return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob); });
        }).then(function (dataUrl) {
            return withTimeout(B.client.functions.invoke('studio-ai', { body: { kind: kind, image: dataUrl, prompt: prompt || '', product: product || 'chocolate' } }), 120000);
        }).then(function (r) {
            if (r.error) return fnError(r);
            if (!r.data || !r.data.image) throw new Error((r.data && r.data.error) || 'ai failed');
            return fetch(r.data.image).then(function (x) { return x.blob(); });
        });
    };

    /* AI drawing from words (chocolate studio). The print rules are added on the server. Resolves to a PNG Blob. */
    B.studioGenerate = function (prompt, style, product) {
        return B.ready.then(function (on) {
            if (!on) throw new Error('backend off');
            return withTimeout(B.client.functions.invoke('studio-ai', { body: { kind: 'generate', prompt: prompt, style: style, product: product || 'chocolate' } }), 150000);
        }).then(function (r) {
            if (r.error) return fnError(r);
            if (!r.data || !r.data.image) throw new Error((r.data && r.data.error) || 'ai failed');
            return fetch(r.data.image).then(function (x) { return x.blob(); });
        });
    };

    /* ------------------------------ upload a photo (resized first) ------------------------------ */
    B.uploadImage = function (file, folder) {
        return new Promise(function (resolve, reject) {
            var img = new Image(), url = URL.createObjectURL(file);
            img.onload = function () {
                var max = 1800, s = Math.min(1, max / Math.max(img.width, img.height));
                var c = doc.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                c.toBlob(function (blob) {
                    if (!blob) return reject(new Error('Could not read the image'));
                    var name = (folder || 'misc') + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.jpg';
                    B.client.storage.from('site-images').upload(name, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }).then(function (r) {
                        if (r.error) return reject(r.error);
                        resolve(B.client.storage.from('site-images').getPublicUrl(name).data.publicUrl);
                    }, reject);
                }, 'image/jpeg', 0.86);
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file is not a picture')); };
            img.src = url;
        });
    };

    /* ------------------------------ header: account icon ------------------------------ */
    function renderAccountLink() {
        var h = $('.gt-hdr') || $('header'); if (!h || doc.body.hasAttribute('data-admin')) return;      // the icon is always shown; the account page explains if sign-in is not available
        var a = $('.acct-btn', h);
        if (!a) {
            a = doc.createElement('a');
            a.className = 'acct-btn'; a.href = 'account.html';
            a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.200-4 4.200-6 8-6s6.800 2 8 6"/></svg><i class="acct-dot" aria-hidden="true"></i>';
            var cart = $('.cart-btn', h); if (cart && cart.parentNode) cart.parentNode.insertBefore(a, cart); else h.appendChild(a);
        }
        a.setAttribute('aria-label', window.GT.lang ? window.GT.lang.t('Account') : 'Account');
        a.classList.toggle('is-in', !!B.session);
    }
    function initLink() { renderAccountLink(); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', initLink); else initLink();

    /* handy for pages */
    window.GT.data = { products: B.products };
})();
