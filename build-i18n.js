/**
 * build-i18n.js — generate static localised pages from index.html + i18n/*.json
 *
 * Outputs to /dist:
 *   /index.html        ← EN
 *   /de/index.html
 *   /fr/index.html
 *   /es/index.html
 *   /pt/index.html
 *   /zh/index.html
 *   /ja/index.html
 *   /sitemap.xml
 *   /robots.txt
 *   + static assets (favicons, ball image, social card)
 *
 * Each generated page has translations baked in, the runtime i18n engine
 * stripped, and a small stub script that exposes window.__i18nData (for the
 * form's t() lookups), fires i18nReady on DOMContentLoaded (for the phrase
 * animation), and redirects legacy ?lang= URLs to the clean /<lang>/ path.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://agenticplayersball.com';

const LOCALES = ['en', 'de', 'fr', 'es', 'pt', 'zh', 'ja'];
const HREFLANG = {
  en: 'en', de: 'de', fr: 'fr', es: 'es',
  pt: 'pt-BR', zh: 'zh-Hans', ja: 'ja'
};

/* Static assets referenced by the HTML; copied verbatim into /dist */
const ASSETS = [
  'favicon.ico',
  'favicon.svg',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'agenticplayers.png',
  'social-card.png'
];

const urlFor  = lang => lang === 'en' ? `${SITE}/` : `${SITE}/${lang}/`;
const dirFor  = lang => lang === 'en' ? ''        : `${lang}/`;

function generateStub(lang, data) {
  return `
(function () {
  var SUPPORTED = ['en','de','fr','es','pt','zh','ja'];
  window.__i18nLang  = ${JSON.stringify(lang)};
  window.__i18nData  = ${JSON.stringify(data)};
  window.__i18nReady = true;
  window.onI18nReady = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };
  try { localStorage.setItem('apb-lang', ${JSON.stringify(lang)}); } catch (e) {}

  /* Backward compat: legacy ?lang=XX URLs redirect to /<lang>/ */
  var p = new URLSearchParams(location.search).get('lang');
  if (p) p = p.toLowerCase();
  if (p && SUPPORTED.indexOf(p) !== -1 && p !== ${JSON.stringify(lang)}) {
    location.replace(p === 'en' ? '/' : '/' + p + '/');
  }
})();
`;
}

function generateSitemap() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const lang of LOCALES) {
    xml += `  <url>\n`;
    xml += `    <loc>${urlFor(lang)}</loc>\n`;
    for (const l of LOCALES) {
      xml += `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlFor(l)}"/>\n`;
    }
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>\n`;
    xml += `  </url>\n`;
  }
  xml += '</urlset>\n';
  return xml;
}

function buildHtml(lang, data, template) {
  const $ = cheerio.load(template, { decodeEntities: false });

  /* <html> attrs */
  $('html').attr('lang', lang);
  $('html').addClass(`lang-${lang}`);

  /* <title> + meta */
  $('title').text(data['meta.title']);
  $('meta[name="description"]').attr('content', data['meta.description']);
  $('meta[property="og:description"]').attr('content', data['meta.og_description']);
  $('meta[property="og:locale"]').attr('content', data['meta.og_locale']);
  $('meta[property="og:url"]').attr('content', urlFor(lang));
  $('meta[name="twitter:description"]').attr('content', data['meta.og_description']);

  /* Canonical */
  $('link[rel="canonical"]').attr('href', urlFor(lang));

  /* hreflang block — strip existing, re-emit fresh */
  $('link[rel="alternate"][hreflang]').remove();
  let hreflangBlock = '';
  for (const l of LOCALES) {
    hreflangBlock += `<link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlFor(l)}">\n`;
  }
  hreflangBlock += `<link rel="alternate" hreflang="x-default" href="${SITE}/">`;
  $('link[rel="canonical"]').after('\n' + hreflangBlock);

  /* Schema.org — update Organization + WebSite, append per-page WebPage */
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json['@type'] === 'WebSite') {
        json.inLanguage = lang;
        json.description = data['meta.description'];
        $(el).html(JSON.stringify(json, null, 2));
      } else if (json['@type'] === 'Organization') {
        json.description = data['meta.description'];
        $(el).html(JSON.stringify(json, null, 2));
      }
    } catch (e) { /* leave malformed JSON-LD alone */ }
  });

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "url": urlFor(lang),
    "name": data['meta.title'],
    "description": data['meta.og_description'],
    "inLanguage": lang,
    "isPartOf": { "@type": "WebSite", "url": SITE + '/' }
  };
  $('head').append(`\n<script type="application/ld+json">\n${JSON.stringify(webPage, null, 2)}\n</script>\n`);

  /* Apply translations to body */
  $('[data-i18n]').each((i, el) => {
    const v = data[$(el).attr('data-i18n')];
    if (v !== undefined) $(el).text(v);
  });
  $('[data-i18n-html]').each((i, el) => {
    const v = data[$(el).attr('data-i18n-html')];
    if (v !== undefined) $(el).html(v);
  });
  $('[data-i18n-placeholder]').each((i, el) => {
    const v = data[$(el).attr('data-i18n-placeholder')];
    if (v !== undefined) $(el).attr('placeholder', v);
  });
  $('[data-i18n-aria]').each((i, el) => {
    const v = data[$(el).attr('data-i18n-aria')];
    if (v !== undefined) $(el).attr('aria-label', v);
  });

  /* Phrase animation source text */
  if (data['intro.phrase']) {
    const phrase = $('.phrase');
    phrase.attr('data-text', data['intro.phrase']);
    phrase.attr('aria-label', data['intro.phrase']);
    phrase.text(data['intro.phrase']);
  }

  /* Active state on the right footer language pill */
  $('.lang-btn').each((i, el) => {
    if ($(el).attr('data-lang') === lang) $(el).addClass('active');
    else $(el).removeClass('active');
  });

  /* Replace runtime i18n engine in <head> with stub */
  let stubInjected = false;
  $('head script').each((i, el) => {
    const code = $(el).html() || '';
    if (code.includes('SUPPORTED') && code.includes('detectLang') && code.includes('applyTranslations')) {
      $(el).html(generateStub(lang, data));
      stubInjected = true;
    }
  });
  if (!stubInjected) {
    throw new Error(`[${lang}] could not find runtime i18n engine in <head> to replace`);
  }

  return $.html();
}

/* ── main ── */

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

/* Static assets */
let copied = 0;
for (const asset of ASSETS) {
  const src = path.join(ROOT, asset);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, asset));
    copied++;
  }
}
console.log(`✓ copied ${copied} static asset${copied === 1 ? '' : 's'}`);

/* Recursively copy /social/ (profile banners + preview page) into dist/social/ */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDirRecursive(s, d);
    else { fs.copyFileSync(s, d); count++; }
  }
  return count;
}
const socialCopied = copyDirRecursive(path.join(ROOT, 'social'), path.join(DIST, 'social'));
if (socialCopied) console.log(`✓ copied ${socialCopied} file${socialCopied === 1 ? '' : 's'} from /social/`);

/* Per-locale HTML */
const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const lang of LOCALES) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', `${lang}.json`), 'utf8'));
  const html = buildHtml(lang, data, template);
  const outDir = path.join(DIST, dirFor(lang));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, html);
  console.log(`✓ ${path.relative(ROOT, outPath)}  (${(html.length / 1024).toFixed(1)} KB)`);
}

/* Sitemap + robots */
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), generateSitemap());
console.log('✓ dist/sitemap.xml');

fs.writeFileSync(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
);
console.log('✓ dist/robots.txt');

console.log('\nBuild complete.');
