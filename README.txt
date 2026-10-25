GRAPE TREE WEBSITE - VERSION 4
==============================

UPLOAD
1. Keep a backup of your current website files.
2. Upload everything in this folder to GitHub (replace same-name files).

ONE-TIME DATABASE SETUP (Supabase)
1. Open supabase/setup.sql. On line 31 replace CHANGE-ME@example.com with YOUR admin email.
2. Supabase -> SQL Editor -> paste the whole file -> Run. (Safe to run twice.)
3. Supabase -> Authentication -> URL Configuration:
     Site URL:      https://grapetree.ae
     Redirect URLs: https://grapetree.ae/**
   Keep "Confirm email" ON.
4. Go to https://grapetree.ae/account.html and create an account with the admin email, confirm it
   from your inbox, then open https://grapetree.ae/admin.html.
5. Later, for many emails per day, add your own SMTP sender (Authentication -> SMTP). The free default is rate-limited.

DAILY USE (admin.html)
- Orders: see new orders, change status, mark paid, add private notes, WhatsApp the customer, print.
- Products: add / edit / hide / delete products and upload photos. No code needed.
- Website images: change the home page pictures any time.
- Settings: announcement bar, bank details (bank transfer option appears when filled).
- More admins: Supabase SQL Editor ->  insert into public.admin_emails values ('name@grapetree.ae');
  then that person creates an account with that email.

SOCIAL SELLING
- links.html is your link-in-bio page (Instagram / TikTok). Put your TikTok link in shop-data.js (social.tiktok).
- Product links: shop.html?product=PRODUCT-ID. Rich share pages: run  node tools/build-social.js  (also makes catalog.csv
  for an Instagram/Facebook Shop catalogue). New admin-added products get share pages after you re-run it.
- Orders remember where the customer came from (Instagram, TikTok, ...).

LANGUAGES
English and Arabic. Add a language by adding lang/XX.js and one line in i18n.js. Arabic wording should be reviewed by a native speaker.

BEFORE GOING LIVE
- Prices and custom options in shop-data.js are SAMPLES: set real ones, then previewBanner:false.
- Check the footer city (Dubai vs Sharjah).
- Online card payment (Stripe, Apple Pay, Google Pay) is the next phase; for now customers pay by WhatsApp link or bank transfer.

VERSION 5 CHANGES
- One shared header and footer for every page: edit layout.js (menu) and shop-data.js "company" (address, phone, email, hours, map).
- Home page: two brands side by side, each opens its own page. Hover "Brands" in the menu to see both logos.
- Custom Order now lives inside the Shop page (Ready-made / Custom order switch). customize.html is still the builder behind it.
- Customers can download an order PDF: after ordering, and from My account -> My orders (invoice.html).
- Admin "Website images" now manages the two big home page photos.
- Set your full address in shop-data.js -> company.address so the footer map and PDFs show the right place.

=====================================================================
v6 - CAKE STUDIO (cake-studio.html)
=====================================================================
Customers upload a logo/character, clean the background, choose "cut around
artwork" / a shape (11 shapes) / print only, place it on the 63 x 48 mm cake,
see the cut line + connector + safe line, and order.
Each order saves: print PNG (600 dpi, transparent), preview PNG, cut-line SVG
(mm), spec JSON, and the customer's ORIGINAL upload. Admin > Orders shows a
button per file; the shop email carries them as attachments.
To switch on, ONCE:
  1. Supabase > SQL Editor > run  supabase/studio-update.sql
  2. Redeploy the order-email function with the new supabase/functions/order-email/index.ts
Prices/box colours: edit the  studio:  block in shop-data.js (samples).
Files: cake-studio.html, studio.js, studio.css, studio-store.js

v7 - DESIGN STUDIOS WITH AI (cake-studio.html + chocolate-studio.html)
=====================================================================
* The background tools are gone. The customer uploads, then AI (or the quick
  built-in tools if AI is off) makes: Cut out / Cartoon (cake), Black & white
  drawing / Cut out (chocolate). Every result is kept as a "version" the
  customer can switch back to, retry, or hand to our designer.
* The artwork is shown at real size on a surface the same size as the product.
  CAKE 63 x 48 mm: nothing (cut line, shape, artwork) may pass 5 mm from any
  side, so we can cut safely. CHOCOLATE 50 x 50 mm (please confirm the size):
  black ink on gold, 3 mm clear zone, print only, 5 mm or 12 mm thick,
  flavour and custom box unlocked from 300 pieces (customMinQty).
  All numbers are in the  studio:  block of shop-data.js (cake / chocolate).
* Admin: star on a product = shown on the home page under "Ready to Gift".
  New tab "Test studio": system checks, links to both studios, and the list
  of TEST orders (placed while signed in as admin; no customer email is sent).
TO SWITCH ON (once):
  1. Supabase > SQL Editor > run  supabase/v7-update.sql
  2. Supabase > Edge Functions > create  studio-ai  (paste supabase/functions/studio-ai/index.ts), Verify JWT ON
  3. Edge Functions > Secrets > add  OPENAI_API_KEY  (your OpenAI key; never put it in the website files).
     Optional: AI_MODEL (default gpt-image-1), AI_DAILY_LIMIT (default 12 images per visitor per day)
  4. Redeploy  order-email  (supabase/functions/order-email/index.ts)
  5. Admin > Test studio > Run all checks.
Each AI image costs OpenAI credit. The AI function could not be tested from
our build environment, so use the Test studio tab first. If AI is off or
fails, customers automatically get the quick tools.
Files: chocolate-studio.html, studio.js (both studios), studio.css

v7.1 - CREATE YOUR OWN + MOBILE
* "Create your own design" on Step 1 and "Add text, shapes, emojis & flowers" on the design step:
  names in 9 fonts (incl. Arabic), 11 shapes, emojis, 5 flowers; move, pinch, colour, size, rotate.
  The result becomes the version "My design" and is placed / cut like any artwork.
  On chocolate everything is printed as one-colour black ink (white = not printed).
* Mobile: the preview now stays pinned at the top while sliders are adjusted below it.

v7.2 - EDITOR UPDATE
* Fixed: square (and other straight-edged) cut shapes were rounded by the outline smoothing; they now keep sharp corners.
* - / + buttons beside every size / rotation slider (hold to repeat).
* 23 fonts (5 Arabic), 27 shapes (also usable as cut shapes), 14 flowers, 16 original friendly characters.
* Shapes can be stretched (height); emojis keep their own colours while editing; switching tabs deselects the item.

v7.3
* Phone-friendly shape / friend / flower grids in the editor.
* Step 1: pick a ready-made character and print it without any photo. Design step: Change photo, Remove & start over, Use a character instead.
* Admin > "Studio prices": change quantity prices, minimum order (first row), box colour / thickness extras, flavours,
  custom-order minimum, delivery days, designer fee and the headline / intro / highlights of each studio page. Saved in the
  database (no SQL needed); "Back to website defaults" undoes it.

==================== v8 (chocolate redesign + fixed workspace) ====================
1. Workspace: the design area is now one fixed square frame. Landscape, portrait and window resizing never change its size.
2. Chocolate: 50 x 50 mm gold surface, FULL-AREA print (no clear zone, no unprinted edge). Real gold look on screen.
   NOTE: you wrote "50 mm x 15 mm" once and "5 cm x 5 cm" later. I used 50 x 50. If it is 50 x 15, change surface in shop-data.js (chocolate.surface).
3. Chocolate tools are premium only: text in elegant fonts + simple frames (outline, text can go inside). No emojis, flowers or cartoon friends.
   AI buttons: Black & white (logos), Engraving style (photos, new), Remove background only.
4. Boxes: Single chocolate / 3-piece gift set / 9-piece gift box. Each piece has its own design. Preview shows the whole box.
   Cart gets one line per print; the first carries the price, the others say "Included". Order files are stored per print.
5. Chocolate prices: shop-data.js -> chocolate.boxSets (price per box), discounts (percent from N boxes), minBoxes. Editable in Admin > Studio prices.
6. Redeploy: supabase functions deploy studio-ai (new "engrave" prompt). No new SQL.

v8.1: Account icon is now always shown in the header (before, it was hidden when the database could not be reached). The sign-in library also has a backup download source.
      Chocolate design step: a live "box map" next to the workspace shows every piece (1 / 3 / 9) with its current design. Tap a piece to edit it, drag one onto another to swap places.

v8.2: Chocolate page simplified. Step 1 = choose the box (1/3/9) once. Step 2 = the box map (tap a piece, drag to swap) with upload/design tools for that piece. No second piece chooser at the top. Mobile hero shortened on studio pages.

v8.3: Fixed 'Remove & start over' (it used a pop-up that some browsers block; now two taps). Cake workspace now looks like layered sponge cake. Phone menu reorganised (clean rows, Brands opens two logo cards). Checked 11 pages at 6 screen sizes (320 to 1920 px): no sideways scrolling, no script errors.

v8.4: Pages now open at the top (no auto-scroll on first load). All numbers/prices use classic lining figures; prices use Playfair Display consistently.

v8.5: "Describe it - AI draws it for you" (chocolate studio, step 2).
  The customer types only WHAT to draw and picks a style (hand-drawn sketch, fine engraving, bold line art, minimal).
  Our print rules are added on the server in supabase/functions/studio-ai/index.ts (buildGeneratePrompt / STYLES):
  square, pure black ink on white, no grey or colour, sturdy lines for 50 mm, no text, luxury look.
  To change the look of every drawing, edit STYLES / buildGeneratePrompt there and redeploy the function.
  Needs the studio-ai function deployed with OPENAI_API_KEY (same as the other AI tools). Daily limit per visitor: AI_DAILY_LIMIT.

v8.6: cake studio also has "Describe it - AI draws it for you" (styles cute / cartoon / pastel / elegant; transparent background, flat colours, ready to cut). Rules in studio-ai: buildCakePrompt / CAKE_STYLES. Redeploy studio-ai.

v8.7: Estimate shows AED 0 until the customer has a design (cake and chocolate). AI errors now report the real reason (admin test mode shows it; Supabase function Logs show it too). Redeploy studio-ai to get the detail field.

v8.8: AI only for signed-in customers, 10 pictures per customer per day (AI_DAILY_LIMIT), website-wide cap 150/day (AI_GLOBAL_LIMIT), default model gpt-image-1.5 (gpt-image-1 retires), quality via AI_QUALITY (low/medium/high). Redeploy studio-ai; keep Verify JWT OFF (the function checks the login itself).

v9 - Admin + legal protection
 * Admin: Dashboard, Orders manager (customer upload + final design thumbnails, agreement record, design review, history, message templates, CSV), Business info (phone, WhatsApp, email, address, hours, social, order notification emails), Legal (edit terms / content policy / privacy / reminders; version goes up on save).
 * Customer: rights reminder before upload, approvals at step 4, agreement tick-box at checkout, 3 policy pages linked in footer.
 * Run supabase/v9-update.sql ONCE in Supabase SQL Editor BEFORE publishing (orders need the new columns).
 * Redeploy Edge Functions studio-ai (Verify JWT OFF) and order-email.
 * Legal texts are starting points: have a UAE lawyer review them.

v10 - Staff accounts, order tracking
 * Run supabase/v10-update.sql ONCE in Supabase SQL Editor.
 * Admin > Team: add staff by email (they sign up first on account.html). Staff see the Orders page only.
 * order-track.html: customers enter order number + phone/email to see status, items and updates. Status changes and "message to customer" in admin appear there.
 * New status "Ready for delivery". All scripts/styles now load with ?v=10 so browsers fetch fresh files after each update (change the number when you publish again).

v11 - Staff passwords, delete orders
 * Deploy the Edge Function supabase/functions/team-admin/index.ts (name: team-admin, Verify JWT OFF). No secrets to add.
 * Run supabase/v11-update.sql once (lets ONLY an admin delete orders).
 * Admin > Team: create staff with email + password, change password, delete account. Admin > Orders: "Delete order" (admin only).

==== v12 (languages, map location, all-device sizes) ====
- New languages: Turkish, Chinese (Simplified), Russian, Japanese (lang/tr.js, zh.js, ru.js, ja.js). Switcher in the header. Admin page and legal pages stay in English on purpose.
- Admin > Business info > "Our location on the map": click the map, drag the pin, search a place, paste a Google Maps link, or use your current location. Press Save. The footer map and "Get directions" then use the exact pin.
- Pages checked at phone (360/390), iPad (768/820/1024) and PC (1280/1920) widths in every language.
- Cache version is now ?v=11 on every script and style link.

==== v13 (branded emails) ====
- supabase/email-templates/*.html : Grape Tree styled emails for sign-up confirmation, password reset, magic link, change email, invite, reauthentication (subjects in SUBJECTS.txt).
- Links in the emails open account.html with a button first (token_hash), so mail programs that pre-open links can no longer break the reset/confirm link.
- Sender: set Supabase > Authentication > SMTP to Resend (smtp.resend.com, port 465, user "resend", password = Resend API key), sender no-reply@grapetree.ae, name "Grape Tree".

==== v14 (edit texts + fonts without code, new mobile header) ====
- Admin > Website: click-to-edit text on any page (opens the page with ?edit=1), a list of your text changes with "Back to original", and a font chooser (headings + normal text).
- Text edits are saved per language (switch the language button to edit the Arabic, Turkish... version).
- Mobile/tablet header: logo in the middle, menu + language on one side, account + basket on the other.
- Hard-coded fonts in the CSS now follow the font chosen in admin.
- New file textedit.js (loaded only in edit mode). Cache version is now ?v=12.
