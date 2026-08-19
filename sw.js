/*
 * MinecraftGooners — service worker
 *
 * Strategie: netwerk eerst, cache als vangnet.
 *
 * Waarom niet cache-eerst (wat sneller zou zijn)? Omdat deze site vaak
 * verandert en de hele functie van de app is om te laten zien wat de server
 * op dít moment doet. Verouderde bestanden serveren zou hier meer kwaad dan
 * goed doen — en zorgt voor het klassieke "waarom zie ik mijn wijziging niet".
 *
 * De cache is er dus puur voor als er geen verbinding is.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `mcgooners-${CACHE_VERSION}`;
const OFFLINE_PAGE = "/offline.html";

// Wordt bij installatie alvast opgehaald, zodat de app ook offline iets toont.
const PRECACHE = [
  "/",
  "/index.html",
  "/nieuws.html",
  "/aanmelden.html",
  "/beheer.html",
  "/account.html",
  "/css/style.css",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
  OFFLINE_PAGE,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Losse fouten mogen de installatie niet blokkeren, dus per bestand.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith("mcgooners-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Alleen gewone GET-verzoeken behandelen.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Alles van buitenaf met rust laten: Supabase, de fontserver en het
  // CDN regelen hun eigen caching, en Supabase-antwoorden mogen sowieso
  // nooit uit een cache komen.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Gelukte antwoorden bewaren als vangnet voor later.
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Geen verbinding en niets in de cache: toon de offline-pagina,
        // maar alleen als de gebruiker een pagina opvroeg.
        if (request.mode === "navigate") {
          const offline = await caches.match(OFFLINE_PAGE);
          if (offline) return offline;
        }
        return Response.error();
      })
  );
});

// Laat de pagina de wachtende versie meteen activeren (zie js/pwa.js).
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
