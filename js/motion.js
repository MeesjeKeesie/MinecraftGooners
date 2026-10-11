/*
 * Bewegingslaag.
 *
 * Twee regels waar alles hier op neerkomt:
 *
 *   1. Beweging die je met je vinger aanstuurt volgt je vinger 1:1, en
 *      mag op elk moment onderbroken en omgedraaid worden. Daarom veren
 *      en geen CSS-overgangen: een veer begint altijd bij de stand waar
 *      het ding nu stáát, niet bij waar hij heen wilde.
 *
 *   2. Loslaten is geen naad. De veer neemt de snelheid van je vinger
 *      over, zodat slepen en animeren in elkaar overlopen.
 *
 * De library wordt dynamisch geladen. Lukt dat niet, dan valt alles terug
 * op gewone overgangen — het menu blijft dus werken zonder internet naar
 * de CDN.
 */

const SHEET_WIDTH_FALLBACK = 320;

let animate = null;      // uit de library, als die laadt
let springAvailable = false;

async function loadMotion() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm");
    animate = mod.animate;
    springAvailable = typeof animate === "function";
  } catch {
    springAvailable = false;
  }
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* =====================================================================
   Veer-hulpjes
   ===================================================================== */

/**
 * Zet een element op een x-positie.
 *
 * bounce 0 = kritisch gedempt: komt netjes tot stilstand zonder door te
 * schieten. Dat is de standaard voor gewone interface-beweging.
 * Doorveren bewaren we voor momenten waar een worp aan vooraf ging.
 */
function springTo(el, x, { velocity = 0, bounce = 0, duration = 0.4 } = {}) {
  if (reduceMotion.matches || !springAvailable) {
    el.style.transition = "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = `translate3d(${x}px, 0, 0)`;
    return;
  }
  el.style.transition = "";
  animate(el, { x }, { type: "spring", bounce, duration, velocity });
}

function fade(el, opacity, duration = 0.3) {
  if (reduceMotion.matches || !springAvailable) {
    el.style.transition = "opacity 0.16s linear";
    el.style.opacity = String(opacity);
    return;
  }
  el.style.transition = "";
  animate(el, { opacity }, { duration, easing: [0.22, 1, 0.36, 1] });
}

/** Leest de stand die nu ECHT op het scherm staat, niet de bedoelde stand. */
function currentX(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  const m = new DOMMatrixReadOnly(t);
  return m.m41;
}

/**
 * Waar zou dit tot stilstand komen als je het nu loslaat? Dezelfde
 * formule die scrollen gebruikt om af te remmen — zo voelt een zwiep
 * als een worp en niet als een sprongetje naar de dichtstbijzijnde rand.
 */
function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/* =====================================================================
   Schuifmenu
   ===================================================================== */

/**
 * Bouwt de hamburger, het verduisterende vlak en het schuifmenu, tenzij
 * ze al in de HTML staan.
 *
 * Dit hoort hier en niet in elk HTML-bestand: onder 860px verbergt de
 * stylesheet de gewone links, dus zonder dit zou een pagina zonder
 * hamburger op een telefoon helemaal geen navigatie meer hebben.
 */
function buildNavChrome() {
  const nav = document.querySelector(".nav");
  const inner = document.querySelector(".nav-inner");
  const links = document.querySelector(".nav-links");
  if (!nav || !inner || !links) return;

  let toggle = document.querySelector(".nav-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Menu openen");
    toggle.setAttribute("aria-controls", "nav-sheet");
    toggle.appendChild(document.createElement("span"));
    inner.appendChild(toggle);
  }

  let scrim = document.querySelector(".nav-scrim");
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.className = "nav-scrim";
    document.body.appendChild(scrim);
  }

  let sheet = document.querySelector(".nav-sheet");
  if (!sheet) {
    sheet = document.createElement("aside");
    sheet.className = "nav-sheet";
    sheet.id = "nav-sheet";
    sheet.setAttribute("aria-label", "Menu");

    const handle = document.createElement("div");
    handle.className = "nav-sheet-handle";
    handle.setAttribute("aria-hidden", "true");
    sheet.appendChild(handle);

    const kop = document.createElement("span");
    kop.className = "eyebrow";
    kop.textContent = "Navigatie";
    sheet.appendChild(kop);

    // Dezelfde links, dezelfde volgorde, dezelfde actieve pagina.
    links.querySelectorAll("a").forEach((link) => {
      const kopie = document.createElement("a");
      kopie.href = link.getAttribute("href");
      kopie.textContent = link.textContent.trim();
      if (link.hasAttribute("aria-current")) kopie.setAttribute("aria-current", "page");
      sheet.appendChild(kopie);
    });

    document.body.appendChild(sheet);
  }
}

function setupNavSheet() {
  buildNavChrome();

  const sheet = document.querySelector(".nav-sheet");
  const scrim = document.querySelector(".nav-scrim");
  const toggle = document.querySelector(".nav-toggle");
  if (!sheet || !scrim || !toggle) return;

  let open = false;
  const width = () => sheet.offsetWidth || SHEET_WIDTH_FALLBACK;

  function openSheet(velocity = 0) {
    open = true;
    sheet.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    scrim.classList.add("is-visible");
    document.body.style.overflow = "hidden";
    springTo(sheet, 0, { velocity, bounce: velocity ? 0.12 : 0, duration: 0.35 });
    fade(scrim, 1, 0.25);

    const first = sheet.querySelector("a");
    if (first) first.focus({ preventScroll: true });
  }

  function closeSheet(velocity = 0) {
    open = false;
    sheet.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    scrim.classList.remove("is-visible");
    document.body.style.overflow = "";
    springTo(sheet, width(), { velocity, bounce: 0, duration: 0.3 });
    fade(scrim, 0, 0.25);
  }

  toggle.addEventListener("click", () => (open ? closeSheet() : openSheet()));
  scrim.addEventListener("click", () => closeSheet());

  // Nooit opsluiten: Escape sluit altijd.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      closeSheet();
      toggle.focus();
    }
  });

  // Klikken op een link sluit het paneel, zodat je de pagina ziet laden.
  sheet.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => closeSheet())
  );

  /* ---------- wegslepen ---------- */

  let dragging = false;
  let startX = 0;
  let startOffset = 0;
  let history = [];   // laatste punten, voor de snelheid bij loslaten

  sheet.addEventListener("pointerdown", (e) => {
    if (!open || e.pointerType === "mouse") return;

    dragging = true;
    startX = e.clientX;
    // Beginnen bij waar hij NU staat. Grijp je hem halverwege een
    // animatie, dan springt hij daardoor niet.
    startOffset = currentX(sheet);
    history = [{ x: e.clientX, t: performance.now() }];
    sheet.setPointerCapture(e.pointerId);
    sheet.style.transition = "";
  });

  sheet.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    let delta = e.clientX - startX;
    let next = startOffset + delta;

    // Naar links voorbij de rand: steeds meer weerstand in plaats van
    // een harde muur. Een hard einde leest als "vastgelopen".
    if (next < 0) {
      const over = -next;
      const w = width();
      next = -((over * w * 0.55) / (w + 0.55 * over));
    }

    sheet.style.transform = `translate3d(${next}px, 0, 0)`;
    scrim.style.opacity = String(Math.max(0, 1 - next / width()));

    history.push({ x: e.clientX, t: performance.now() });
    if (history.length > 6) history.shift();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;

    const now = performance.now();
    const recent = history.filter((p) => now - p.t < 120);
    const first = recent[0] ?? history[0];
    const dt = Math.max(now - first.t, 1);
    const velocity = ((e.clientX - first.x) / dt) * 1000;   // px/s

    const at = currentX(sheet);
    // Waar hij heen zou glijden, niet waar hij losgelaten werd.
    const projected = at + project(velocity);

    if (projected > width() / 2) {
      closeSheet(velocity);
    } else {
      openSheet(velocity);
    }
  }

  sheet.addEventListener("pointerup", endDrag);
  sheet.addEventListener("pointercancel", endDrag);

  // Beginstand: dicht, zonder animatie.
  sheet.style.transform = `translate3d(${width()}px, 0, 0)`;
  sheet.setAttribute("aria-hidden", "true");
  toggle.setAttribute("aria-expanded", "false");
}

/* =====================================================================
   Drukreactie
   Oplichten op het moment dat je indrukt, niet bij het loslaten. Dat is
   het verschil tussen een interface die leeft en eentje die dood aanvoelt.
   ===================================================================== */

function setupPressFeedback() {
  const SELECTOR = ".btn, .tab-btn, .copy-btn, .theme-toggle, .nav-toggle, .nav-sheet a";

  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(SELECTOR);
    if (el && !el.disabled) el.classList.add("is-pressed");
  }, { passive: true });

  const los = (e) => {
    const el = e.target.closest ? e.target.closest(SELECTOR) : null;
    if (el) el.classList.remove("is-pressed");
    // Ook alles opruimen waar de vinger ondertussen vanaf gegleden is.
    document.querySelectorAll(".is-pressed").forEach((n) => n.classList.remove("is-pressed"));
  };
  document.addEventListener("pointerup", los, { passive: true });
  document.addEventListener("pointercancel", los, { passive: true });
}

/* =====================================================================
   Tabbladen: het bolletje schuift mee
   ===================================================================== */

function setupTabs() {
  document.querySelectorAll(".tabs").forEach((tabs) => {
    const knoppen = [...tabs.querySelectorAll(".tab-btn")];
    if (knoppen.length < 2) return;

    const pil = document.createElement("span");
    pil.className = "tab-pill";
    pil.setAttribute("aria-hidden", "true");
    tabs.prepend(pil);

    function verplaats(animeren = true) {
      const actief = tabs.querySelector(".tab-btn.is-active") || knoppen[0];
      const doel = actief.offsetLeft;
      pil.style.width = actief.offsetWidth + "px";
      pil.style.height = actief.offsetHeight + "px";
      pil.style.top = actief.offsetTop + "px";

      if (!animeren || reduceMotion.matches || !springAvailable) {
        pil.style.transform = `translate3d(${doel}px, 0, 0)`;
        return;
      }
      // Kritisch gedempt: het bolletje glijdt, het stuitert niet.
      animate(pil, { x: doel }, { type: "spring", bounce: 0, duration: 0.35 });
    }

    verplaats(false);
    tabs.addEventListener("click", () => requestAnimationFrame(() => verplaats(true)));
    window.addEventListener("resize", () => verplaats(false), { passive: true });

    // De tabbladen worden soms pas gevuld nadat de pagina geladen is.
    new MutationObserver(() => verplaats(false)).observe(tabs, {
      attributes: true, subtree: true, attributeFilter: ["class"],
    });
  });
}

/* =====================================================================
   Rand onder de navigatiebalk
   Alleen een scheiding tonen wanneer er ook echt iets onderdoor schuift.
   ===================================================================== */

function setupNavEdge() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  let ticking = false;
  function check() {
    nav.classList.toggle("is-scrolled", window.scrollY > 4);
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(check);
    }
  }, { passive: true });
  check();
}

/* =====================================================================
   Carrousel
   ===================================================================== */

function setupScrollers() {
  document.querySelectorAll("[data-scroller]").forEach((scroller) => {
    const track = scroller.querySelector(".scroller-track");
    const vorige = scroller.querySelector("[data-scroll-prev]");
    const volgende = scroller.querySelector("[data-scroll-next]");
    if (!track) return;

    /** Eén kaart plus de tussenruimte. */
    function stap() {
      const kaart = track.firstElementChild;
      if (!kaart) return 300;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
      return kaart.getBoundingClientRect().width + gap;
    }

    function werkbij() {
      const max = track.scrollWidth - track.clientWidth;
      const begin = track.scrollLeft <= 2;
      const eind = track.scrollLeft >= max - 2;

      track.classList.toggle("at-start", begin);
      track.classList.toggle("at-end", eind);
      if (vorige) vorige.disabled = begin;
      if (volgende) volgende.disabled = eind;
    }

    function schuif(richting) {
      // scroll-behavior smooth laat de browser zelf afremmen; dat voelt
      // beter dan een eigen animatie die met het vegen kan vechten.
      track.scrollBy({
        left: richting * stap(),
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
    }

    vorige?.addEventListener("click", () => schuif(-1));
    volgende?.addEventListener("click", () => schuif(1));

    let bezig = false;
    track.addEventListener("scroll", () => {
      if (bezig) return;
      bezig = true;
      requestAnimationFrame(() => { werkbij(); bezig = false; });
    }, { passive: true });

    window.addEventListener("resize", werkbij, { passive: true });
    werkbij();

    /* Slepen met de muis. Op touch doet de browser dit al beter dan wij. */
    let sleept = false, startX = 0, startScroll = 0, verplaatst = 0;

    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      sleept = true;
      verplaatst = 0;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.style.cursor = "grabbing";
      track.style.scrollSnapType = "none";
    });

    track.addEventListener("pointermove", (e) => {
      if (!sleept) return;
      const delta = e.clientX - startX;
      verplaatst = Math.abs(delta);
      track.scrollLeft = startScroll - delta;
    });

    function loslaten() {
      if (!sleept) return;
      sleept = false;
      track.style.cursor = "";
      // Vastklikken weer aanzetten, zodat hij netjes op een kaart landt.
      track.style.scrollSnapType = "";
      werkbij();
    }
    track.addEventListener("pointerup", (e) => {
      // Een sleep van meer dan een paar pixels telt niet als klik.
      if (verplaatst > 5) e.preventDefault();
      loslaten();
    });
    track.addEventListener("pointerleave", loslaten);
    track.addEventListener("pointercancel", loslaten);
  });
}

/* =====================================================================
   Tijdlijn
   ===================================================================== */

function setupTimeline() {
  const rail = document.querySelector(".timeline-rail");
  const body = document.querySelector(".timeline-body");
  if (!rail || !body) return;

  const kaarten = [...body.querySelectorAll(".news-card")];
  if (!kaarten.length) return;

  // De punten worden hier gemaakt, uit de datums die al in de artikelen
  // staan. Zo kun je een nieuw bericht toevoegen zonder de rail bij te
  // werken.
  const punten = kaarten.map((kaart, i) => {
    if (!kaart.id) kaart.id = "bericht-" + (i + 1);

    const datum = kaart.querySelector(".news-date")?.textContent.trim() ?? "";
    const titel = kaart.querySelector("h2")?.textContent.trim() ?? "";

    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "timeline-dot";
    knop.textContent = datum;
    knop.title = titel;
    knop.setAttribute("aria-label", datum + " — " + titel);

    knop.addEventListener("click", () => {
      kaart.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start",
      });
    });

    rail.appendChild(knop);
    return knop;
  });

  function markeer(index) {
    punten.forEach((p, i) => p.classList.toggle("is-active", i === index));
    kaarten.forEach((k, i) => k.classList.toggle("is-current", i === index));

    // Op smalle schermen is de rail zelf een strook die kan scrollen;
    // het actieve punt moet in beeld blijven.
    const actief = punten[index];
    if (actief && rail.scrollWidth > rail.clientWidth) {
      actief.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  if ("IntersectionObserver" in window) {
    const zichtbaar = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => zichtbaar.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
        // Het bericht dat het meest in beeld staat, is waar je bent.
        let beste = 0, besteRatio = -1;
        kaarten.forEach((k, i) => {
          const r = zichtbaar.get(k) ?? 0;
          if (r > besteRatio) { besteRatio = r; beste = i; }
        });
        if (besteRatio > 0) markeer(beste);
      },
      { rootMargin: "-20% 0px -45% 0px", threshold: [0, 0.2, 0.5, 0.8, 1] }
    );
    kaarten.forEach((k) => io.observe(k));
  }

  markeer(0);
}

/* =====================================================================
   Onthullen bij scrollen
   ===================================================================== */

function setupReveal() {
  if (reduceMotion.matches) return;
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    "main > section, .scroller-track .rule-card, .timeline-body .news-card, .card"
  );
  if (!targets.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-shown");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  targets.forEach((el, i) => {
    el.classList.add("reveal");
    // Hele kleine trapsgewijze vertraging: genoeg om volgorde te
    // suggereren, te kort om op te wachten.
    el.style.transitionDelay = Math.min(i, 4) * 40 + "ms";
    io.observe(el);
  });
}

/* =====================================================================
   Start
   ===================================================================== */

(async () => {
  await loadMotion();
  setupNavEdge();
  setupNavSheet();
  setupPressFeedback();
  setupTabs();
  setupScrollers();
  setupTimeline();
  setupReveal();
})();
