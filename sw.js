const CACHE = 'ibeline-v5-butter-blue-pink';
const ASSETS = ['./', './index.html', './styles.css', './styles.css?v=butter-blue-pink-1', './app.js', './app.js?v=butter-blue-pink-1', './planner.js', './notifications.js', './push-config.js', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ibeline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Network first: use the current app online, fall back to saved assets offline.
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
});
self.addEventListener('push',event=>{
  // Every delivered push is visible, as required by Safari's permission policy.
  let payload={};try{payload=event.data?.json()||{};}catch{}
  const scope=new URL(self.registration.scope);
  const requested=new URL(payload.url||'./',scope);
  const url=requested.origin===scope.origin&&requested.pathname.startsWith(scope.pathname)?requested.href:scope.href;
  if(/^ibeline-\d{4}-\d{2}-\d{2}$/.test(payload.tag||'')) {
    const target=new URL(url);target.searchParams.set('workout',payload.tag.slice(8));payload.url=target.href;
  } else payload.url=url;
  event.waitUntil(self.registration.showNotification(payload.title||'Litt tid til deg 💗',{
    body:payload.body||'En liten påminnelse fra treningsappen.',icon:new URL('./icon-192.png',scope).href,badge:new URL('./icon-192.png',scope).href,tag:payload.tag||'ibeline-reminder',data:{url:payload.url}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const scope=new URL(self.registration.scope),requested=new URL(event.notification.data?.url||'./',scope);
  const url=requested.origin===scope.origin&&requested.pathname.startsWith(scope.pathname)?requested.href:scope.href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const existing=clients.find(c=>c.url.startsWith(scope.href));
    if(existing){await existing.navigate(url);return existing.focus();}
    return self.clients.openWindow(url);
  }));
});
