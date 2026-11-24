// Post-build SEO step: writes a static HTML page per film / cinema with its own title, meta, Open Graph,
// JSON-LD and readable content, plus sitemap.xml and robots.txt. React replaces #root on load, so the app
// behaves as before; crawlers and social previews get real content without running JS.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const read = f => JSON.parse(readFileSync(join(dist, f), 'utf-8'));
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
const origin = host ? (host.startsWith('http') ? host : 'https://' + host).replace(/\/$/, '') : '';
if (!origin) console.warn('prerender: SITE_URL not set, canonical/og:url/sitemap URLs will be relative (set SITE_URL for production)');

// Same slug/route rules as src/lib/derive.ts
const GR = {α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o'};
const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = s => normalize(s).split('').map(c => GR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'film';
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const filmRoute = r => {
  const m = r.movieSourceUrl?.match(/\/movie\/([^/]+?)-(\d+)\/?$/);
  return m ? {id: m[2], slug: m[1].replace(/_/g, '-')} : {id: 't' + hash(r.movie), slug: slugify(r.movie)};
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const by = (rows, key) => rows.reduce((m, r) => (m.get(r[key]) ?? m.set(r[key], []).get(r[key])).push(r) && m, new Map());

const snap = read('snapshot.json');
const films = read('films.json').films || {};
const cinemas = read('cinemas.json').cinemas || [];
const template = readFileSync(join(dist, 'index.html'), 'utf-8');
const rows = snap.showtimes;
const abs = p => origin + p;
const img = p => (p ? 'https://image.tmdb.org/t/p/w780' + p : '');

function page({path, title, description, image, jsonld, body}) {
  image = image || (origin ? abs('/og.png') : '');
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}"/>`,
    origin && `<link rel="canonical" href="${abs(path)}"/>`,
    `<meta property="og:type" content="website"/><meta property="og:site_name" content="Visto"/><meta property="og:locale" content="el_GR"/>`,
    `<meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/>`,
    origin && `<meta property="og:url" content="${abs(path)}"/>`,
    image && `<meta property="og:image" content="${esc(image)}"/><meta name="twitter:card" content="summary_large_image"/>`,
    jsonld && `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('');
  const html = template
    .replace(/<title>.*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*\/>/, '')
    .replace('</head>', head + '</head>')
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  const dir = join(dist, path.replace(/^\//, ''));
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'index.html'), html);
}

const urls = ['/movies'];
const venueByName = new Map(cinemas.map(c => [c.name, c]));
const venueSlug = c => `/cinemas/${c.id}/${slugify(c.name)}`;
const list = (items) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

// Film pages
const byFilm = by(rows, 'movie');
for (const [title, rs] of byFilm) {
  const {id, slug} = filmRoute(rs[0]);
  const path = `/movies/${id}/${slug}`;
  const m = films[title];
  const byCinema = by(rs, 'cinema');
  const cinemaCount = byCinema.size;
  const first = rs.map(r => r.date).sort()[0], last = rs.map(r => r.date).sort().at(-1);
  const overview = m?.overview ? clip(m.overview, 160) : '';
  const description = `${title}: ωράρια προβολών σε ${cinemaCount} σινεμά της Αθήνας (${first} – ${last}).` + (overview ? ' ' + overview : '');
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Movie', name: m?.title || title, ...(m?.originalTitle && {alternateName: m.originalTitle}),
    ...(m?.posterPath && {image: img(m.posterPath)}), ...(m?.overview && {description: m.overview}),
    ...(m?.releaseDate && {datePublished: m.releaseDate}),
    ...(m?.cast?.find(c => c.role === 'Σκηνοθεσία') && {director: {'@type': 'Person', name: m.cast.find(c => c.role === 'Σκηνοθεσία').name}}),
  }, ...rs.slice(0, 40).map(r => {
    const v = venueByName.get(r.cinema);
    return {
      '@context': 'https://schema.org', '@type': 'ScreeningEvent', name: title, startDate: `${r.date}T${r.time}:00`,
      workPresented: {'@type': 'Movie', name: m?.title || title},
      location: {'@type': 'MovieTheater', name: r.cinema, ...(v?.address && {address: v.address})},
    };
  })];
  const body = `<main><h1>${esc(title)}</h1>${m?.overview ? `<p>${esc(m.overview)}</p>` : ''}<h2>Πού παίζεται στην Αθήνα</h2>` +
    list([...byCinema].map(([c, cr]) => `${esc(c)}: ${esc(cr.map(r => r.date + ' ' + r.time).slice(0, 12).join(', '))}`)) + `<a href="/movies">Όλες οι ταινίες</a></main>`;
  page({path, title: `${title} — πού παίζεται στην Αθήνα | Visto`, description, image: img(m?.posterPath), jsonld, body});
  urls.push(path);
}

// Cinema pages
const byCin = by(rows, 'cinema');
for (const [name, rs] of byCin) {
  const v = venueByName.get(name);
  if (!v) continue;
  const path = venueSlug(v);
  const fs = [...by(rs, 'movie')];
  const description = `${name}${v.address ? ' (' + v.address + ')' : ''}: πρόγραμμα με ${fs.length} ταινίες αυτή την εβδομάδα.`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'MovieTheater', name, ...(v.address && {address: v.address}), ...(v.website && {url: v.website}),
    ...(v.coordinates && {geo: {'@type': 'GeoCoordinates', longitude: v.coordinates[0], latitude: v.coordinates[1]}}),
  };
  const body = `<main><h1>${esc(name)}</h1>${v.address ? `<p>${esc(v.address)}</p>` : ''}<h2>Πρόγραμμα</h2>` +
    list(fs.map(([t, fr]) => esc(t) + ': ' + esc(fr.map(r => r.date + ' ' + r.time).slice(0, 8).join(', ')))) + `<a href="/cinemas">Όλα τα σινεμά</a></main>`;
  page({path, title: `${name} — πρόγραμμα ταινιών | Visto`, description, jsonld, body});
  urls.push(path);
}

// Landing pages: one per neighbourhood / region plus summer cinemas (the SPA renders the same list at /cinemas/in/<slug>)
const groups = new Map();
const add = (slug, title, v) => (groups.get(slug) ?? groups.set(slug, {title, venues: []}).get(slug)).venues.push(v);
for (const v of cinemas) {
  if (v.area) add(slugify(v.area), v.area, v);
  if (v.region) add(slugify(v.region), v.region, v);
  if (v.summer) add('summer', 'Θερινά σινεμά', v);
}
for (const [slug, {title, venues}] of groups) {
  const path = `/cinemas/in/${slug}`;
  const label = slug === 'summer' ? 'Θερινά σινεμά Αθήνας' : `Σινεμά ${title}`;
  const filmsHere = new Set(venues.flatMap(v => (byCin.get(v.name) ?? []).map(r => r.movie)));
  const description = `${label}: ${venues.length} κινηματογράφοι (${venues.slice(0, 4).map(v => v.name).join(', ')}${venues.length > 4 ? '…' : ''})` + (filmsHere.size ? ` με ${filmsHere.size} ταινίες αυτή την εβδομάδα.` : '.');
  const body = `<main><h1>${esc(label)}</h1>` + list(venues.map(v => `<a href="${venueSlug(v)}">${esc(v.name)}</a>${v.address ? ' — ' + esc(v.address) : ''}`)) + `</main>`;
  const jsonld = {'@context': 'https://schema.org', '@type': 'ItemList', name: label, itemListElement: venues.map((v, i) => ({'@type': 'ListItem', position: i + 1, url: abs(venueSlug(v)), name: v.name}))};
  page({path, title: `${label} — πρόγραμμα ταινιών | Visto`, description, jsonld, body});
  urls.push(path);
}

// Film landing pages: today + one per genre (the SPA renders the feed at /movies/in/<slug>)
const filmLink = t => { const r = filmRoute(byFilm.get(t)[0]); return `<a href="/movies/${r.id}/${r.slug}">${esc(t)}</a>`; };
const genres = new Map();
for (const t of byFilm.keys()) for (const g of films[t]?.genres || []) (genres.get(g) ?? genres.set(g, []).get(g)).push(t);
const landing = [['today', 'Ταινίες σήμερα στην Αθήνα', 'Τι παίζει σήμερα στα σινεμά της Αθήνας', [...byFilm.keys()]],
  ...[...genres].map(([g, ts]) => [slugify(g), `${g} ταινίες στα σινεμά της Αθήνας`, `${g} ταινίες που παίζονται αυτή την εβδομάδα στην Αθήνα`, ts])];
// Thematic sections: automatic (same rules as src/lib/sections.ts) plus curated ones from sections.json
const reissue = [...byFilm.keys()].filter(t => films[t]?.badge);
const midnight = [...new Set(rows.filter(r => r.afterMidnight || r.time >= '23:30').map(r => r.movie))];
if (reissue.length >= 3) landing.push(['epanekdoseis', 'Επανεκδόσεις στα σινεμά της Αθήνας', 'Επανεκδόσεις κλασικών ταινιών στην Αθήνα', reissue]);
if (midnight.length >= 3) landing.push(['metamesonyxties', 'Μεταμεσονύχτιες προβολές στην Αθήνα', 'Μεταμεσονύχτιες προβολές στα σινεμά της Αθήνας', midnight]);
for (const m of read('sections.json').sections || []) {
  const ts = m.films.filter(t => byFilm.has(t));
  if (ts.length) landing.push([m.slug, m.title, m.description || m.title, ts]);
}
for (const [slug, label, lead, ts] of landing) {
  const path = `/movies/in/${slug}`;
  const description = `${lead}: ${ts.length} ταινίες, μεταξύ αυτών ${ts.slice(0, 4).join(', ')}${ts.length > 4 ? '…' : ''}. Ώρες και σινεμά.`;
  const jsonld = {'@context': 'https://schema.org', '@type': 'ItemList', name: label, itemListElement: ts.map((t, i) => { const r = filmRoute(byFilm.get(t)[0]); return {'@type': 'ListItem', position: i + 1, url: abs(`/movies/${r.id}/${r.slug}`), name: t}; })};
  page({path, title: `${label} | Visto`, description, jsonld, body: `<main><h1>${esc(label)}</h1>${list(ts.map(filmLink))}</main>`});
  urls.push(path);
}

// Home: real content + site-wide description
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Athens'}).format(new Date());
page({
  path: '/movies', title: 'Τι παίζει στα σινεμά της Αθήνας σήμερα | Visto',
  description: `Το πρόγραμμα ${byCin.size} κινηματογράφων της Αθήνας: ${byFilm.size} ταινίες, ώρες προβολών, χάρτης και αγαπημένα. Ενημερώνεται κάθε εβδομάδα.`,
  body: `<main><h1>Τι παίζει στα σινεμά της Αθήνας</h1>` + list([...byFilm.keys()].map(t => `<a href="/movies/${filmRoute(byFilm.get(t)[0]).id}/${filmRoute(byFilm.get(t)[0]).slug}">${esc(t)}</a>`)) + `</main>`,
});

// 404 page (noindex) that Vercel serves with status 404
const shell = template.replace('</head>', `<meta property="og:title" content="Visto — Τι παίζει στην Αθήνα"/><meta property="og:type" content="website"/>${origin ? `<meta property="og:image" content="${abs('/og.png')}"/><meta name="twitter:card" content="summary_large_image"/>` : ''}</head>`);
writeFileSync(join(dist, '404.html'), shell.replace('</head>', '<meta name="robots" content="noindex"/></head>'));

writeFileSync(join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
  urls.map(u => `<url><loc>${abs(u)}</loc><lastmod>${today}</lastmod></url>`).join('') + `</urlset>`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
console.log(`prerender: ${urls.length} pages, sitemap.xml, robots.txt`);
