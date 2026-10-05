import argparse,json,sys
from pathlib import Path
from datetime import datetime,date
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
from . import parsers,storage,athinorama,tmdb,films,updater,geocode
from .network import fetch

def main():
    p=argparse.ArgumentParser(description='Athens cinema ingestion prototype')
    p.add_argument('--db',default='data/showtimes.sqlite')
    sub=p.add_subparsers(dest='cmd',required=True)
    s=sub.add_parser('scrape');s.add_argument('--html',type=Path,help='Parse a locally saved Athinorama HTML page');s.add_argument('--week-start',required=True,help='Confirmed programme Thursday, YYYY-MM-DD')
    d=sub.add_parser('discover');d.add_argument('--html',type=Path);d.add_argument('--out',default='data/more-discovery.json')
    sub.add_parser('status')
    e=sub.add_parser('export');e.add_argument('--date');e.add_argument('--out',default='data/showtimes.json')
    u=sub.add_parser('update',help='One automatic update attempt (week inferred from today)');u.add_argument('--html',type=Path,help='Use a saved page instead of fetching')
    sub.add_parser('export-static',help='Write frontend/public/snapshot.json + films.json for hosting without the API')
    sub.add_parser('geocode',help='Locate cinemas via OpenStreetMap into frontend/public/cinemas.json')
    a=sub.add_parser('serve');a.add_argument('--port',type=int,default=8787);a.add_argument('--no-auto-update',action='store_true',help='Do not refresh the programme in the background')
    args=p.parse_args();db=storage.connect(args.db)
    if args.cmd=='scrape':
        source='athinorama'
        try:
            html=args.html.read_text(encoding='utf-8') if args.html else fetch(athinorama.URL)
            rows,issues,cinemas=athinorama.parse(html,args.week_start)
            Path('data').mkdir(exist_ok=True)
            Path('data/parse-report.json').write_text(json.dumps({'cinemasListed':cinemas,'cinemasWithShowtimes':sorted({r['cinema'] for r in rows}),'issues':issues},ensure_ascii=False,indent=2),encoding='utf-8')
            if issues: raise ValueError(f'{len(issues)} unparsed schedules; see data/parse-report.json. Previous data preserved.')
            storage.save(db,source,rows)
            print(json.dumps({'source':source,'count':len(rows),'firstDate':rows[0]['date'],'lastDate':rows[-1]['date']},ensure_ascii=False))
        except Exception as e:
            storage.fail(db,source,e);print('FAILED: '+str(e),file=sys.stderr);return 1
    elif args.cmd=='discover':
        html=args.html.read_text(encoding='utf-8') if args.html else fetch('https://www.more.com/gr-el/tickets/cinema/')
        urls=parsers.more_discovery(html)
        out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps({'kind':'event-links-not-showtimes','urls':urls},ensure_ascii=False,indent=2),encoding='utf-8');print(f'{len(urls)} event URLs; no screening times inferred.')
    elif args.cmd=='update':
        result=updater.run(db,html=args.html.read_text(encoding='utf-8') if args.html else None)
        print(json.dumps(result,ensure_ascii=False))
        if result['status']=='saved':
            updater.prefetch_films(db);films.wait();print(json.dumps({'static':updater.export_static(db)},ensure_ascii=False))
        return 0 if result['status'] in ('saved','not-updated') else 1
    elif args.cmd=='geocode':geocode.run()
    elif args.cmd=='export-static':print(json.dumps(updater.export_static(db),ensure_ascii=False))
    elif args.cmd=='status':print(json.dumps(storage.status(db),ensure_ascii=False,indent=2))
    elif args.cmd=='export':
        out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps({'showtimes':storage.read(db,args.date),'sources':storage.status(db)},ensure_ascii=False,indent=2),encoding='utf-8');print(out)
    elif args.cmd=='serve':
        db.close()
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                u=urlparse(self.path)
                if u.path == '/movies' or u.path.startswith('/movies/'):
                    try:return self.respond(200,tmdb.route(u.path,parse_qs(u.query)))
                    except tmdb.ApiError as e:return self.respond(e.status,{'error':str(e)})
                if u.path=='/films':
                    c=storage.connect(args.db)
                    try:titles=sorted({r['movie'] for r in storage.week(c)['showtimes']})
                    finally:c.close()
                    return self.respond(200,films.films(titles))
                if u.path not in ('/showtimes/today','/showtimes','/showtimes/week','/health'):return self.respond(404,{'error':'Not found'})
                day=parse_qs(u.query).get('date',[datetime.now(ZoneInfo('Europe/Athens')).date().isoformat()])[0]
                try:date.fromisoformat(day)
                except ValueError:return self.respond(400,{'error':'date must be YYYY-MM-DD'})
                c=storage.connect(args.db)
                try:
                    sources=storage.status(c);payload={'sources':sources}
                    checked=max((x['checkedAt'] for x in sources if x.get('checkedAt')),default=None)
                    if u.path=='/showtimes/week':
                        payload.update(storage.week(c,parse_qs(u.query).get('date',[None])[0]),checkedAt=checked)
                    elif u.path!='/health':
                        wk=storage.week(c,day)
                        payload.update(date=day,showtimes=storage.read(c,day),weekStart=wk['weekStart'],weekEnd=wk['weekEnd'],checkedAt=checked)
                    self.respond(200,payload)
                finally:c.close()
            def respond(self,code,payload):
                b=json.dumps(payload,ensure_ascii=False).encode();self.send_response(code)
                self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
        print(f'Local API: http://127.0.0.1:{args.port}',flush=True)
        if not args.no_auto_update:
            updater.start_background(args.db,log=lambda m:print(m,flush=True))
            print('Αυτόματη ενημέρωση προγράμματος: ενεργή (καθημερινά 10:00, Πέμπτη έως 3 προσπάθειες).',flush=True)
        ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:print('FAILED: '+str(e),file=sys.stderr);sys.exit(1)
