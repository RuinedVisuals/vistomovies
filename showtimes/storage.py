import sqlite3,json,hashlib
from datetime import datetime,timezone,date,timedelta
from pathlib import Path

def connect(path):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path)
    db.execute('CREATE TABLE IF NOT EXISTS screenings (id TEXT PRIMARY KEY, source TEXT, date TEXT, payload TEXT)')
    db.execute('CREATE TABLE IF NOT EXISTS sources (source TEXT PRIMARY KEY, checked TEXT, success TEXT, error TEXT)')
    return db

def save(db,source,rows):
    if not rows: raise ValueError('Refusing empty replacement')
    now=datetime.now(timezone.utc).isoformat()
    with db:
        db.execute('DELETE FROM screenings WHERE source=?',(source,))
        for r in rows:
            r=dict(r,source=source,observedAt=now)
            key=hashlib.sha256(json.dumps([source,r['cinema'],r['screen'],r['movie'],r['date'],r['time']],ensure_ascii=False).encode()).hexdigest()[:24]
            r['id']=key
            db.execute('INSERT OR REPLACE INTO screenings VALUES(?,?,?,?)',(key,source,r['date'],json.dumps(r,ensure_ascii=False)))
        db.execute('INSERT OR REPLACE INTO sources VALUES(?,?,?,NULL)',(source,now,now))

def fail(db,source,error):
    with db:
        db.execute('INSERT INTO sources VALUES(?,?,NULL,?) ON CONFLICT(source) DO UPDATE SET checked=excluded.checked,error=excluded.error',(source,datetime.now(timezone.utc).isoformat(),str(error)))

def read(db,date=None):
    q='SELECT payload FROM screenings';args=()
    if date:q+=' WHERE date=?';args=(date,)
    return sorted([json.loads(r[0]) for r in db.execute(q,args)],key=lambda r:(r['date'],r['time'],r['cinema']))

def status(db):
    return [dict(zip(('source','checkedAt','lastSuccessAt','error'),row)) for row in db.execute('SELECT * FROM sources')]

def week(db,day=None):
    """All rows of one programme week (Thu-Wed): the week containing day, else the latest."""
    rows=read(db)
    starts=sorted({r.get('weekStart') for r in rows if r.get('weekStart')})
    start=starts[-1] if starts else None
    if day:
        start=next((s for s in reversed(starts) if s<=day<=(date.fromisoformat(s)+timedelta(days=6)).isoformat()),None)
    if not start:return {'weekStart':None,'weekEnd':None,'showtimes':[]}
    return {'weekStart':start,'weekEnd':(date.fromisoformat(start)+timedelta(days=6)).isoformat(),'showtimes':[r for r in rows if r.get('weekStart')==start]}
