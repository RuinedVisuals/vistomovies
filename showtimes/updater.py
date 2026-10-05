"""Automatic weekly programme updates (Athinorama weeks run Thursday→Wednesday).

The source page shows weekdays but no dates, so the week is inferred from today's date and
a new week is only accepted once the page has visibly changed. That way last week's programme
is never stored under the new week's dates.

  - Every day: one refresh of the current week (captures mid-week edits).
  - New week due (Thursday onwards) but not stored: retry every few hours until the page
    differs enough from the stored week; then store it and prefetch TMDB metadata.
"""
import json
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from . import athinorama, storage, films
from .network import fetch

SOURCE = 'athinorama'
TZ = ZoneInfo('Europe/Athens')
SAME_WEEK = 0.97       # ≥ this similarity to the stored week on Thursday = page not updated yet
SUSPICIOUS_DRIFT = 0.75  # < this mid-week = the page probably already shows next week
MAX_ISSUES = 5         # unknown schedule lines skipped (and reported) before the import fails
DAILY_HOUR = 10
RETRY_HOURS = 3
NOT_UPDATED = 'Η πηγή δεν έχει δημοσιεύσει ακόμη το πρόγραμμα της νέας εβδομάδας.'


def programme_thursday(day):
    """Thursday that starts the programme week containing day."""
    return day - timedelta(days=(day.weekday() - 3) % 7)


def fingerprint(rows):
    return {(r['cinema'], r.get('screen'), r['movie'], r.get('rawSchedule')) for r in rows}


def similarity(a, b):
    a, b = fingerprint(a), fingerprint(b)
    return len(a & b) / len(a | b) if a | b else 1.0


def run(db, today=None, html=None, report=Path('data/parse-report.json')):
    """One update attempt. Returns a dict describing what happened (also stored as source status)."""
    today = today or datetime.now(TZ).date()
    target = programme_thursday(today).isoformat()
    stored = storage.week(db)
    try:
        html = html if html is not None else fetch(athinorama.URL)
        rows, issues, cinemas = athinorama.parse(html, target)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps({'weekStart': target, 'cinemasListed': cinemas, 'cinemasWithShowtimes': sorted({r['cinema'] for r in rows}),
                                      'cinemaInfo': athinorama.cinema_info(html), 'issues': issues}, ensure_ascii=False, indent=2), encoding='utf-8')
        if len(issues) > MAX_ISSUES:
            raise ValueError(f'{len(issues)} unparsed schedules; see {report}. Previous data preserved.')
        sim = similarity(rows, stored['showtimes']) if stored['showtimes'] else 0.0
        if stored['weekStart'] and stored['weekStart'] < target and sim >= SAME_WEEK:
            storage.fail(db, SOURCE, NOT_UPDATED)
            return {'status': 'not-updated', 'weekStart': stored['weekStart'], 'similarity': round(sim, 3)}
        if stored['weekStart'] == target and sim < SUSPICIOUS_DRIFT:
            storage.fail(db, SOURCE, 'Το πρόγραμμα άλλαξε ασυνήθιστα πολύ μέσα στην εβδομάδα· δεν αποθηκεύτηκε (πιθανώς είναι ήδη της επόμενης).')
            return {'status': 'suspicious', 'weekStart': stored['weekStart'], 'similarity': round(sim, 3)}
        storage.save(db, SOURCE, rows)
        return {'status': 'saved', 'weekStart': target, 'rows': len(rows), 'skippedIssues': len(issues), 'similarity': round(sim, 3),
                'new': stored['weekStart'] != target}
    except Exception as e:  # network, robots, parse — keep previous data
        storage.fail(db, SOURCE, e)
        return {'status': 'failed', 'error': str(e)}


def due(db, now=None):
    """Whether an automatic attempt should run now."""
    now = now or datetime.now(TZ)
    status = next((s for s in storage.status(db) if s['source'] == SOURCE), None)
    last = datetime.fromisoformat(status['checkedAt']).astimezone(TZ) if status and status.get('checkedAt') else None
    stored = storage.week(db)['weekStart']
    target = programme_thursday(now.date()).isoformat()
    if not (9 <= now.hour < 22):
        return False
    if not stored or stored < target:  # new week expected
        return last is None or now - last >= timedelta(hours=RETRY_HOURS)
    return now.hour >= DAILY_HOUR and (last is None or last.date() < now.date())


STATIC = Path('frontend/public')


def export_static(db, out=STATIC):
    """Write the current week + TMDB metadata as static files (snapshot.json, films.json) for hosting
    without the Python API. The frontend falls back to them when /api is unavailable."""
    wk = storage.week(db)
    if not wk['showtimes']:
        return None
    sources = storage.status(db)
    checked = max((x['checkedAt'] for x in sources if x.get('checkedAt')), default=None)
    (out / 'snapshot.json').write_text(json.dumps({**wk, 'checkedAt': checked, 'sources': sources}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    titles = sorted({r['movie'] for r in wk['showtimes']})
    cache = films.load()
    known = {t: cache[t]['film'] for t in titles if isinstance(cache.get(t), dict) and 'fetchedAt' in cache[t]}
    (out / 'films.json').write_text(json.dumps({'source': 'TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.', 'films': known}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return {'rows': len(wk['showtimes']), 'films': sum(1 for v in known.values() if v)}


def prefetch_films(db):
    titles = sorted({r['movie'] for r in storage.week(db)['showtimes']})
    if titles:
        films.films(titles)  # starts the background TMDB fill for unmatched titles


def start_background(db_path, log=print, interval=1800):
    """Daemon thread for `serve`: checks every interval seconds whether an update is due."""
    def loop():
        while True:
            db = storage.connect(db_path)
            try:
                if due(db):
                    result = run(db)
                    log(f'[update] {datetime.now(TZ):%Y-%m-%d %H:%M} {json.dumps(result, ensure_ascii=False)}')
                    if result['status'] == 'saved':
                        prefetch_films(db)
                        films.wait()
                        export_static(db)
                else:
                    prefetch_films(db)  # cheap when the TMDB cache is warm
            except Exception as e:
                log(f'[update] error: {e}')
            finally:
                db.close()
            time.sleep(interval)
    t = threading.Thread(target=loop, daemon=True, name='programme-updater')
    t.start()
    return t
