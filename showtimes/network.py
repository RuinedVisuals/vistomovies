import time, urllib.request, urllib.error, urllib.parse, urllib.robotparser
UA='AthensShowtimesPrototype/0.1'
class NoCrossOrigin(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if urllib.parse.urlsplit(newurl).netloc!=urllib.parse.urlsplit(req.full_url).netloc:
            raise RuntimeError('Cross-origin redirect blocked (possibly queue/login): '+newurl.split('?')[0])
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch(url):
    """Small bounded GET; stop on errors and queue pages. No bypass/retries."""
    opener=urllib.request.build_opener(NoCrossOrigin())
    def get(target):
        req=urllib.request.Request(target,headers={'User-Agent':UA,'Accept':'text/html,text/plain'})
        with opener.open(req,timeout=20) as r:
            b=r.read(4_000_001)
            if len(b)>4_000_000: raise RuntimeError('Response too large')
            text=b.decode(r.headers.get_content_charset() or 'utf-8',errors='replace')
            if 'queue-it.net' in r.url: raise RuntimeError('Queue protection')
            return text
    parts=urllib.parse.urlsplit(url)
    robots_url=urllib.parse.urlunsplit((parts.scheme,parts.netloc,'/robots.txt','',''))
    try: robots=get(robots_url)
    except urllib.error.HTTPError as e:
        if e.code!=404: raise
        robots=''
    rp=urllib.robotparser.RobotFileParser();rp.parse(robots.splitlines())
    if not rp.can_fetch(UA,url): raise RuntimeError('Disallowed by robots.txt')
    time.sleep(max(2,rp.crawl_delay(UA) or 0))
    return get(url)
