"""One-off cinema geocoding into frontend/public/cinemas.json using OpenStreetMap.

1. One Overpass request lists every amenity=cinema in Attica.
2. Each cinema address is geocoded with Nominatim (≤1 request/second, cached on disk).
3. An OSM cinema within MATCH_RADIUS of the address whose name resembles ours becomes the
   position (precision 'venue'); otherwise the address point is used (precision 'address').

Results carry coordinateSource (the OSM object) and precision so the UI can label them.
Data © OpenStreetMap contributors, ODbL.
"""
import hashlib
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from . import athinorama

UA = 'Visto/0.1 (+https://github.com/RuinedVisuals/vistomovies)'
CINEMAS = Path('frontend/public/cinemas.json')
CACHE = Path('data/geocode-cache.json')
REPORT = Path('data/geocode-report.json')
BBOX = (37.6, 23.3, 38.35, 24.15)  # south, west, north, east (Attica)
MATCH_RADIUS = 350  # metres between address point and an OSM cinema
NAME_ONLY_RADIUS = 3000

GR = dict(zip('αβγδεζηθικλμνξοπρσςτυφχψω', ['a', 'v', 'g', 'd', 'e', 'z', 'i', 'th', 'i', 'k', 'l', 'm', 'n', 'x', 'o', 'p', 'r', 's', 's', 't', 'y', 'f', 'ch', 'ps', 'o']))
STOP = {'cinema', 'cinemas', 'sinema', 'kinimatografos', 'kin', 'dim', 'dimotikos', 'therinos', 'therino', 'cine', 'the', 'digital', 'art', 'cinemax', 'kai', 'tis', 'tou', 'ton', 'o', 'i', 'to'}


def latin(text):
    text = unicodedata.normalize('NFD', text or '')
    text = ''.join(c for c in text if not unicodedata.combining(c)).lower()
    return ''.join(GR.get(c, c) for c in text)


def tokens(name):
    return {t for t in re.split(r'[^a-z0-9]+', latin(name)) if len(t) > 1 and t not in STOP}


def name_score(a, b):
    ta, tb = tokens(a), tokens(b)
    return len(ta & tb) / min(len(ta), len(tb)) if ta and tb else 0.0


def metres(a, b):
    r = math.pi / 180
    x = (b[0] - a[0]) * r * math.cos((a[1] + b[1]) / 2 * r)
    return 6371000 * math.hypot(x, (b[1] - a[1]) * r)


ABBR = [(r'(?<!\w)Λεωφ\.\s*', 'Λεωφόρος '), (r'(?<!\w)Λ\.\s*', 'Λεωφόρος '), (r'(?<!\w)Πλ\.\s*', 'Πλατεία '), (r'(?<!\w)Αγ\.\s*(?=\w+(?:ος|ός|ας|άς|ης|ής)\b)', 'Άγιος '),
        (r'(?<!\w)Αγ\.\s*', 'Αγίου '), (r'(?<!\w)Ελ\.\s*Βενιζέλου', 'Ελευθερίου Βενιζέλου'), (r'(?<!\w)Ηρ\.\s*Πολυτεχνείου', 'Ηρώων Πολυτεχνείου'),
        (r'(?<!\w)Βασ\.\s*', 'Βασιλέως '), (r'(?<!\w)Μεγ\.\s*', 'Μεγάλου '), (r'(?<!\w)Ζωοδ\.\s*', 'Ζωοδόχου '), (r'(?<!\w)Απ\.\s*', 'Αποστόλου '), (r'(?<!\w)Ν\.\s*', 'Νέα ')]


NOTE = re.compile(r'μετρ[οό]|σταθμ|στάση|πολυχώρ|είσοδ|\bmall\b|center|shopping', re.I)


def split_address(address):
    """'Λεωφ. Κηφισίας 234 & Λυκούργου 3, Κηφισιά (ΜΕΤΡΟ ...)' → ('Λεωφόρος Κηφισίας 234', 'Κηφισιά')."""
    a = re.sub(r'\([^)]*\)', '', address)
    for pat, rep in ABBR:
        a = re.sub(pat, rep, a)
    parts = [p.strip() for p in a.split(',') if p.strip()]
    street = re.split(r'\s*&\s*|\s+και\s+', parts[0])[0] if parts else ''
    street = re.sub(r'(\d+)\s*-\s*\d+', r'\1', street)
    locality = next((p for p in reversed(parts[1:]) if not re.search(r'\d', p) and not NOTE.search(p)), '')
    return street.strip(), locality.strip()


def clean_address(address):
    return ', '.join(x for x in split_address(address) if x)


GENERIC = {'leoforos', 'odos', 'plateia', 'athina', 'attiki', 'ellada', 'dimos', 'koinotita', 'periferiaki', 'enotita', 'kentrikoy', 'tomea', 'athinon', 'kato', 'ano', 'kentro'}


def place_tokens(text):
    return {t for t in re.split(r'[^a-z0-9]+', latin(text)) if len(t) > 3 and not t.isdigit()} - GENERIC


def locality_ok(locality, place):
    """Our locality words (e.g. Αμπελόκηποι) appear in a result's place description."""
    stem = lambda ts: {t[:5] for t in ts}  # tolerate case endings: Παγκράτι ~ Παγκρατίου
    want = place_tokens(locality)
    return not want or bool(stem(want) & stem(place_tokens(place)))


class Client:
    def __init__(self):
        try:
            self.cache = json.loads(CACHE.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            self.cache = {}
        self.last = 0.0

    def get(self, url, polite=1.1):
        if url in self.cache:
            return self.cache[url]
        time.sleep(max(0, self.last + polite - time.time()))
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'el'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        self.last = time.time()
        self.cache[url] = data
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(self.cache, ensure_ascii=False), encoding='utf-8')
        return data

    def osm_cinemas(self):
        s, w, n, e = BBOX
        q = f'[out:json][timeout:60];nwr["amenity"="cinema"]({s},{w},{n},{e});out center tags;'
        data = self.get('https://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(q), polite=2)
        out = []
        for el in data.get('elements', []):
            lat, lon = (el['lat'], el['lon']) if 'lat' in el else (el['center']['lat'], el['center']['lon'])
            tags = el.get('tags', {})
            names = [tags.get(k) for k in ('name', 'name:el', 'name:en', 'alt_name', 'old_name') if tags.get(k)]
            out.append({'pos': (lon, lat), 'names': names, 'tags': tags, 'url': f"https://www.openstreetmap.org/{el['type']}/{el['id']}"})
        return out

    def search(self, query):
        s, w, n, e = BBOX
        params = {'q': query, 'format': 'jsonv2', 'countrycodes': 'gr', 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'addressdetails': 1, 'limit': 5, 'accept-language': 'el'}
        return self.get('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params))

    def reverse(self, pos):
        params = {'lat': pos[1], 'lon': pos[0], 'format': 'jsonv2', 'addressdetails': 1, 'zoom': 16, 'accept-language': 'el'}
        return self.get('https://nominatim.openstreetmap.org/reverse?' + urllib.parse.urlencode(params))


# Municipality / suburb keywords → region used by the app's chips and filters.
REGIONS = [(r, [latin(k) for k in keys.split()]) for r, keys in [
    ('Πειραιάς', 'Πειραι Νίκαια Ρέντη Ρεντη Κορυδαλλ Κερατσίν Δραπετσών Πέραμα Σαλαμίν Σελήνια'),
    ('Νότια', 'Καλλιθέ Σμύρν Φάληρ Άλιμ Γλυφάδ Ελληνικ Αργυρούπολ Βούλα Βάρη Βουλιαγμέν Βάρκιζ Δάφν Υμηττ Δημήτρι Ηλιούπολ Μοσχάτ Ταύρ Σαρωνίδ Μάκρη Μαραθών Ραφήν Λαύρι Καλύβ Ζούμπερ'),
    ('Δυτικά', 'Περιστέρ Αιγάλε Ίλιον Ιλίου Πετρούπολ Χαϊδάρ Βαρβάρ Ανάργυρ Καματερ Ελευσίν Μάνδρ Λιοσί Ζεφύρ Φυλή Ασπρόπυργ Μεγάρ Αχαρν Μπουρνάζ'),
    ('Βόρεια', 'Κηφισι Μαρούσ Αμαρουσ Χαλάνδρ Ψυχικ Φιλοθέ Ιωνία Ηράκλει Παρασκευ Βριλήσσ Μεταμόρφωσ Λυκόβρυσ Πεύκ Ερυθραί Εκάλη Παπάγ Χολαργ Γέρακ Παλλήν Πεντέλ Μελίσσ Φιλαδέλφει Χαλκηδόν Διόνυσ Κρυονέρ Ωρωπ Μαρκόπουλ Κορωπ Σπάτ Αρτέμιδ'),
    ('Κέντρο', 'Αθήν Αθην Καισαριαν Βύρων Ζωγράφ Γαλάτσ'),
]]


ADMIN = re.compile(r'^(Συνοικία|Δημοτική Ενότητα|Δημοτική Κοινότητα|Κοινότητα|Δήμος|\d+η Κοινότητα)', re.I)


def region_and_area(address, locality=''):
    """Area label (our own nominative locality when the address has one) and app region."""
    a = address or {}
    athens = 'αθήν' in str(a.get('city', '')).lower() or 'αθηναίων' in str(a.get('municipality', '')).lower()
    order = ('neighbourhood', 'quarter', 'suburb', 'city_district', 'town', 'village', 'city') if athens else ('town', 'village', 'suburb', 'city', 'neighbourhood', 'quarter')
    names = [a.get(k) for k in order if a.get(k)]
    area = locality or next((n for n in names if not ADMIN.match(n)), None)
    hay = ' '.join(latin(str(a.get(k, ''))) for k in ('municipality', 'city', 'town', 'village', 'suburb', 'city_district')) + ' ' + latin(locality)
    region = next((r for r, keys in REGIONS if any(k in hay for k in keys)), None)
    return area, region


def locality_hint(cinema):
    """Our address locality, else a known toponym in the cinema's name (e.g. 'Σινέ Παλλήνη')."""
    _, loc = split_address(cinema['address'])
    if place_tokens(loc):
        return loc
    rest = re.sub(r'^[^,(]*', '', cinema['address'])  # skip the street itself (Κηφισίας ≠ Κηφισιά)
    for word in re.split(r'[\s,()\-]+', cinema['name'] + ' ' + rest):
        w = latin(word)
        if len(w) > 3 and any(w.startswith(k) for r, keys in REGIONS if r != 'Κέντρο' for k in keys if len(k) > 3):
            return word
    return ''


def candidates(client, cinema, loc):
    """Nominatim hits for the street; with a locality only those inside it."""
    street, _ = split_address(cinema['address'])
    if not street:
        return []
    out, seen = [], set()
    for q in dict.fromkeys(q for q in (f'{street}, {loc}' if loc else None, f'{street}, Αθήνα', street) if q):
        for h in client.search(q):
            key = (h.get('osm_type'), h.get('osm_id'))
            if key in seen:
                continue
            seen.add(key)
            same_cinema = h.get('type') == 'cinema' and name_score(cinema['name'], h.get('name') or '') >= 0.67
            if not loc or same_cinema or locality_ok(loc, h.get('display_name', '')):
                out.append(h)
    return out


def same_address(cinema, tags):
    """OSM addr:street/housenumber agree with our street (strong evidence between neighbouring venues)."""
    street, _ = split_address(cinema['address'])
    m = re.search(r'(\d+)', street)
    return bool(m and tags.get('addr:housenumber', '').startswith(m[1]) and place_tokens(tags.get('addr:street', '')) & place_tokens(street))


def best_venue(cinema, near, osm, hit=None, strict=False):
    """Nominatim's own cinema POI at the address, else a similarly named OSM cinema close to it
    (or the only one very close)."""
    exact = [o for o in osm if same_address(cinema, o['tags']) and metres(near, o['pos']) <= MATCH_RADIUS]
    if exact:
        o = max(exact, key=lambda o: max((name_score(cinema['name'], n) for n in o['names']), default=0.0))
        return o, metres(near, o['pos'])
    if hit and hit.get('type') == 'cinema' and (not strict or name_score(cinema['name'], hit.get('name') or '') >= 0.34):
        return {'pos': near, 'names': [hit.get('name') or cinema['name']], 'tags': {}, 'url': f"https://www.openstreetmap.org/{hit['osm_type']}/{hit['osm_id']}"}, 0
    scored = []
    for o in osm:
        d = metres(near, o['pos'])
        sc = max((name_score(cinema['name'], n) for n in o['names']), default=0.0)
        if d <= MATCH_RADIUS and (sc >= 0.34 or (d <= 120 and not strict)):
            scored.append((sc + same_address(cinema, o['tags']), -d, o, d))
    return max(scored, key=lambda x: (x[0], x[1]))[2:] if scored else (None, None)


def name_only(client, cinema, osm, loc, hits=()):
    """Last resort: a strongly matching OSM name inside our locality or within 1 km of an address candidate."""
    score = lambda o: max((name_score(cinema['name'], n) for n in o['names']), default=0.0)
    for o in sorted(osm, key=lambda o: -score(o)):
        if score(o) < 0.66:
            break
        if not loc and not hits:
            return None
        place = ' '.join(str(v) for v in client.reverse(o['pos']).get('address', {}).values()) if loc else ''
        place += ' ' + ' '.join(v for k, v in o['tags'].items() if k.startswith('addr:'))
        if (loc and locality_ok(loc, place)) or any(metres((float(h['lon']), float(h['lat'])), o['pos']) <= 1000 for h in hits):
            return o
    return None


def spread(hits):
    pts = [(float(h['lon']), float(h['lat'])) for h in hits]
    return max((metres(a, b) for a in pts for b in pts), default=0)


def run(html_path=Path('data/athinorama-latest.html'), log=print):
    doc = json.loads(CINEMAS.read_text(encoding='utf-8'))
    cinemas = doc['cinemas']
    info = athinorama.cinema_info(html_path.read_text(encoding='utf-8')) if html_path.exists() else {}
    known = {c['name'] for c in cinemas}
    for name, i in info.items():  # cinemas new on the source page
        if name not in known and i.get('address'):
            cinemas.append({'id': hashlib.sha256(name.encode()).hexdigest()[:12], 'name': name, 'address': i['address'], 'summer': False})
            log(f'+ νέο σινεμά από την πηγή: {name}')
    client = Client()
    osm = client.osm_cinemas()
    log(f'OSM: {len(osm)} κινηματογράφοι στην Αττική')
    report = []
    for c in cinemas:
        query = clean_address(c['address'])
        loc = locality_hint(c)
        hits = candidates(client, c, loc)
        venue = dist = hit = None
        # An OSM cinema tagged with our exact street + number in our locality wins outright.
        exact = [o for o in osm if same_address(c, o['tags']) and (not loc or locality_ok(loc, o['tags'].get('addr:city', '') + ' ' + o['tags'].get('addr:suburb', '')))]
        if exact:
            venue = max(exact, key=lambda o: max((name_score(c['name'], n) for n in o['names']), default=0.0))
            hit = next((h for h in hits if metres((float(h['lon']), float(h['lat'])), venue['pos']) < 400), None)
            dist = metres((float(hit['lon']), float(hit['lat'])), venue['pos']) if hit else None
        for h in ([] if venue else hits):  # first address candidate with an OSM cinema at it wins (resolves same-name streets)
            venue, dist = best_venue(c, (float(h['lon']), float(h['lat'])), osm, h, strict=not loc)
            if venue:
                hit = h
                break
        if not venue:
            venue = name_only(client, c, osm, loc, hits)
        if not venue and hits and loc:  # address-only positions need a confirmed locality
            hit = hits[0]
        entry = {'name': c['name'], 'query': query, 'locality': loc, 'addressCandidates': len(hits)}
        if c.get('coordinateSource') and c.get('coordinates') and not c.get('coordinatePrecision'):
            pos, precision, source = tuple(c['coordinates']), 'venue', c['coordinateSource']  # previously verified by hand
        elif venue:
            pos, precision, source = venue['pos'], 'venue', venue['url']
            entry['osmName'] = venue['names'][0] if venue['names'] else None
            entry['metresFromAddress'] = round(dist) if dist is not None else None
            website = venue['tags'].get('website') or venue['tags'].get('contact:website')
            if website and not c.get('website'):
                c['website'] = website
        elif hit:
            pos, precision, source = (float(hit['lon']), float(hit['lat'])), 'address', f"https://www.openstreetmap.org/{hit['osm_type']}/{hit['osm_id']}"
        else:
            entry['result'] = 'not found'
            report.append(entry)
            continue
        addr = hit['address'] if hit and (precision == 'address' or (dist is not None and dist < 400)) else client.reverse(pos).get('address')
        area, region = region_and_area(addr, loc)
        if region is None:
            region = region_and_area({'city': area})[1]
        c['coordinates'] = [round(pos[0], 7), round(pos[1], 7)]
        c['coordinateSource'] = source
        c['coordinatePrecision'] = precision
        if area:
            c['area'] = area
        if region:
            c['region'] = region
        i = info.get(c['name'])
        if i:
            c['athinoramaUrl'] = i['url']
            if i['phones'] and not c.get('phone'):
                c['phone'] = i['phones'][0]
        entry.update(result=precision, area=area, region=region)
        report.append(entry)
        log(f"{'✓' if precision == 'venue' else '~'} {c['name']}: {precision} · {area or '—'} · {region or '—'}")
    doc['source'] = 'Project cinema directory; positions from OpenStreetMap (© OpenStreetMap contributors, ODbL) via Overpass/Nominatim'
    CINEMAS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    counts = {k: sum(1 for r in report if r.get('result') == k) for k in ('venue', 'address', 'not found')}
    log(f'Σύνολο: {counts} · αναφορά: {REPORT}')
    return report
