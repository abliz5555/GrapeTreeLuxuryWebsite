/* =====================================================================
   GRAPE TREE - SHOP DATA  (the one file you edit for the shop)
   ---------------------------------------------------------------------
   HOW TO EDIT
   - Change a name, description or price: edit the text between the quotes.
   - Prices are plain numbers in AED (no "AED", no quotes): price: 45
   - To hide a product, delete its whole { ... }, block.
   - Photos come from the images/ folder. Use the file name exactly.

   IMPORTANT BEFORE GOING LIVE
   The product names come from your website and photos, but ALL PRICES AND
   CUSTOM-ORDER OPTIONS BELOW ARE SAMPLES. Replace them with your real ones,
   then set  previewBanner: false  (the yellow "sample" bar disappears).
   ===================================================================== */

window.GT_DATA = {

    /* ---------------------- CAKE STUDIO (cake-studio.html) ----------------------
       Your own artwork on a Katanukiya cut-out cake. PRICES BELOW ARE SAMPLES:
       replace them with your real prices. 'price' is the total for that quantity
       (it includes the first die setup and UAE delivery).
       ------------------------------------------------------------------------ */
    studio: {
        ai: { enabled: true },                       // false = studios use only the quick built-in tools (no AI cost)
        cake: {
            title: 'Turn your artwork into a cut-out cake',
            lead: 'Upload a logo or character. AI can remove the background or turn it into a cute cartoon, and you see it at real size on the cake. We check every design and send a proof if anything needs adjusting.',
            chips: ['Cake surface 63 \u00d7 48 mm', 'From 120 pieces', 'Printed & cut in the UAE'],
            surface: { w: 63, h: 48 },              // cake surface in mm
            margin: 5,                              // clear zone on every side: the cut line and artwork never go past it (mm)
            unprinted: 1.5,                         // outer edge that is not printed (mm)
            safe: 2,                                // safe margin inside the cut line (mm)
            tolerance: 1.5,                         // print and cut tolerance (mm)
            leadBusinessDays: 14,
            designerFee: 0,                         // extra AED if the customer asks our designer to do the artwork (0 = free)
            tiers: [
                { qty: 120, price: 2400 },
                { qty: 180, price: 3050 },
                { qty: 240, price: 3750 },
                { qty: 300, price: 4400, popular: true },
                { qty: 600, price: 7800 },
                { qty: 900, price: 11200 }
            ],
            boxes: [
                { id: 'white', label: 'White', extra: 0, color: '#F4F1EA', standard: true },
                { id: 'black', label: 'Black', extra: 3, color: '#222222' },       // extra = AED per piece
                { id: 'yellow', label: 'Yellow', extra: 3, color: '#F2C93B' },
                { id: 'lightblue', label: 'Light blue', extra: 3, color: '#A6D8DC' }
            ]
        },
        chocolate: {
            title: 'Your logo, printed on gold',
            lead: 'A premium gifting option for companies and special occasions. Print your company logo, a monogram, a message or a photograph in black ink on real gold chocolate. Choose a single chocolate, a 3-piece gift set or a 9-piece box. Every piece can carry its own print.',
            chips: ['Gold surface 50 \u00d7 50 mm, full-area print', '1, 3 or 9 pieces per box', 'Custom flavour & box from 300 pieces'],
            surface: { w: 50, h: 50 },              // gold chocolate surface in mm (SAMPLE: please confirm)
            margin: 0,                              // chocolate is printed over the full area: no clear zone
            unprinted: 0,
            tolerance: 1.5,
            leadBusinessDays: 14,
            designerFee: 0,
            customMinQty: 300,                      // total pieces from which the customer can ask for their own flavour and box
            minBoxes: 1,
            boxSets: [                              // price per box (SAMPLE prices)
                { id: '1', pieces: 1, label: 'Single chocolate', price: 35 },
                { id: '3', pieces: 3, label: '3-piece gift set', price: 95 },
                { id: '9', pieces: 9, label: '9-piece gift box', price: 260 }
            ],
            discounts: [                            // percent off the price per box, from this many boxes
                { min: 1, off: 0 },
                { min: 10, off: 5 },
                { min: 25, off: 10 },
                { min: 50, off: 15 },
                { min: 100, off: 20 }
            ],
            thickness: [
                { id: '5', label: '5 mm thin', extra: 0 },
                { id: '12', label: '12 mm thick', extra: 1.5 }       // extra = AED per piece
            ],
            flavours: ['Milk chocolate', 'Dark chocolate', 'White chocolate', 'Ruby chocolate', 'Hazelnut', 'Matcha']
        }
    },

    /* ---------------------------- SETTINGS ---------------------------- */
    config: {
        previewBanner: true,                 // true = shows a "sample prices" bar. Set to false when ready.
        currency: 'AED',
        showPrices: true,                    // false = every price shows as "Price on request"
        whatsapp: '971555577478',            // WhatsApp number, digits only (country code first)
        formEndpoint: 'https://formspree.io/f/xzdwdagq',   // orders are also emailed through this Formspree form
        supabaseUrl: 'https://lowujjjiplhkmqtnoirz.supabase.co',   // your database (Supabase project)
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvd3VqamppcGxoa21xdG5vaXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzU2MzYsImV4cCI6MjEwODQxMTYzNn0.fsSyCC81hFsVT4CTJs7a5MgSuJsrv1OFfmjTzU7s6Uo',  // public "anon" key: safe to keep here
        siteUrl: 'https://grapetree.ae',      // used for shareable product links and the Instagram/Facebook catalog
        social: {                            // leave a link empty ('') to hide it on the links page
            instagramKatanukiya: 'https://www.instagram.com/katanukiya_uae',
            instagramGildart: 'https://www.instagram.com/gildart_official',
            tiktok: '',                      // paste your TikTok page link here
            facebook: ''
        },
        company: {                           // shown in the website footer and on order PDFs
            address: 'Dubai, United Arab Emirates',   // PUT YOUR FULL ADDRESS HERE (also used for the map)
            mapQuery: '',                    // optional: exact place to show on the map, e.g. 'Grape Tree FZE, Sharjah'
            phone: '',                       // optional landline, e.g. '+971 6 000 0000'
            email: '',                       // optional public email
            hours: '',                       // optional, e.g. 'Sat-Thu 9:00 - 18:00'
            map: true                        // false = hide the map
        },
        leadDays: 2,                         // earliest delivery date = today + this many days
        emirates: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
        deliveryNote: 'Delivery fee and timing are confirmed with your order.',
        paymentNote: 'We confirm availability and the final price on WhatsApp, then send a secure payment link. Nothing is charged when you send this request.'
    },

    /* ---------------------------- PRODUCTS ---------------------------- */
    products: [

        /* ---- Katanukiya ---- */
        {
            id: 'k-burj-khalifa',
            brand: 'katanukiya',
            name: 'Burj Khalifa Cut-Out Layered Cake',
            short: 'Precision-cut layer cake revealing the Burj Khalifa.',
            desc: 'A premium layer cake cut into the shape of the Burj Khalifa with water-jet precision, presented in a gift-ready box.',
            details: ['Premium layer cake, cut to shape with water-jet precision', 'Printed with the Burj Khalifa name in English and Arabic', 'Presented in a gift-ready box'],
            price: 45,
            img: 'images/katanukiya-product1.jpg',
            customize: { builder: 'katanukiya', design: 'burj-khalifa' }
        },
        {
            id: 'k-burj-al-arab',
            brand: 'katanukiya',
            name: 'Burj Al Arab Cut-Out Layered Cake',
            short: 'The Burj Al Arab sail, cut from layered cake.',
            desc: 'Layered cake precision-cut into the Burj Al Arab sail, a creative gift for visitors and residents alike.',
            details: ['Premium layer cake, cut to shape with water-jet precision', 'Printed with the Burj Al Arab name in English and Arabic', 'Presented in a gift-ready box'],
            price: 45,
            img: 'images/katanukiya-product2.jpg',
            customize: { builder: 'katanukiya', design: 'burj-al-arab' }
        },
        {
            id: 'k-camel-dubai',
            brand: 'katanukiya',
            name: 'Dubai Camel Cut-Out Layered Cake',
            short: 'A camel cut-out in a classic Dubai-design box.',
            desc: 'Premium layer cake cut into a camel, presented in a Dubai-design box. A playful gift with real Japanese precision.',
            details: ['Premium layer cake, cut to shape with water-jet precision', 'Dubai-design gift box', 'Edible printing in fine detail'],
            price: 45,
            img: 'images/katanukiya-product3.jpg',
            customize: { builder: 'katanukiya', design: 'camel-dubai' }
        },
        {
            id: 'k-camel-playful',
            brand: 'katanukiya',
            name: 'Playful Camel Cut-Out Layered Cake',
            short: 'A cheerful camel design, made to surprise.',
            desc: 'A friendly, colourful camel cut from premium layer cake. Made to bring a smile to anyone who opens the box.',
            details: ['Premium layer cake, cut to shape with water-jet precision', 'Colourful edible character printing', 'Presented in a gift-ready box'],
            price: 45,
            img: 'images/katanukiya-product4.jpg',
            customize: { builder: 'katanukiya', design: 'camel-playful' }
        },

        /* ---- GildArt ---- */
        {
            id: 'g-gold-box',
            brand: 'gildart',
            name: 'Gold Chocolate Box',
            short: 'Elegant premium chocolate crafted for luxury gifting.',
            desc: 'Gold-toned chocolate squares inspired by Dubai, presented in a black signature gift box. Elegant premium chocolate crafted for luxury gifting.',
            details: ['Crafted with selected ingredients and real gold leaf', 'Dubai-inspired gold designs', 'Black signature gift box'],
            price: 95,
            img: 'images/gildart-product1.jpg',
            customize: { builder: 'gildart', product: 'gold-box' }
        },
        {
            id: 'g-luxury-collection',
            brand: 'gildart',
            name: 'Luxury Gift Collection',
            short: 'Refined presentation for unforgettable moments.',
            desc: 'A larger gifting collection with refined presentation, designed for unforgettable moments and corporate gifting.',
            details: ['Crafted with selected ingredients and real gold leaf', 'Refined luxury presentation', 'Black signature gift box'],
            price: 165,
            img: 'images/gildart-product2.jpg',
            customize: { builder: 'gildart', product: 'luxury-collection' }
        },
        {
            id: 'g-seasonal',
            brand: 'gildart',
            name: 'Seasonal Premium Gifting',
            short: 'Exclusive gifting inspired by craftsmanship.',
            desc: 'Exclusive seasonal gifting experiences inspired by craftsmanship, for celebrations and special occasions.',
            details: ['Crafted with selected ingredients and real gold leaf', 'Seasonal and celebration presentation', 'Black signature gift box'],
            price: 220,
            img: 'images/gildart-product3.jpg',
            customize: { builder: 'gildart', product: 'seasonal' }
        }
    ],

    /* ------------------------ CUSTOM ORDER BUILDERS ------------------------
       Each builder is a list of steps shown on customize.html.
       Step types:  tiles (pick one)  |  qty  |  checks (tick any)  |  details
       Option fields:  id, label, price, img (optional), help (small text),
                       quote: true  = price confirmed after we see your request
       Extras use per:'order' (charged once) or per:'unit' (charged per item).
       ------------------------------------------------------------------- */
    builders: {

        katanukiya: {
            label: 'Katanukiya Cut-Out Layered Cake',
            blurb: 'Pick a design, choose how many boxes, and add your finishing touches.',
            cover: 'images/katanukiya-product3.jpg',
            unit: 'box',
            steps: [
                {
                    id: 'design', type: 'tiles', title: 'Choose a design', required: true,
                    options: [
                        { id: 'burj-khalifa', label: 'Burj Khalifa', price: 45, img: 'images/katanukiya-product1.jpg' },
                        { id: 'burj-al-arab', label: 'Burj Al Arab', price: 45, img: 'images/katanukiya-product2.jpg' },
                        { id: 'camel-dubai', label: 'Dubai Camel', price: 45, img: 'images/katanukiya-product3.jpg' },
                        { id: 'camel-playful', label: 'Playful Camel', price: 45, img: 'images/katanukiya-product4.jpg' },
                        { id: 'own-artwork', label: 'Your own artwork', price: 0, quote: true,
                          help: 'A logo, character or special shape. Send your artwork on WhatsApp after ordering and we will quote.' }
                    ]
                },
                {
                    id: 'qty', type: 'qty', title: 'How many boxes?', min: 1, max: 500,
                    presets: [1, 6, 12, 24],
                    help: 'Ordering 50 or more? Mention it in your notes and we will quote bulk pricing.'
                },
                {
                    id: 'extras', type: 'checks', title: 'Finishing touches',
                    options: [
                        { id: 'wrap', label: 'Gift wrapping', price: 15, per: 'order' },
                        { id: 'card', label: 'Personalised message card', price: 8, per: 'order', text: 'Message for the card' },
                        { id: 'branding', label: 'Company logo branding', quote: true, per: 'order',
                          help: 'For corporate and event gifting. We will quote after seeing your logo.' }
                    ]
                },
                { id: 'details', type: 'details', title: 'Delivery and notes' }
            ]
        },

        gildart: {
            label: 'GildArt Golden Chocolate',
            blurb: 'Choose your gift, pick the gold motif, and make it personal.',
            cover: 'images/gildart-product1.jpg',
            unit: 'gift',
            steps: [
                {
                    id: 'product', type: 'tiles', title: 'Choose your gift', required: true,
                    options: [
                        { id: 'gold-box', label: 'Gold Chocolate Box', price: 95, img: 'images/gildart-product1.jpg' },
                        { id: 'luxury-collection', label: 'Luxury Gift Collection', price: 165, img: 'images/gildart-product2.jpg' },
                        { id: 'seasonal', label: 'Seasonal Premium Gifting', price: 220, img: 'images/gildart-product3.jpg' }
                    ]
                },
                {
                    id: 'motif', type: 'tiles', title: 'Pick the gold motif', required: true,
                    options: [
                        { id: 'skyline', label: 'Dubai skyline', price: 0 },
                        { id: 'camel', label: 'Camel', price: 0 },
                        { id: 'falcon', label: 'Falcon', price: 0 },
                        { id: 'mixed', label: 'Mixed selection', price: 0 }
                    ]
                },
                {
                    id: 'qty', type: 'qty', title: 'How many gifts?', min: 1, max: 500,
                    presets: [1, 5, 10, 25],
                    help: 'Ordering 50 or more? Mention it in your notes and we will quote bulk pricing.'
                },
                {
                    id: 'extras', type: 'checks', title: 'Finishing touches',
                    options: [
                        { id: 'wrap', label: 'Gift wrapping', price: 15, per: 'order' },
                        { id: 'card', label: 'Personalised message card', price: 8, per: 'order', text: 'Message for the card' },
                        { id: 'branding', label: 'Company logo branding', quote: true, per: 'order',
                          help: 'For corporate and event gifting. We will quote after seeing your logo.' }
                    ]
                },
                { id: 'details', type: 'details', title: 'Delivery and notes' }
            ]
        }
    }
};
