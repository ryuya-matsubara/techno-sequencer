const CACHE = 'techno-sequencer-v8';
const ASSETS = [
  './','./index.html','./home-v2.css','./home-v2.js',
  './song-data.js','./studio.html','./studio.css','./studio.js','./studio-audio.js',
  './editor.html','./styles.css','./editor.css','./app.js','./editor.js',
  './home.css','./home.js','./manifest.webmanifest','./icon.jpeg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('techno-sequencer-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) {
      const clone=response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request,clone)).catch(console.warn);
    }
    return response;
  }).catch(async () => {
    const url=new URL(event.request.url);url.search='';
    return (await caches.match(event.request)) || (await caches.match(url.toString())) || (await caches.match('./index.html'));
  }));
});