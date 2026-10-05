"""Source-specific parsers. Never expand event ranges into screenings."""
from html.parser import HTMLParser
from urllib.parse import urljoin
from datetime import datetime, timedelta
import re

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(); self.text=[]; self.tables=[]; self.links=[]
        self.table=None; self.row=None; self.cell=None; self.ignore=0
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag in ('script','style'): self.ignore+=1
        if tag=='a' and a.get('href'): self.links.append(a['href'])
        if tag=='table': self.table=[]
        if tag=='tr' and self.table is not None: self.row=[]
        if tag in ('td','th') and self.row is not None: self.cell=[]
        if tag=='br' and self.cell is not None: self.cell.append(' ')
    def handle_data(self, s):
        if not self.ignore:
            self.text.append(s)
            if self.cell is not None: self.cell.append(s)
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.ignore=max(0,self.ignore-1)
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(' '.join(self.cell).split())); self.cell=None
        if tag=='tr' and self.row is not None:
            self.table.append(self.row); self.row=None
        if tag=='table' and self.table is not None:
            self.tables.append(self.table); self.table=None

DAYS=['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή']
def mikrokosmos(html):
    doc=Document(html); text=' '.join(doc.text)
    ranges=re.findall(r'(\d{2}/\d{2}/\d{2,4})\s*[–—-]\s*(\d{2}/\d{2}/\d{2,4})',text)
    def date(s): return datetime.strptime(s,'%d/%m/%Y' if len(s)==10 else '%d/%m/%y').date()
    unique={(date(a),date(b)) for a,b in ranges}
    if len(unique)!=1: raise ValueError('Missing or ambiguous programme week')
    start,end=unique.pop()
    if (end-start).days!=6: raise ValueError('Expected a seven-day programme')
    cells={}
    for table in doc.tables:
        if len(table)>=2 and len(table[0])==7 and all(x in DAYS for x in table[0]):
            for day,cell in zip(table[0],table[1]): cells[day]=cell
            break
    if not cells:
        for table in doc.tables:
            for row in table:
                if len(row)==2 and row[0] in DAYS: cells[row[0]]=row[1]
    if len(cells)!=7: raise ValueError('Programme table changed: expected all seven weekdays')
    booking=next((urljoin('https://mikrokosmoscinema.gr/',u) for u in doc.links if 'more.com/' in u),None)
    rows=[]
    for n in range(7):
        day=start+timedelta(days=n); cell=cells[DAYS[day.weekday()]]
        matches=list(re.finditer(r'(?<!\d)([0-2]?\d[:.][0-5]\d)\s*/\s*',cell))
        if not matches and cell.strip() not in ('','-','—'): raise ValueError('Unrecognized programme cell: '+cell)
        for i,m in enumerate(matches):
            time=m[1].replace('.',':').zfill(5)
            datetime.strptime(time,'%H:%M')
            raw=cell[m.end():matches[i+1].start() if i+1<len(matches) else len(cell)].strip()
            title=re.sub(r'\s*\(\d+(?:[.,]\d+)?\s*(?:ΕΥΡ[ΩΏ]|€)\)\s*$','',raw,flags=re.I).strip()
            if not title: raise ValueError('Empty title')
            rows.append(dict(movie=title,rawTitle=raw,cinema='Μικρόκοσμος',screen=None,date=day.isoformat(),time=time,timezone='Europe/Athens',bookingUrl=booking,sourceUrl='https://mikrokosmoscinema.gr/'))
    if not rows: raise ValueError('Empty programme; preserving previous data')
    return rows

def more_discovery(html):
    doc=Document(html)
    urls=sorted({urljoin('https://www.more.com',u) for u in doc.links if re.match(r'^/gr-el/tickets/cinemas?/.+',u)})
    if not urls: raise ValueError('More listing changed or blocked')
    return urls
