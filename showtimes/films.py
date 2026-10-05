"""TMDB metadata for programme titles, keyed by the Athinorama title.

Matching is conservative: a title is matched only when a TMDB search result's
Greek or original title equals it (ignoring accents/punctuation). Unmatched
titles are cached as misses so the UI can label them "Χωρίς στοιχεία TMDB".
Lookups run in one background thread and persist to data/tmdb-films.json.
"""
import json
import re
import threading
import time
import unicodedata
from datetime import date
from pathlib import Path
from . import tmdb

CACHE = Path('data/tmdb-films.json')
HIT_TTL = 14 * 86400
MISS_TTL = 2 * 86400
_lock = threading.Lock()
_worker = None
_error = None


def norm(text):
    text = unicodedata.normalize('NFD', text or '')
    text = ''.join(c for c in text if not unicodedata.combining(c)).lower()
    return ' '.join(re.sub(r'[^\w]+', ' ', text).split())


def load():
    try:
        data = json.loads(CACHE.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save(cache):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE.with_suffix('.tmp')
    tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding='utf-8')
    tmp.replace(CACHE)


def fresh(entry, now):
    if not isinstance(entry, dict) or 'fetchedAt' not in entry:
        return False
    return now - entry['fetchedAt'] < (HIT_TTL if entry.get('film') else MISS_TTL)


def pick(title, results):
    """Return the best exact-title result or None."""
    want = norm(title)
    exact = [r for r in results[:10] if want and want in (norm(r.get('title')), norm(r.get('original_title')))]
    if not exact:
        return None
    # Same-title remakes are common: a film in this week's programme is most likely a recent
    # release; fall back to the best-known older film (a re-release) only when none is recent.
    this_year = date.today().year
    def recent(r):
        year = (r.get('release_date') or '')[:4]
        return year.isdigit() and this_year - 2 <= int(year) <= this_year + 1
    return max(exact, key=lambda r: (recent(r), r.get('vote_count') or 0, r.get('popularity') or 0))


def describe(title, movie):
    year = int(movie['release_date'][:4]) if movie.get('release_date') else None
    crew = movie.get('credits', {}).get('crew', [])
    cast = [{'name': c['name'], 'role': 'Σκηνοθεσία', 'profile': c.get('profile_path')} for c in crew if c.get('job') == 'Director'][:1]
    cast += [{'name': c['name'], 'role': c.get('character') or '', 'profile': c.get('profile_path')} for c in movie.get('credits', {}).get('cast', [])[:6]]
    countries = movie.get('production_countries') or []
    film = {
        'tmdbId': movie['id'],
        'imdbId': (movie.get('external_ids') or {}).get('imdb_id') or movie.get('imdb_id'),
        'title': movie.get('title') or title,
        'originalTitle': movie.get('original_title'),
        'year': year,
        'runtime': movie.get('runtime') or None,
        'genres': [g['name'] for g in movie.get('genres', [])],
        'countryCode': countries[0]['iso_3166_1'] if countries else None,
        'languageCode': movie.get('original_language'),
        'vote': round(movie['vote_average'], 1) if movie.get('vote_count') else None,
        'voteCount': movie.get('vote_count') or 0,
        'overview': movie.get('overview') or '',
        'overviewLanguage': movie.get('overview_language', 'el'),
        'posterPath': movie.get('poster_path'),
        'backdropPath': movie.get('backdrop_path'),
        'cast': cast,
    }
    # Older titles showing in a current programme are re-releases.
    if year and year <= date.today().year - 3:
        film['badge'] = 'Επανέκδοση'
    return film


def lookup(title):
    results = tmdb.get('search/movie', query=title, include_adult='false', region='GR').get('results', [])
    hit = pick(title, results)
    if not hit:
        return None
    resource = 'movie/' + str(hit['id'])
    movie = tmdb.get(resource, append_to_response='credits,external_ids')
    if not movie.get('overview'):
        movie['overview'] = tmdb.get(resource, language='en-US').get('overview', '')
        movie['overview_language'] = 'en' if movie['overview'] else None
    return describe(title, movie)


def _run(titles):
    global _error
    for title in titles:
        try:
            film = lookup(title)
        except tmdb.ApiError as e:
            _error = str(e)
            if e.status in (401, 403, 503):
                return  # credentials problem: stop, don't cache misses
            continue
        with _lock:
            cache = load()
            cache[title] = {'fetchedAt': time.time(), 'film': film}
            save(cache)
        _error = None


def films(titles):
    """Cached metadata for titles; starts a background fill for the rest."""
    global _worker
    now = time.time()
    with _lock:
        cache = load()
        missing = [t for t in titles if not fresh(cache.get(t), now)]
        if missing and not (_worker and _worker.is_alive()):
            try:
                tmdb.token()
            except tmdb.ApiError as e:
                return {'films': _known(cache, titles), 'pending': 0, 'error': str(e)}
            _worker = threading.Thread(target=_run, args=(missing,), daemon=True)
            _worker.start()
    return {'films': _known(cache, titles), 'pending': len(missing), 'error': _error}


def _known(cache, titles):
    return {t: cache[t]['film'] for t in titles if isinstance(cache.get(t), dict) and 'fetchedAt' in cache[t]}
