// Pre-build: pull curated sections from Sanity (public dataset, no token) into public/sections.json.
// On any failure the existing file is kept, so a Sanity outage never breaks the build.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const q = '*[_type=="section" && defined(slug.current)]{title,"slug":slug.current,description,sponsor,"films":coalesce(films,[]),"cinemas":coalesce(cinemas,[])}';
const url = `https://iqd4six9.apicdn.sanity.io/v2025-01-01/data/query/production?query=${encodeURIComponent(q)}`;
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const {result} = await res.json();
  writeFileSync(fileURLToPath(new URL('../public/sections.json', import.meta.url)), JSON.stringify({sections: result}, null, 1));
  console.log(`sanity: ${result.length} sections`);
} catch (e) {
  console.warn('sanity: kept existing sections.json (' + e.message + ')');
}
