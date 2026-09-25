/*
 * Thema's voor MinecraftGooners.
 *
 * Twee onafhankelijke assen, allebei als attribuut op <html>:
 *
 *   data-scheme = "light" | "dark"        -> keuze van de bezoeker
 *   data-theme  = "standaard" | "kerst"   -> keuze van de beheerder
 *
 * De bezoekerskeuze staat in localStorage; het sitethema komt uit Supabase
 * en wordt daar ook in bewaard, zodat de volgende pagina meteen goed staat
 * in plaats van na een halve seconde om te klappen.
 *
 * Let op: het eerste zetten gebeurt NIET hier maar in een klein script
 * bovenin de <head> van elke pagina. Dit bestand laadt te laat om een
 * flits van het verkeerde thema te voorkomen.
 */

const SCHEME_KEY = "mcg-scheme";   // "system" | "light" | "dark"
const THEME_KEY = "mcg-theme";     // "standaard" | "kerst"

const SCHEMES = ["system", "light", "dark"];

const SCHEME_ICON = { system: "🖥", light: "☀", dark: "🌙" };
const SCHEME_LABEL = {
  system: "Thema: systeem",
  light: "Thema: licht",
  dark: "Thema: donker",
};

// Kleur van de browserbalk op mobiel, per combinatie.
const BAR_COLOR = {
  "standaard-dark": "#14171b",
  "standaard-light": "#f4f5f7",
  "kerst-dark": "#121a16",
  "kerst-light": "#f7f4ef",
};

const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

/* ------------------------- lezen en schrijven ------------------------- */

function storedScheme() {
  const value = localStorage.getItem(SCHEME_KEY);
  return SCHEMES.includes(value) ? value : "system";
}

function storedTheme() {
  return localStorage.getItem(THEME_KEY) === "kerst" ? "kerst" : "standaard";
}

/** "system" vertalen naar wat het systeem op dit moment wil. */
function resolveScheme(scheme) {
  if (scheme === "light" || scheme === "dark") return scheme;
  return systemQuery.matches ? "dark" : "light";
}

/* ------------------------- toepassen ------------------------- */

function apply() {
  const scheme = resolveScheme(storedScheme());
  const theme = storedTheme();

  document.documentElement.setAttribute("data-scheme", scheme);
  document.documentElement.setAttribute("data-theme", theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BAR_COLOR[`${theme}-${scheme}`] ?? "#14171b");

  updateButton();
  updateSnow(theme);
}

/* ------------------------- knop in de navigatie ------------------------- */

let button = null;

function buildButton() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return;

  button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.addEventListener("click", () => {
    const next = SCHEMES[(SCHEMES.indexOf(storedScheme()) + 1) % SCHEMES.length];
    localStorage.setItem(SCHEME_KEY, next);
    apply();
  });

  navLinks.appendChild(button);
  updateButton();
}

function updateButton() {
  if (!button) return;
  const scheme = storedScheme();
  button.textContent = SCHEME_ICON[scheme];
  button.title = SCHEME_LABEL[scheme] + " — klik om te wisselen";
  button.setAttribute("aria-label", SCHEME_LABEL[scheme]);
}

/* ------------------------- sneeuw ------------------------- */

const FLAKES = "❄❅❆";
let snowLayer = null;

function updateSnow(theme) {
  const wantsSnow =
    theme === "kerst" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!wantsSnow) {
    if (snowLayer) {
      snowLayer.remove();
      snowLayer = null;
    }
    return;
  }

  if (snowLayer) return;

  snowLayer = document.createElement("div");
  snowLayer.className = "snow-layer";
  snowLayer.setAttribute("aria-hidden", "true");

  // Minder vlokken op een smal scherm — schilt scheelt accu op de telefoon.
  const count = window.innerWidth < 640 ? 18 : 40;

  for (let i = 0; i < count; i++) {
    const flake = document.createElement("span");
    flake.className = "snowflake";
    flake.textContent = FLAKES[Math.floor(Math.random() * FLAKES.length)];

    const size = 8 + Math.random() * 14;
    flake.style.left = Math.random() * 100 + "%";
    flake.style.fontSize = size + "px";
    flake.style.opacity = String(0.35 + Math.random() * 0.45);
    flake.style.animationDuration = 9 + Math.random() * 11 + "s";
    // Negatieve vertraging: dan valt er meteen sneeuw in plaats van dat je
    // eerst tien seconden naar een leeg scherm kijkt.
    flake.style.animationDelay = -Math.random() * 20 + "s";
    flake.style.setProperty("--drift", Math.round(-70 + Math.random() * 140) + "px");

    snowLayer.appendChild(flake);
  }

  document.body.appendChild(snowLayer);
}

/* ------------------------- sitethema ophalen ------------------------- */

async function refreshSiteTheme() {
  // Niet elke pagina laadt Supabase (app.html en nieuws.html bijvoorbeeld
  // niet). Daar blijft het bij wat er in localStorage staat, en dat is
  // prima — het thema verandert hooguit een paar keer per jaar.
  let client;
  try {
    ({ supabaseClient: client } = await import("./supabase-client.js"));
  } catch {
    return;
  }

  try {
    // site_theme is een weergave die de site zelf uitrekent: uit, aan, of
    // automatisch tussen twee datums. De browser rekent hier niets aan.
    const { data, error } = await client
      .from("site_theme")
      .select("theme")
      .single();

    if (error || !data) return;

    const theme = data.theme === "kerst" ? "kerst" : "standaard";
    if (theme !== storedTheme()) {
      localStorage.setItem(THEME_KEY, theme);
      apply();
    }
  } catch {
    // Geen verbinding — dan blijft het opgeslagen thema staan.
  }
}

/* ------------------------- start ------------------------- */

apply();
buildButton();

// Volgt het systeem mee zolang de bezoeker "systeem" heeft staan.
systemQuery.addEventListener("change", () => {
  if (storedScheme() === "system") apply();
});

refreshSiteTheme();
