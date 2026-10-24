/* Builds the files that make selling on Instagram / TikTok / WhatsApp work:
     p/<product-id>.html   a share link with a rich preview (photo, name, price) that opens the product
     catalog.csv           product feed for Instagram Shop / Facebook Commerce Manager
   Run it again whenever you change shop-data.js:   node tools/build-social.js        */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'shop-data.js'), 'utf8'), sandbox);
const D = sandbox.window.GT_DATA, base = (D.config.siteUrl || 'https://grapetree.ae').replace(/\/$/, '');
const BRAND = { katanukiya: 'Katanukiya', gildart: 'GildArt' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

fs.mkdirSync(path.join(root, 'p'), { recursive: true });
fs.readdirSync(path.join(root, 'p')).filter(f => f.endsWith('.html')).forEach(f => fs.unlinkSync(path.join(root, 'p', f)));

D.products.forEach(p => {
  const title = `${p.name} | Grape Tree`;
  const target = `../shop.html?product=${encodeURIComponent(p.id)}`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.short || p.name)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="Grape Tree FZE">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(p.desc || p.short || '')}">
<meta property="og:image" content="${base}/${p.img}"><meta property="og:url" content="${base}/p/${p.id}.html">
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="AED">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${base}/shop.html?product=${encodeURIComponent(p.id)}">
</head><body><script>location.replace(${JSON.stringify(target)}+location.search.replace('?','&'));</script>
<p><a href="${target}">${esc(p.name)}</a></p></body></html>`;
  fs.writeFileSync(path.join(root, 'p', p.id + '.html'), html);
});

const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
const rows = [['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand']];
D.products.forEach(p => rows.push([p.id, p.name, p.desc || p.short, 'in stock', 'new', p.price + '.00 AED',
  `${base}/shop.html?product=${p.id}`, `${base}/${p.img}`, BRAND[p.brand] || p.brand]));
fs.writeFileSync(path.join(root, 'catalog.csv'), rows.map(r => r.map(q).join(',')).join('\n') + '\n');
console.log(`Built ${D.products.length} share pages in /p and catalog.csv`);
