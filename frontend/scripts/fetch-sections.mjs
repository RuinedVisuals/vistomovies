// Pre-build: pull curated sections from Sanity (public dataset, no token) into public/sections.json.
// On any failure the existing file is kept, so a Sanity outage never breaks the build.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const q = '*[_type=="section" && defined(slug.current)]{title,"slug":slug.current,description,sponsor,"films":coalesce(films,[]),"cinemas":coalesce(cinemas,[]),fromTime}';
const pickQ = '*[_type=="weeklyPick" && defined(film)]|order(_updatedAt desc)[0]{film,headline,body}';
const api = qs => `https://iqd4six9.apicdn.sanity.io/v2025-01-01/data/query/production?query=${encodeURIComponent(qs)}`;
const url = api(q);
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const {result} = await res.json();
  const pickRes = await fetch(api(pickQ));
  const pick = pickRes.ok ? (await pickRes.json()).result : null;
  // the editorial pick is a section too (shown first), with a text body
  if (pick) result.unshift({title: 'Ταινία της εβδομάδας', slug: 'taini-tis-ebdomadas', description: pick.headline, body: pick.body, films: [pick.film], cinemas: []});
  writeFileSync(fileURLToPath(new URL('../public/sections.json', import.meta.url)), JSON.stringify({sections: result}, null, 1));
  console.log(`sanity: ${result.length} sections`);
} catch (e) {
  console.warn('sanity: kept existing sections.json (' + e.message + ')');
}
