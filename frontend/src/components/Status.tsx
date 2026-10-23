import {useEffect,useState} from 'react';
import {CaretLeft,CheckCircle,WarningCircle} from '@phosphor-icons/react';
import type {Quality} from '../lib/types';
import {getQuality} from '../lib/data';
import {useApp} from '../lib/context';
import {back} from '../lib/router';
import {shortDay,updatedLabel} from '../lib/derive';
import {Link} from './ui';

/** Ποιότητα δεδομένων — what the programme covers and what was skipped, so gaps are visible rather than silent. */
export default function Status(){
 const {week,todayIso,venues}=useApp();
 const [q,setQ]=useState<Quality|null|undefined>(undefined);
 useEffect(()=>{const c=new AbortController();getQuality(c.signal).then(setQ);return()=>c.abort()},[]);
 const site=(name:string)=>venues.find(v=>v.name===name)?.website;
 return <main className="screen no-nav narrow">
  <div className="page-head"><button type="button" className="text-btn" onClick={()=>back('/movies')} style={{display:'inline-flex',alignItems:'center',gap:4,padding:0}}><CaretLeft/>Πίσω</button>
   <h1 style={{marginTop:10}}>Ποιότητα δεδομένων</h1>
   <div className="over" style={{marginTop:4}}>{week?`Εβδομάδα ${shortDay(week.weekStart)} – ${shortDay(week.weekEnd)} · ενημ. ${updatedLabel(week.checkedAt,todayIso)}`:''}</div></div>
  <div className="pad" style={{paddingTop:16,display:'flex',flexDirection:'column',gap:14}}>
   {q===undefined&&<p className="muted">Φόρτωση…</p>}
   {q===null&&<div className="empty-card">Η αναφορά δεν είναι διαθέσιμη. Εκτέλεσε <code>py -m showtimes export-static</code>.</div>}
   {q&&<>
    <div className="stat-grid">
     <div className="stat"><div className="v">{q.rows}</div><div className="l">προβολές</div></div>
     <div className="stat"><div className="v">{q.films}</div><div className="l">ταινίες</div></div>
     <div className="stat"><div className="v">{q.cinemasWithProgramme.length}</div><div className="l">σινεμά με πρόγραμμα</div></div>
    </div>
    <section className="q-block"><h2><WarningCircle/>Σινεμά χωρίς πρόγραμμα ({q.knownWithoutProgramme.length})</h2>
     <p>Η πηγή δεν δίνει ωράριο γι' αυτά αυτή την εβδομάδα. Δεν σημαίνει ότι είναι κλειστά.</p>
     {q.knownWithoutProgramme.length?<ul>{q.knownWithoutProgramme.map(n=><li key={n}>{n}{site(n)&&<> · <a href={site(n)} target="_blank" rel="noreferrer">επίσημη σελίδα</a></>}{q.listedWithoutProgramme.includes(n)&&<span className="tag tag-neutral">χωρίς ωράριο στην πηγή</span>}</li>)}</ul>
      :<p><CheckCircle/> Όλα τα σινεμά του καταλόγου έχουν πρόγραμμα.</p>}</section>
    <section className="q-block"><h2><WarningCircle/>Γραμμές που δεν διαβάστηκαν ({q.skipped.length})</h2>
     <p>Σπασμένο ή άγνωστο κείμενο ωραρίου στην πηγή. Αυτές οι προβολές λείπουν από την εφαρμογή.</p>
     {q.skipped.length?<ul>{q.skipped.map((s,i)=><li key={i}><b>{s.cinema}</b> · {s.movie}<code>{s.rawSchedule||s.reason}</code></li>)}</ul>:<p><CheckCircle/> Καμία.</p>}</section>
    <section className="q-block"><h2><WarningCircle/>Χωρίς στοιχεία TMDB ({q.unmatchedTmdb.length})</h2>
     <p>Ο τίτλος δεν αντιστοιχίστηκε με βεβαιότητα, οπότε δεν έχουν πόστερ ή διάρκεια. Το φίλτρο «τελειώνει πριν» δεν τις αποκλείει.</p>
     {q.unmatchedTmdb.length>0&&<ul>{q.unmatchedTmdb.map(t=><li key={t}>{t}</li>)}</ul>}</section>
    {q.reportWeek&&q.reportWeek!==q.weekStart&&<div className="notice" style={{margin:0}}>Η τελευταία ανάγνωση της πηγής αφορά άλλη εβδομάδα ({q.reportWeek}).</div>}
   </>}
   <p className="source-line"><Link to="/movies">Πίσω στις ταινίες</Link></p>
  </div>
 </main>;
}
