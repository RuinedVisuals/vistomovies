import type {Cinema,Region,Venue} from './types';

// Stopgap [lng, lat, area, region] from the design handoff, used ONLY for cinemas that the OSM geocoder
// (py -m showtimes geocode) could not place. These positions are approximate and labelled as such in the UI.
const GEO:Record<string,[number,number,string,Region]>={
 b8c22e14f1e3:[23.7310,37.9787,'Κέντρο','Κέντρο'],'6025fbf95fcf':[23.7395,37.9868,'Νεάπολη','Κέντρο'],a016d3f103b0:[23.7455,37.9757,'Κέντρο','Κέντρο'],
 '26a0c32696ee':[23.7337,37.9818,'Κέντρο','Κέντρο'],'1a9616258f41':[23.7128,37.9786,'Κεραμεικός','Κέντρο'],'18898b5f2543':[23.7105,37.9688,'Άνω Πετράλωνα','Κέντρο'],
 '30ddc70fd556':[23.7196,37.9713,'Θησείο','Κέντρο'],'27b10840d732':[23.7268,37.9600,'Κουκάκι','Κέντρο'],'9c4db8601c15':[23.7303,37.9722,'Πλάκα','Κέντρο'],
 '59520dd760c4':[23.7578,37.9862,'Αμπελόκηποι','Κέντρο'],'4ee947d02158':[23.7612,37.9884,'Αμπελόκηποι','Κέντρο'],cf05dc71bad8:[23.7664,37.9937,'Αμπελόκηποι','Κέντρο'],
 d361e7503410:[23.7563,37.9918,'Αμπελόκηποι','Κέντρο'],f4222dc42487:[23.8105,38.0705,'Κηφισιά','Βόρεια'],a00feaa92895:[23.8137,38.0746,'Κηφισιά','Βόρεια'],
 '8da6985265fb':[23.7915,38.0441,'Μαρούσι','Βόρεια'],'21e97c520610':[23.8040,38.0505,'Μαρούσι','Βόρεια'],ba3efd4d876a:[23.7985,38.0215,'Χαλάνδρι','Βόρεια'],
 '1681b7c99c72':[23.7318,38.0006,'Πατήσια','Κέντρο'],f0f648580330:[23.7428,38.0010,'Κυψέλη','Κέντρο'],'8fba490b2bc6':[23.7393,38.0043,'Πλ. Αμερικής','Κέντρο'],
 bdf83e169087:[23.7307,37.9935,'Βικτώρια','Κέντρο'],bc56d4375013:[23.7468,37.9688,'Παγκράτι','Κέντρο'],b522ccd2b368:[23.7532,37.9637,'Παγκράτι','Κέντρο'],
 '0642f772645f':[23.7367,37.9478,'Δάφνη','Νότια'],'686108ab5963':[23.7392,37.9356,'Αγ. Δημήτριος','Νότια'],e7b265e7209c:[23.7548,37.8648,'Γλυφάδα','Νότια'],
 '5421cf46f991':[23.7536,37.8640,'Γλυφάδα','Νότια'],b54098f3a32e:[23.6475,37.9427,'Πειραιάς','Πειραιάς'],'3de7d8f573b9':[23.6648,37.9612,'Ρέντης','Πειραιάς'],
 '347b546d5fa2':[23.7020,37.9705,'Ρουφ','Κέντρο'],'2a7795d9601e':[23.7040,38.0335,'Ίλιον','Δυτικά'],a2723f7ffacd:[23.6960,38.0080,'Περιστέρι','Δυτικά'],
 '13d9243fe041':[23.6815,37.9925,'Αιγάλεω','Δυτικά'],
};
export const REGIONS:Region[]=['Κέντρο','Βόρεια','Νότια','Δυτικά','Πειραιάς'];
/** Default reference point (Σύνταγμα) until the user shares a location. */
export const SYNTAGMA:[number,number]=[23.7348,37.9755];

const areaOf=(c:Cinema)=>{const segs=c.address.replace(/\([^)]*\)/g,'').split(',').map(x=>x.trim()).filter(x=>x&&!/\d/.test(x));return segs.length?segs[segs.length-1]:'Αθήνα'};
const regionOf=(a:string):Region=>/Πειραι|Δραπετσ|Νίκαια|Κορυδαλ|Ρέντη|Σαλαμ|Σελήνια/.test(a)?'Πειραιάς':/Χαϊδάρι|Μάνδρα|Αιγάλεω|Περιστ/.test(a)?'Δυτικά':/Βάρκιζα|Σαρωνίδα|Ηλιούπολη|Σμύρνη|Καλλιθέα|Γλυφάδα/.test(a)?'Νότια':'Βόρεια';

export function toVenue(c:Cinema):Venue{
 const g=GEO[c.id];const pos=c.coordinates||(g?[g[0],g[1]]:null);
 const area=c.area||(g?g[2]:areaOf(c));
 const precision=c.coordinates?(c.coordinatePrecision||'venue'):g?'approximate':null;
 return {...c,area,region:c.region||(g?g[3]:regionOf(area)),lng:pos?pos[0]:null,lat:pos?pos[1]:null,verified:precision==='venue',precision,
  addrShort:c.address.replace(/\s*\([^)]*\)/g,'').split(',')[0]};
}
export function km(v:{lng:number|null;lat:number|null},from:[number,number]){
 if(v.lng==null||v.lat==null)return null;const R=6371,r=Math.PI/180,dLa=(v.lat-from[1])*r,dLo=(v.lng-from[0])*r;
 const x=Math.sin(dLa/2)**2+Math.cos(from[1]*r)*Math.cos(v.lat*r)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));
}
export const kmLabel=(k:number|null)=>k==null?'—':k.toFixed(1).replace('.',',')+' χλμ';
/** Real booking link when the source has one; otherwise a search for the cinema's own ticketing page
 *  (we never invent a booking URL). */
export const ticketsUrl=(cinema:string,film:string|undefined,bookingUrl:string|null|undefined)=>bookingUrl||
 'https://www.google.com/search?q='+encodeURIComponent(`${cinema} εισιτήρια${film?' '+film:''}`);
export const directionsUrl=(v:Venue)=>'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(v.verified&&v.lat!=null?`${v.lat},${v.lng}`:`${v.name}, ${v.address}, Αθήνα`);
/** Stable hue for placeholder tiles. */
export const venueHue=(id:string)=>(parseInt(id.slice(0,2),16)*1.4)|0;
