"""Read-only TMDB proxy. Credentials stay in the server environment."""
import json
import os
import re
import time
from pathlib import Path
from threading import Lock
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError

_cache = {}
_lock = Lock()

class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def token():
    value = os.environ.get('TMDB_READ_TOKEN', '').strip()
    if not value:
        path = Path(__file__).resolve().parent.parent / '.env'
        if path.exists():
            for line in path.read_text(encoding='utf-8-sig').splitlines():
                if line.startswith('TMDB_READ_TOKEN='):
                    value = line.partition('=')[2].strip().strip('\"\'')
    if not value or value == 'PASTE_NEW_TOKEN_HERE':
        raise ApiError(503, 'Βάλε το TMDB_READ_TOKEN στο αρχείο .env του Python project και δοκίμασε ξανά.')
    return value

def get(path, **params):
    secret = token()
    params.setdefault('language', 'el-GR')
    url = 'https://api.themoviedb.org/3/' + path + '?' + urlencode(params)
    with _lock:
        cached = _cache.get(url)
        if cached and cached[0] > time.monotonic():
            return json.loads(cached[1])
    try:
        request = Request(url, headers={'Authorization': 'Bearer ' + secret, 'Accept': 'application/json'})
        with build_opener(NoRedirect()).open(request, timeout=12) as response:
            data = json.load(response)
    except HTTPError as exc:
        messages = {401: 'Το TMDB token δεν είναι έγκυρο.', 403: 'Το TMDB απέρριψε την πρόσβαση.', 404: 'Η ταινία δεν βρέθηκε.', 429: 'Πολλά αιτήματα στο TMDB. Δοκίμασε σε λίγο.'}
        raise ApiError(exc.code if exc.code in messages else 502, messages.get(exc.code, 'Το TMDB δεν είναι διαθέσιμο.')) from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise ApiError(502, 'Αδυναμία σύνδεσης με το TMDB. Δοκίμασε ξανά.') from None
    with _lock:
        if len(_cache) >= 300:
            _cache.pop(next(iter(_cache)))
        _cache[url] = (time.monotonic() + 900, json.dumps(data))
    return data

def route(path, query):
    def param(name, default=''):
        return query.get(name, [default])[0]
    if path == '/movies':
        try:
            page = int(param('page', '1'))
            if not 1 <= page <= 500: raise ValueError()
        except ValueError:
            raise ApiError(400, 'Invalid page')
        search = param('query').strip()[:200]
        if search:
            return get('search/movie', query=search, page=page, include_adult='false')
        category = param('category', 'popular')
        if category not in ('popular', 'top_rated', 'upcoming'):
            raise ApiError(400, 'Invalid category')
        return get('movie/' + category, page=page, region='GR')
    if re.fullmatch(r'/movies/[1-9][0-9]{0,9}', path):
        resource = 'movie/' + path.rsplit('/', 1)[1]
        data = get(resource, append_to_response='credits,videos,external_ids', include_video_language='el,en,null')
        if not data.get('overview'):
            english = get(resource, language='en-US')
            data['overview'] = english.get('overview', '')
            data['overview_language'] = 'en' if data['overview'] else None
        else:
            data['overview_language'] = 'el'
        return data
    raise ApiError(404, 'Not found')
