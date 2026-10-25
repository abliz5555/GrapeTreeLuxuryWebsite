/* =====================================================================
   GRAPE TREE - LEGAL TEXTS (terms, content & copyright policy, privacy)
   ---------------------------------------------------------------------
   These are the DEFAULT texts. You can edit every one of them in the
   admin page (Legal tab) without touching code; what you save there
   replaces these defaults on the whole website, and the "version" number
   goes up so every order records exactly which text the customer accepted.

   IMPORTANT: these are sensible starting texts, not legal advice. Please
   have a UAE lawyer read them once and adjust them for your company.

   Text format: a line starting with "# " is a heading, a line starting
   with "- " is a bullet point, anything else is a paragraph.
   ===================================================================== */
(function () {
    'use strict';

    var DEFAULTS = {
        version: 1,
        company: 'Grape Tree FZE',
        docs: {
            terms: {
                title: 'Terms of Sale & Custom Orders',
                text: [
                    '# 1. About these terms',
                    'These terms apply to every order placed with Grape Tree FZE ("we", "us") through our website, including our Katanukiya cakes and GildArt chocolates. By placing an order you confirm that you have read and accepted them, together with our Content & Copyright Policy and Privacy Policy.',
                    '# 2. Custom (made-to-order) products',
                    'Custom cakes and chocolates are printed, cut and produced especially for you. Because of this, once you have approved the preview and we have started production, the order cannot be cancelled, changed, returned or refunded, except where the product is faulty or different from what you approved (see section 6).',
                    'The preview on screen is a guide. Printing on food is softer than on paper, colours depend on the product surface, and gold reflects light differently from a screen. Print and cut alignment can vary by up to about 1.5 mm. Differences within these ranges are not defects.',
                    '# 3. Your artwork and your responsibility',
                    'You are responsible for everything you upload, write or ask our AI tools to create ("your content"). By submitting it you confirm that:',
                    '- you own it, or you have the written permission of the owner to reproduce it on commercial products;',
                    '- it does not infringe anyone\'s copyright, trademark, design, image or privacy rights;',
                    '- it is lawful in the United Arab Emirates and is not on the list of prohibited content in our Content & Copyright Policy.',
                    'You give us permission to copy, edit, resize, convert and print your content only as needed to make and deliver your order, and to keep a copy for our order records.',
                    'You will compensate us for any claim, loss or cost (including legal fees) that arises because your content breaks these confirmations.',
                    '# 4. Our right to review, change or refuse',
                    'Our team reviews every design before production. We may ask you to change your content, or refuse or cancel an order, at any time before delivery if we believe the content is unlawful, offensive, infringes someone\'s rights, cannot be produced to a good standard, or breaks our policies. If we refuse an order before production, any amount you have paid for it is refunded. We are not obliged to give detailed reasons.',
                    'Our designers may adjust artwork (for example cleaning the background or increasing contrast) so that it prints well. We will send a proof when a change is significant.',
                    '# 5. Prices, payment and delivery',
                    'Prices are shown in UAE dirhams (AED). The price shown in the studio is an estimate; we confirm the final price, quantity, flavour and delivery date with you before production. Estimated delivery dates start from the next business day after we confirm your order and receive payment, where payment is required.',
                    'You must give a correct delivery address and phone number. We are not responsible for delays caused by wrong or incomplete details or by nobody being available to receive the order.',
                    '# 6. Faulty or incorrect orders',
                    'If your order arrives damaged, is different from the approved design, quantity or options, or has a production defect caused by us, please contact us within 24 hours of delivery with photos. We will remake or replace it, or refund it, at our choice. Food products must be stored as advised; deterioration caused by storage after delivery is not covered.',
                    '# 7. AI tools',
                    'Some tools in our studios use artificial intelligence to prepare or draw images. AI results can be imperfect, can differ each time, and may not be unique. You must check every AI result before ordering. You are responsible for making sure the result does not copy or imitate any protected brand, character or person. We do not guarantee that AI results are free of third-party rights.',
                    '# 8. Our liability',
                    'To the extent allowed by law, our liability for any order is limited to the amount you paid for that order. We are not liable for indirect or consequential loss.',
                    '# 9. Law and disputes',
                    'These terms are governed by the laws of the United Arab Emirates. Any dispute is first discussed in good faith with us; if it cannot be solved, it goes to the competent courts of the UAE.',
                    '# 10. Contact',
                    'Questions about these terms: use the contact details at the bottom of every page.'
                ].join('\n')
            },
            content: {
                title: 'Content & Copyright Policy',
                text: [
                    '# Why this policy exists',
                    'We print and cut real products from the images and words our customers give us. To protect you, other people and our company, every design must be lawful and must not copy anyone else\'s work. By ordering you confirm that your content follows this policy.',
                    '# What you must have the right to use',
                    '- Logos and brand names: only your own, or those you are officially authorised to use (for example by a written licence or brand permission).',
                    '- Photographs, drawings and designs: only ones you created, bought with a commercial licence, or have written permission to use.',
                    '- People: you must have the permission of every person who can be recognised in a photo (and of a parent or guardian for children).',
                    '- Characters, cartoons, films, games, sports clubs, fashion and luxury brands: not allowed unless you hold the licence. Fan art and "inspired by" copies of protected characters are not allowed.',
                    '# What we do not accept',
                    '- Anything illegal in the United Arab Emirates, or that encourages illegal acts.',
                    '- Anything offensive to Islam, other religions, the UAE, its rulers, flag, national symbols or its culture and public morals.',
                    '- Hate, abuse, threats, discrimination, harassment or defamation of any person or group.',
                    '- Nudity, sexual or adult content; drugs, alcohol, tobacco, gambling and weapons promotion.',
                    '- Political campaigning, protest messages or content about government bodies without proof of authority.',
                    '- Personal data of other people (phone numbers, addresses, ID numbers, private photos).',
                    '- Counterfeit, fake official documents, or content meant to mislead (for example impersonating a company or authority).',
                    '- Anything we judge unsuitable for our brands or impossible to produce to a good standard.',
                    '# AI-generated images',
                    'AI tools can produce images that look like existing brands, characters or people. You must check the result and must not order anything that copies or imitates a protected brand, character, artwork or real person. Our AI tools are set to avoid these, but we cannot guarantee it, and you remain responsible for what you order.',
                    '# What happens if we find a problem',
                    'Our team reviews each design. We may ask you to change it, or refuse or cancel the order (see our Terms of Sale). If someone claims your content infringes their rights, we may pause or cancel the order and share the order records with the claimant or the authorities where the law requires it.',
                    '# Report a problem',
                    'If you believe a design made by us breaks your rights, contact us using the details at the bottom of any page. Please include the order number if you have it, and proof that you own the rights.'
                ].join('\n')
            },
            privacy: {
                title: 'Privacy Policy',
                text: [
                    '# What we collect',
                    'When you order or create an account we collect your name, phone number, email address, delivery address, the products and designs you order, and the files you upload. We also keep a record of the terms you accepted (date, time and version) for each order.',
                    '# Why we use it',
                    '- To prepare, produce, deliver and support your order.',
                    '- To contact you about your order, by phone, WhatsApp or email.',
                    '- To protect our rights, for example to show which content and terms were agreed for an order.',
                    '- To keep our website secure and working well.',
                    '# Who sees it',
                    'Only our team. We use trusted services to run the website and send emails (for example our hosting, database and email providers) and, when you use AI tools, your text or image is sent to our AI provider to create the result. We do not sell your data.',
                    '# How long we keep it',
                    'Order records and design files are kept for as long as needed for the order, for our accounting and legal duties, and to handle complaints. You can ask us to delete your account.',
                    '# Your choices',
                    'You can ask to see, correct or delete your information by contacting us using the details at the bottom of any page.'
                ].join('\n')
            }
        },
        /* short reminders shown before a customer uploads anything */
        reminder: [
            'Only upload artwork you own, or have written permission to use.',
            'No copyrighted characters, brand logos you do not own, or photos of other people without their permission.',
            'No offensive, illegal or adult content. Our team reviews every design before production and may refuse or change an order.'
        ],
        /* the sentences the customer must accept */
        consent: {
            upload: 'I confirm I own this artwork or have permission to use it, and that it is lawful and follows the {content}.',
            studio: [
                'I own the rights to this design, or I have the owner\'s written permission to reproduce it on commercial products.',
                'My design is lawful in the UAE, is not offensive, and does not copy any brand, logo, character, artwork or person without permission (see the {content}). I understand Grape Tree may review, change, refuse or cancel an order for content or copyright reasons, and I am responsible for any claim caused by my content.'
            ],
            checkout: 'I have read and agree to the {terms}, the {content} and the {privacy}.'
        }
    };

    function cached() { try { return (JSON.parse(localStorage.getItem('gt-content-v1') || '{}') || {}).legal || null; } catch (e) { return null; } }
    function merge(base, over) {
        var o = JSON.parse(JSON.stringify(base));
        if (!over) return o;
        if (over.version) o.version = over.version;
        if (over.docs) ['terms', 'content', 'privacy'].forEach(function (k) { if (over.docs[k] && over.docs[k].text) { o.docs[k].text = over.docs[k].text; if (over.docs[k].title) o.docs[k].title = over.docs[k].title; } });
        if (over.reminder && over.reminder.length) o.reminder = over.reminder;
        if (over.consent) {
            if (over.consent.upload) o.consent.upload = over.consent.upload;
            if (over.consent.studio && over.consent.studio.length) o.consent.studio = over.consent.studio;
            if (over.consent.checkout) o.consent.checkout = over.consent.checkout;
        }
        return o;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function render(text) {
        var out = [], list = [];
        function flush() { if (list.length) { out.push('<ul>' + list.join('') + '</ul>'); list = []; } }
        String(text || '').split(/\r?\n/).forEach(function (ln) {
            ln = ln.trim();
            if (!ln) { flush(); return; }
            if (/^#\s+/.test(ln)) { flush(); out.push('<h2>' + esc(ln.replace(/^#\s+/, '')) + '</h2>'); }
            else if (/^-\s+/.test(ln)) list.push('<li>' + esc(ln.replace(/^-\s+/, '')) + '</li>');
            else { flush(); out.push('<p>' + esc(ln) + '</p>'); }
        });
        flush();
        return out.join('');
    }
    var PAGE = { terms: 'terms.html', content: 'content-policy.html', privacy: 'privacy.html' };
    /* turns "{terms}", "{content}", "{privacy}" in a sentence into links (the text itself is escaped first) */
    function withLinks(s) {
        var tl = window.GT && window.GT.lang ? window.GT.lang.t(s) : s;
        return esc(tl).replace(/\{(terms|content|privacy)\}/g, function (m, k) {
            var t = get().docs[k].title;
            if (window.GT && window.GT.lang) t = window.GT.lang.t(t);
            return '<a href="' + PAGE[k] + '" target="_blank" rel="noopener">' + esc(t) + '</a>';
        });
    }
    function plain(s) { return String(s).replace(/\{(terms|content|privacy)\}/g, function (m, k) { return get().docs[k].title; }); }
    function get() { return merge(DEFAULTS, cached()); }

    window.GTLegal = { DEFAULTS: DEFAULTS, get: get, merge: merge, render: render, withLinks: withLinks, plain: plain, esc: esc, page: PAGE };
})();
