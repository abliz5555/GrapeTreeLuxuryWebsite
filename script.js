/* =====================================================================
   GRAPE TREE - BASE SCRIPT
   Mobile menu. (Animations live in animations.js, the shop in cart.js.)
   Changes from your original:
   - The old scroll handler is gone. It set inline styles on every card that
     blocked the hover lift after the first scroll. animations.js replaces it.
   - The counters moved to animations.js so they count up when seen.
   - Safe on every page (your brand pages had no menu button).
   ===================================================================== */
(function () {
    var toggle = document.getElementById('menu-toggle');
    var nav = document.getElementById('nav-menu');
    if (!toggle || !nav) return;

    function setOpen(open) {
        nav.classList.toggle('active', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? '✕' : '☰';
    }

    toggle.addEventListener('click', function () {
        setOpen(!nav.classList.contains('active'));
    });

    toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!nav.classList.contains('active'));
        }
    });

    nav.querySelectorAll('a:not(.gt-brands-link)').forEach(function (link) {
        link.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });
})();

/* Contact page: send the inquiry without leaving the site.
   If anything goes wrong it falls back to the normal form post. */
(function () {
    var form = document.querySelector('.inquiry-form');
    if (!form || !window.fetch || !window.FormData) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('.submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

        fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        }).then(function (r) {
            if (!r.ok) throw new Error('status ' + r.status);
            var box = document.createElement('div');
            box.className = 'form-success';
            box.setAttribute('role', 'status');
            box.innerHTML = '<h3>Thank you</h3><p>Your inquiry has been sent. We will get back to you shortly.</p>' +
                '<a href="index.html" class="contact-btn">Back to home</a>';
            form.parentNode.replaceChild(box, form);
        }).catch(function () {
            form.submit();
        });
    });
})();
