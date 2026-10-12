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

    const sluit = document.createElement("button");
    sluit.type = "button";
    sluit.className = "nav-sheet-close";
    sluit.setAttribute("aria-label", "Menu sluiten");
    sluit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16M20 4 4 20"/></svg>';
    sheet.appendChild(sluit);

    // Dezelfde links, dezelfde volgorde, dezelfde actieve pagina.
    links.querySelectorAll("a").forEach((link) => {
      const kopie = document.createElement("a");
      kopie.href = link.getAttribute("href");
      kopie.textContent = link.textContent.trim();
      if (link.hasAttribute("aria-current")) kopie.setAttribute("aria-current", "page");
      kopie.style.setProperty("--i", sheet.querySelectorAll("a").length);
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
    sheet.classList.add("is-open");
    window.__lenis?.stop();
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
    sheet.classList.remove("is-open");
    window.__lenis?.start();
    springTo(sheet, width(), { velocity, bounce: 0, duration: 0.3 });
    fade(scrim, 0, 0.25);
  }

  toggle.addEventListener("click", () => (open ? closeSheet() : openSheet()));
  sheet.querySelector(".nav-sheet-close")?.addEventListener("click", () => {
    closeSheet();
    toggle.focus();
  });
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
  const SELECTOR = ".btn, .tab-btn, .copy-btn, .theme-toggle, .nav-toggle, .nav-sheet a, .nav-sheet-close, .link-row, .scroller-btn, .timeline-dot";

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
      if (window.__lenis) {
        window.__lenis.scrollTo(kaart, { offset: -navOffset() });
        return;
      }
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

  const targets = [...document.querySelectorAll(
    "main > section, .scroller-track .rule-card, .timeline-body .news-card, .card"
  )].filter((el) =>
    // Wat zelf al een data-reveal heeft (of bevat), regelt dat zelf.
    !el.matches(".hero-stage, [data-reveal]") &&
    !el.querySelector("[data-reveal]") &&
    !el.closest("[data-reveal]")
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


/* =====================================================================
   Hulpjes
   ===================================================================== */

/** Hoe ver je onder de navigatiebalk moet uitkomen. */
function navOffset() {
  return (document.querySelector(".nav")?.offsetHeight || 72) + 24;
}

/**
 * Wacht op het intro-scherm. Staat er geen intro op de pagina, of is het
 * al klaar, dan meteen.
 */
function whenReady(cb) {
  if (!window.__mcgLoader || window.__mcgReady) cb();
  else document.addEventListener("mcg:ready", cb, { once: true });
}

/* =====================================================================
   Onthullen met data-reveal
   ===================================================================== */

/** Splitst op <br> in losse regels, elk in een eigen uitsparing. */
function splitLines(el) {
  const delen = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = delen
    .map((html, i) =>
      `<span class="line"><span class="line-inner" style="--i:${i}">${html.trim()}</span></span>`)
    .join("");
}

/**
 * Zet elk woord in een eigen span, maar laat elementen ertussen (zoals
 * <span class="muted">) intact. Spaties blijven gewone tekst, zodat de
 * regels net zo afbreken als zonder animatie.
 */
function splitWords(el) {
  let i = 0;
  const loop = (node) => {
    [...node.childNodes].forEach((kind) => {
      if (kind.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        kind.textContent.split(/(\s+)/).forEach((stuk) => {
          if (!stuk) return;
          if (/^\s+$/.test(stuk)) {
            frag.appendChild(document.createTextNode(stuk));
          } else {
            const w = document.createElement("span");
            w.className = "word";
            w.style.setProperty("--i", i++);
            w.textContent = stuk;
            frag.appendChild(w);
          }
        });
        kind.replaceWith(frag);
      } else if (kind.nodeType === Node.ELEMENT_NODE) {
        loop(kind);
      }
    });
  };
  loop(el);
}

function setupDataReveal() {
  const els = [...document.querySelectorAll("[data-reveal]")];
  if (!els.length) return;

  els.forEach((el) => {
    let vertraging = parseInt(el.dataset.delay || "0", 10);

    // Kinderen van een data-stagger-ouder komen na elkaar.
    const groep = el.parentElement?.closest("[data-stagger]");
    if (groep) {
      const broers = [...groep.querySelectorAll("[data-reveal]")]
        .filter((x) => x.parentElement.closest("[data-stagger]") === groep);
      vertraging += broers.indexOf(el) * parseInt(groep.dataset.stagger, 10);
    }
    el.style.setProperty("--d", vertraging + "ms");

    if (el.dataset.reveal === "lines") {
      splitLines(el);
      if (el.dataset.lineStagger) el.style.setProperty("--stagger", el.dataset.lineStagger + "ms");
      el.classList.add("is-split");
    } else if (el.dataset.reveal === "words") {
      splitWords(el);
      el.classList.add("is-split");
    }
  });

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      if (el.dataset.gate === "ready") whenReady(() => el.classList.add("is-revealed"));
      else el.classList.add("is-revealed");
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });

  els.forEach((el) => io.observe(el));
}

/* =====================================================================
   Tellen tijdens het scrollen
   0 wanneer de bovenkant onderin beeld komt, het eindgetal wanneer het
   midden het midden van het scherm bereikt. Scroll je terug, dan telt hij
   terug — het getal hangt aan je scrollpositie, niet aan een klok.
   ===================================================================== */

function setupCountUp() {
  const els = [...document.querySelectorAll("[data-count]")];
  if (!els.length) return;

  const zet = (el, p) => {
    const doel = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    el.textContent = (p * doel).toFixed(dec);
  };

  if (reduceMotion.matches) { els.forEach((el) => zet(el, 1)); return; }

  let bezig = false;
  function werkbij() {
    bezig = false;
    const vh = window.innerHeight;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = (vh - r.top) / (vh / 2 + r.height / 2);
      zet(el, Math.max(0, Math.min(1, p)));
    });
  }
  const opScroll = () => {
    if (bezig) return;
    bezig = true;
    requestAnimationFrame(werkbij);
  };
  window.addEventListener("scroll", opScroll, { passive: true });
  window.addEventListener("resize", opScroll, { passive: true });
  werkbij();
}

/* =====================================================================
   Vloeiend scrollen (Lenis)
   Alleen met muis en trackpad. Op een touchscherm is het eigen afremmen
   van het systeem beter dan alles wat wij kunnen nabootsen, en met
   minder-beweging aan blijft scrollen gewoon scrollen.
   ===================================================================== */

async function setupLenis() {
  if (reduceMotion.matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let Lenis;
  try {
    ({ default: Lenis } = await import("https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.mjs"));
  } catch {
    return;   // gewoon scrollen dan
  }

  // Dingen die zelf verticaal scrollen houden hun eigen gedrag.
  document.querySelectorAll(".nav-sheet, .timeline-rail, .console-output, textarea")
    .forEach((el) => el.setAttribute("data-lenis-prevent", ""));

  const lenis = new Lenis({ smoothWheel: true });
  window.__lenis = lenis;

  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  if (document.documentElement.classList.contains("is-loading") ||
      document.querySelector(".nav-sheet.is-open")) {
    lenis.stop();
  }
  document.addEventListener("mcg:ready", () => lenis.start());

  // Ankerlinks via Lenis, zodat ze dezelfde vaart hebben als scrollen.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const doel = document.querySelector(id);
    if (!doel) return;
    e.preventDefault();
    lenis.scrollTo(doel, { offset: -navOffset() });
  });
}

/* =====================================================================
   Hero: "delven"
   ---------------------------------------------------------------------
   Waar je met de muis overheen gaat, kom je onder het oppervlak uit: een
   laag blokken met erts erin. Dezelfde techniek als de "liquid reveal" uit
   de ontwerpprompt — een zachte kwast die een tweede laag tevoorschijn
   haalt en langzaam weer dichtgroeit — maar in plaats van een foto
   graaf je hier door steen.
   ===================================================================== */

function setupHeroReveal() {
  const host = document.querySelector("[data-ore-reveal]");
  if (!host) return;
  if (reduceMotion.matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const KWAST = 140;        // straal in CSS-pixels
  const VERVAL = 0.016;     // hoe snel het spoor per frame dichtgroeit
  const STIL = 120;         // frames zonder beweging, dan helemaal schoon

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const dek = document.createElement("canvas");    // de blokkenlaag
  const dctx = dek.getContext("2d");
  const kwast = document.createElement("canvas");  // één afdruk van de kwast
  const kctx = kwast.getContext("2d");

  let dpr = 1, straal = KWAST, diam = KWAST * 2;
  let punten = [], vorige = null, stil = STIL + 1, loopt = false;

  // Vaste reeks: hetzelfde patroon na elke herschaling.
  function reeks(zaad) {
    return () => {
      zaad |= 0; zaad = (zaad + 0x6d2b79f5) | 0;
      let t = Math.imul(zaad ^ (zaad >>> 15), 1 | zaad);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const kleur = (naam) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim();

  function tekenBlokken() {
    const W = dek.width, H = dek.height;
    const blok = Math.round(16 * dpr), pix = blok / 4;
    const r = reeks(1337);
    const licht = document.documentElement.dataset.scheme === "light";
    const steen = licht ? [210, 215, 221] : [46, 51, 58];
    const variatie = licht ? 18 : 16;
    const erts = [kleur("--gold"), kleur("--emerald"), kleur("--lapis"), kleur("--rust")];
    const naad = Math.max(1, Math.round(dpr));

    for (let by = 0; by < H; by += blok) {
      for (let bx = 0; bx < W; bx += blok) {
        const tint = (r() - 0.5) * variatie * 0.8;
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const j = tint + (r() - 0.5) * variatie;
            dctx.fillStyle = `rgb(${steen[0] + j | 0},${steen[1] + j | 0},${steen[2] + j | 0})`;
            dctx.fillRect(bx + x * pix, by + y * pix, Math.ceil(pix), Math.ceil(pix));
          }
        }
        if (r() < 0.11) {
          const k = r();
          dctx.fillStyle = erts[k < 0.45 ? 0 : k < 0.7 ? 1 : k < 0.88 ? 2 : 3];
          const n = 3 + ((r() * 4) | 0);
          for (let i = 0; i < n; i++) {
            dctx.fillRect(bx + ((r() * 4) | 0) * pix, by + ((r() * 4) | 0) * pix, Math.ceil(pix), Math.ceil(pix));
          }
        }
        dctx.fillStyle = licht ? "rgba(0,0,0,.07)" : "rgba(0,0,0,.25)";
        dctx.fillRect(bx, by + blok - naad, blok, naad);
        dctx.fillRect(bx + blok - naad, by, naad, blok);
      }
    }
  }

  function meet() {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    straal = KWAST * dpr;
    diam = Math.ceil(straal * 2);
    canvas.width = dek.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = dek.height = Math.max(1, Math.round(rect.height * dpr));
    kwast.width = kwast.height = diam;
    tekenBlokken();
  }

  function stempel(x, y) {
    const c = straal;
    kctx.globalCompositeOperation = "source-over";
    kctx.clearRect(0, 0, diam, diam);
    const g = kctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,.82)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    kctx.fillStyle = g;
    kctx.fillRect(0, 0, diam, diam);
    // Alleen de blokken onder de zachte kwast overhouden.
    kctx.globalCompositeOperation = "source-in";
    kctx.drawImage(dek, x - c, y - c, diam, diam, 0, 0, diam, diam);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(kwast, x - c, y - c);
  }

  function frame() {
    const tekent = punten.length > 0;
    stil = tekent ? 0 : stil + 1;

    if (stil > STIL) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);   // geen restjes
      loopt = false;
      return;
    }

    // Het bestaande spoor groeit dicht; sneller naarmate je langer stilstaat.
    const dicht = tekent ? VERVAL : Math.min(VERVAL + stil * 0.004, 0.5);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${dicht})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (tekent) {
      punten.forEach(([x, y]) => stempel(x, y));
      punten = [];
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;

    if (x < -straal || y < -straal || x > canvas.width + straal || y > canvas.height + straal) {
      vorige = null;
      return;
    }

    // Tussenpunten, zodat een snelle beweging een doorlopend spoor geeft.
    if (vorige) {
      const dx = x - vorige[0], dy = y - vorige[1];
      const stap = Math.max(straal * 0.3, 1);
      const n = Math.min(Math.ceil(Math.hypot(dx, dy) / stap), 60);
      for (let i = 1; i <= n; i++) punten.push([vorige[0] + (dx * i) / n, vorige[1] + (dy * i) / n]);
    } else {
      punten.push([x, y]);
    }
    vorige = [x, y];

    if (!loopt) { loopt = true; requestAnimationFrame(frame); }
  }, { passive: true });

  new ResizeObserver(meet).observe(host);
  // Licht/donker of kerst omgezet: het steen moet mee van kleur.
  new MutationObserver(() => dek.width && tekenBlokken())
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme", "data-theme"] });
}

/* =====================================================================
   Start
   Alles wat geen veren-library nodig heeft gaat meteen; de library wordt
   daarna geladen en neemt het over waar hij beter is. Zo hoeft een
   trage CDN de pagina nooit op te houden.
   ===================================================================== */

(async () => {
  document.documentElement.classList.add("motion-ready");
  setupNavEdge();
  setupNavSheet();
  setupPressFeedback();
  setupTabs();
  setupScrollers();
  setupTimeline();
  setupReveal();
  setupDataReveal();
  setupCountUp();
  setupHeroReveal();
  setupLenis();
  await loadMotion();
})();
