import {createContext,useContext} from 'react';
import type {Catalog,FilmIndex,Showtime,Venue,WeekData} from './types';

export type AppData={
 week:WeekData|null;mode:'api'|'snapshot';loading:boolean;error:string;retry:()=>void;
 rows:Showtime[];venues:Venue[];venueByName:Map<string,Venue>;venueById:Map<string,Venue>;
 films:FilmIndex;catalog:Catalog;todayIso:string;
 userLoc:[number,number]|null;locate:()=>Promise<[number,number]|null>;
 savedFilms:{items:string[];toggle:(k:string)=>void;has:(k:string)=>boolean};
 favCinemas:{items:string[];toggle:(k:string)=>void;has:(k:string)=>boolean};
};
export const AppContext=createContext<AppData|null>(null);
export function useApp(){const v=useContext(AppContext);if(!v)throw new Error('AppContext missing');return v}
