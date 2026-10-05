"""Athinorama public HTML adapter. Explicit programme week is required."""
from html.parser import HTMLParser
from datetime import date,timedelta
from urllib.parse import urljoin
import re
URL='https://www.athinorama.gr/cinema/guide/all/cinemas/'
class Node:
    def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
    def text(self):return ' '.join(' '.join(c.text() if isinstance(c,Node) else c for c in self.children).split())
    def find(self,tag=None,cls=None):
        for c in self.children:
            if isinstance(c,Node):
                if (not tag or c.tag==tag) and (not cls or cls in c.attrs.get('class','').split()):yield c
                yield from c.find(tag,cls)
class DOM(HTMLParser):
    def __init__(self,html):
        super().__init__();self.root=Node();self.stack=[self.root];self.feed(html)
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs);self.stack[-1].children.append(n)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:self.stack=self.stack[:i];break
    def handle_data(self,s):self.stack[-1].children.append(s)

DAYS={'Πέμ':0,'Παρ':1,'Σάβ':2,'Κυρ':3,'Δευτ':4,'Δευ':4,'Τρ':5,'Τρί':5,'Τετ':6}
DAY=r'(?:Δευτ|Πέμ|Παρ|Σάβ|Κυρ|Δευ|Τρί|Τρ|Τετ)\.?'
EXPR=rf'{DAY}(?:\s*[-–]\s*{DAY})?(?:\s*,\s*{DAY}(?:\s*[-–]\s*{DAY})?)*'
CLAUSE=re.compile(rf'({EXPR})\s*:?\s*((?:\d{{1,2}}[.:]\d{{2}})(?:\s*[/,]\s*\d{{1,2}}[.:]\d{{2}})*)')
def expand(schedule,start):
    schedule=re.sub(r'\((?:με εισ\.|Εισ\.|special previews|\d+€ όλα τα εισιτήρια)[^)]*\)', '', schedule, flags=re.I)
    schedule=re.sub(r'(?:μεταγλ\.|DOLBY ATMOS|υποτ\.)', '', schedule, flags=re.I).strip()
    matches=list(CLAUSE.finditer(schedule));res=[];last=0
    if not matches:raise ValueError('Unrecognized schedule: '+schedule)
    for m in matches:
        if schedule[last:m.start()].strip(' ,;'):raise ValueError('Unparsed schedule text: '+schedule)
        last=m.end();indices=set()
        for part in m[1].split(','):
            ds=re.findall(DAY,part);nums=[DAYS[d.rstrip('.')] for d in ds]
            if len(nums)==1:indices.add(nums[0])
            else:
                i=nums[0];indices.add(i)
                while i!=nums[1]:i=(i+1)%7;indices.add(i)
        for t in re.findall(r'\d{1,2}[.:]\d{2}',m[2]):
            h,minute=map(int,re.split('[.:]',t))
            if not 0<=h<=23 or not 0<=minute<=59:raise ValueError('Invalid time: '+t)
            for i in sorted(indices):res.append(((start+timedelta(days=i)).isoformat(),f'{h:02}:{minute:02}'))
    if schedule[last:].strip(' ,;'):raise ValueError('Unparsed schedule suffix: '+schedule)
    return sorted(set(res))

def version(raw):
    """Screening version noted in the schedule text; the time parser strips it."""
    if re.search(r'μεταγλ',raw,re.I):return 'dubbed'
    if re.search(r'(?<![\w])3D(?![\w])',raw):return '3d'
    return 'subtitled'

def parse(html,week_start):
    start=date.fromisoformat(week_start)
    if start.weekday()!=3:raise ValueError('--week-start must be a Thursday')
    root=DOM(html).root;rows=[];issues=[];cinemas=[]
    for card in root.find(cls='card-item'):
        heading=next(card.find('h2'),None)
        if not heading:continue
        a=next(heading.find('a'),None)
        if not a or '/cinema/halls/' not in a.attrs.get('href',''):continue
        cinema=a.text();cinemas.append(cinema);screen=None
        for grid in card.find(cls='schedule-grid'):
            for child in grid.children:
                if not isinstance(child,Node):continue
                classes=child.attrs.get('class','').split()
                if 'schedule-grid-title' in classes:screen=child.text();continue
                if 'schedule-item' not in classes:continue
                h=next(child.find('h3'),None)
                if not h:raise ValueError('Movie title structure changed')
                ma=next(h.find('a'),None)
                infos=list(child.find(cls='schedule-infos'))
                if not infos:issues.append({'cinema':cinema,'movie':h.text(),'reason':'No schedule'});continue
                for info in infos:
                    raw=info.text()
                    try:times=expand(raw,start)
                    except ValueError as e:
                        issues.append({'cinema':cinema,'movie':h.text(),'screen':screen,'rawSchedule':raw,'reason':str(e)});continue
                    for day,time in times:
                        rows.append(dict(movie=h.text(),movieSourceUrl=urljoin(URL,ma.attrs['href']) if ma else None,cinema=cinema,screen=screen,programmeDate=day,date=(date.fromisoformat(day)+timedelta(days=1)).isoformat() if time<'06:00' else day,time=time,afterMidnight=time<'06:00',timezone='Europe/Athens',bookingUrl=None,sourceUrl=urljoin(URL,a.attrs['href']),rawSchedule=raw,version=version(raw),weekStart=week_start,dateBasis='operator-confirmed-programme-week'))
    if not cinemas or not rows:raise ValueError('No cinema schedules parsed; HTML may have changed')
    return rows,issues,cinemas

def cinema_info(html):
    """Per-cinema details shown on the page: hall URL, address line and phone numbers."""
    out={}
    for card in DOM(html).root.find(cls='card-item'):
        heading=next(card.find('h2'),None);a=next(heading.find('a'),None) if heading else None
        if not a or '/cinema/halls/' not in a.attrs.get('href',''):continue
        details=next(card.find(cls='details'),None);tags=next(card.find(cls='tags'),None)
        phones=re.findall(r'(?<!\d)2\d{9}(?!\d)',tags.text() if tags else '')
        out[a.text()]={'url':urljoin(URL,a.attrs['href']),'address':details.text() if details else None,'phones':phones}
    return out
