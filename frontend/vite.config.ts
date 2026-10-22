import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const api={'/api':{target:'http://127.0.0.1:8787',changeOrigin:true,rewrite:(p:string)=>p.replace(/^\/api/,'')}};
// Offline: the app shell and the weekly programme files are cached; /api is network-first with the cached copy as fallback.
const week=(name:string,handler:'StaleWhileRevalidate'|'NetworkFirst',pattern:RegExp,extra:object={})=>({urlPattern:pattern,handler,options:{cacheName:name,...extra}});
export default defineConfig({
 plugins:[react(),VitePWA({
  registerType:'prompt',
  includeAssets:['favicon.svg','apple-touch-icon.png','tmdb-logo.svg'],
  manifest:{name:'Visto — Τι παίζει στην Αθήνα',short_name:'Visto',description:'Το προσωπικό σου πρόγραμμα σινεμά στην Αθήνα.',lang:'el',
   start_url:'/movies',scope:'/',display:'standalone',orientation:'portrait',theme_color:'#0a0a0f',background_color:'#0a0a0f',
   icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},
  workbox:{
   globPatterns:['**/*.{js,css,html,svg,png,jpg,webmanifest}'],maximumFileSizeToCacheInBytes:4*1024*1024,
   navigateFallback:'/index.html',navigateFallbackDenylist:[/^\/api\//],
   runtimeCaching:[
    week('visto-data','StaleWhileRevalidate',/\/(snapshot|films|cinemas|catalog|history|quality)\.json$/),
    week('visto-api','NetworkFirst',/\/api\//,{networkTimeoutSeconds:4,expiration:{maxEntries:60,maxAgeSeconds:7*86400},cacheableResponse:{statuses:[200]}}),
    week('tmdb-images','StaleWhileRevalidate',/^https:\/\/image\.tmdb\.org\//,{expiration:{maxEntries:250,maxAgeSeconds:30*86400},cacheableResponse:{statuses:[0,200]}}),
    week('google-fonts-css','StaleWhileRevalidate',/^https:\/\/fonts\.googleapis\.com\//),
    week('google-fonts-files','StaleWhileRevalidate',/^https:\/\/fonts\.gstatic\.com\//,{expiration:{maxEntries:20,maxAgeSeconds:365*86400},cacheableResponse:{statuses:[0,200]}}),
   ],
  },
 })],
 server:{port:5173,strictPort:true,proxy:api},
 preview:{port:4173,proxy:api},
});
