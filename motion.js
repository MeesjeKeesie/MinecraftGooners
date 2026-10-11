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

function setupNavSheet() {
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
   Onthullen bij scrollen
   ===================================================================== */

function setupReveal() {
  if (reduceMotion.matches) return;
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    "main > section, .rule-card, .news-card, .request-card, .card"
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
  setupReveal();
})();
