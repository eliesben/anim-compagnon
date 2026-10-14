/* Anim Compagnon — mode hors-ligne
   Change le numéro de VERSION à chaque fois que tu modifies CE fichier. */
const VERSION = "v2";
const APP = "anim-app-" + VERSION;      // l'app elle-même (page, logo, images)
const DATA = "anim-data";               // dernières données reçues du Worker
const API = "anim-compagnon-api.eliesbendjedou30.workers.dev";
const BASE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./images/logo.png", "./images/activites.jpg", "./images/publics.jpg", "./images/ressources.jpg",
  "./images/role-anim.jpg", "./images/vie-quotidienne.jpg", "./images/boite-a-outils.jpg", "./images/generateur.png"
];

// Installation : on met de côté l'essentiel (un fichier manquant ne bloque pas le reste)
self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

// Activation : on supprime les anciennes versions
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("anim-app-") && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (avec un délai max), sinon la dernière copie gardée
async function reseauDabord(req, cacheName, delai) {
  const cache = await caches.open(cacheName);
  try {
    const rep = await Promise.race([fetch(req), new Promise((_, ko) => setTimeout(() => ko(new Error("lent")), delai))]);
    if (rep && rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch (err) {
    const copie = await cache.match(req, { ignoreVary: true });
    if (copie) return copie;
    throw err;
  }
}
// Copie gardée d'abord, mise à jour en arrière-plan
async function copieDabord(req, cacheName) {
  const cache = await caches.open(cacheName);
  const copie = await cache.match(req);
  const maj = fetch(req).then(rep => { if (rep && (rep.ok || rep.type === "opaque")) cache.put(req, rep.clone()); return rep; }).catch(() => null);
  return copie || (await maj) || Response.error();
}

async function alleger(nom, max) {
  const cache = await caches.open(nom), cles = await cache.keys();
  for (let i = 0; i < cles.length - max; i++) await cache.delete(cles[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;                                   // envois (IA, équipe…) : jamais en cache
  if (url.hostname === API) {                                         // activités, catégories, ressources, équipe
    e.respondWith(reseauDabord(req, DATA, 6000));
    return;
  }
  if (req.mode === "navigate") {                                      // ouverture de l'app
    e.respondWith(reseauDabord(req, APP, 5000).catch(async () => (await caches.match("./index.html", { ignoreSearch: true })) || (await caches.match("./", { ignoreSearch: true })) || Response.error()));
    return;
  }
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    e.respondWith(copieDabord(req, APP));                             // logo, images de l'app, polices, outils
    return;
  }
  if (req.destination === "image") {                                  // images des activités (200 max)
    const rep = copieDabord(req, "anim-img");
    e.respondWith(rep);
    e.waitUntil(rep.then(() => alleger("anim-img", 200)));
  }
});

// =========================================================
// 🔔 Notifications : reçues même quand l'appli est fermée
// =========================================================
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  const titre = d.title || "Anim Compagnon";
  e.waitUntil(self.registration.showNotification(titre, {
    body: d.body || "",
    icon: "images/icon-192.png",
    badge: "images/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "./" }
  }));
});

// Toucher la notification : ouvre l'appli au bon endroit
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const cible = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope);
  const go = cible.searchParams.get("go");
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of fenetres) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if (go) c.postMessage({ go });
        return;
      }
    }
    await self.clients.openWindow(cible.href);
  })());
});
