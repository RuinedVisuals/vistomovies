import type {Plan} from './plans';

const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
/** Local (floating) time YYYYMMDDTHHMMSS: the calendar shows it as 17:00 wherever the viewer is, which is what a cinema time means. */
const local=(date:string,time:string,addMin=0)=>{
 const [y,m,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number);
 // Times before 06:00 belong to the programme day but happen after midnight.
 const t=new Date(Date.UTC(y,m-1,d,h,mi+addMin+(h<6?1440:0)));
 const p=(n:number)=>String(n).padStart(2,'0');
 return `${t.getUTCFullYear()}${p(t.getUTCMonth()+1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
};

/** iCalendar text for one screening (2 h by default). */
export function planIcs(p:Plan,minutes=120){
 const url=`${location.origin}/movies/${p.film_route}?date=${p.show_date}&cinema=${p.cinema_id}&time=${p.show_time}`;
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Visto//Plans//EL','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  `UID:${p.id}@visto`,`DTSTAMP:${stamp(new Date())}`,
  `DTSTART:${local(p.show_date,p.show_time)}`,`DTEND:${local(p.show_date,p.show_time,minutes)}`,
  `SUMMARY:${esc('Σινεμά: '+p.film_title)}`,`LOCATION:${esc(p.cinema_name)}`,
  `DESCRIPTION:${esc([p.note&&`«${p.note}»`,url].filter(Boolean).join('\n'))}`,`URL:${url}`,'END:VEVENT','END:VCALENDAR'];
 return lines.join('\r\n')+'\r\n';
}

/** Downloads the .ics (opens the calendar app on phones). */
export function downloadIcs(p:Plan){
 const blob=new Blob([planIcs(p)],{type:'text/calendar;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=(p.film_title.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'sxedio')+'.ics';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
