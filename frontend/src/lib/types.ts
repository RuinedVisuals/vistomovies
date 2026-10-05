export type Version='subtitled'|'dubbed'|'3d';
export type Showtime={id:string;movie:string;movieSourceUrl?:string|null;cinema:string;screen:string|null;
 programmeDate:string;date:string;time:string;afterMidnight?:boolean;timezone?:'Europe/Athens';
 bookingUrl:string|null;sourceUrl:string;rawSchedule:string;weekStart?:string;dateBasis?:string;version?:Version};
export type Source={source:string;checkedAt?:string|null;lastSuccessAt:string|null;error:string|null};
export type WeekData={weekStart:string;weekEnd:string;checkedAt:string|null;showtimes:Showtime[];sources:Source[]};
export type Region='Κέντρο'|'Βόρεια'|'Νότια'|'Δυτικά'|'Πειραιάς';
export type Cinema={id:string;name:string;address:string;summer:boolean;coordinates?:[number,number];coordinateSource?:string;
 coordinatePrecision?:'venue'|'address';area?:string;region?:Region;phone?:string;website?:string;athinoramaUrl?:string};
/** Cinema joined with derived geo fields. precision: OSM venue, OSM address point, or stopgap approximation. */
export type Venue=Cinema&{area:string;region:Region;lng:number|null;lat:number|null;verified:boolean;precision:'venue'|'address'|'approximate'|null;addrShort:string};
export type CastMember={name:string;role:string;profile:string|null};
export type FilmMeta={tmdbId:number;imdbId:string|null;title:string;originalTitle:string|null;year:number|null;runtime:number|null;
 genres:string[];countryCode:string|null;languageCode:string|null;vote:number|null;voteCount:number;overview:string;overviewLanguage?:string|null;
 posterPath:string|null;backdropPath:string|null;cast:CastMember[];badge?:string};
/** title → metadata; null = looked up, no TMDB match; missing = not looked up yet. */
export type FilmIndex=Record<string,FilmMeta|null>;
export type Catalog={movies:Record<string,{title:string;poster:string|null;genre:string}>};

export const filmKey=(s:Pick<Showtime,'movieSourceUrl'|'movie'>)=>s.movieSourceUrl||s.movie;
export const normalize=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const nowTime=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
export const addDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const dateLabel=(s:string,opts:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('el-GR',{...opts,timeZone:'Europe/Athens'}).format(new Date(s+'T12:00:00Z'));
