/*
 * Privacy-melding.
 *
 * Geen toestemmingsbanner: de site slaat alleen op wat nodig is om te
 * werken (login, thema-keuze), en daar hoeft niemand toestemming voor te
 * geven. Wel vertellen we eenmalig wat er gebeurt, met een link naar de
 * privacypagina. "Oké" onthoudt dat, zodat je hem maar één keer ziet.
 */

const SLEUTEL = "mcg-melding-gezien";

function alGezien() {
  try {
    return localStorage.getItem(SLEUTEL) === "1";
  } catch {
    // Opslag geblokkeerd: dan kunnen we "gezien" niet onthouden, en zou de
    // melding op elke pagina terugkomen. Liever helemaal niet tonen.
    return true;
  }
}

function toon() {
  if (alGezien()) return;
  if (location.pathname.endsWith("/privacy.html")) return;   // je leest hem al
  if (document.querySelector(".privacy-melding")) return;

  const el = document.createElement("aside");
  el.className = "privacy-melding";
  el.setAttribute("aria-label", "Privacy");
  el.innerHTML = `
    <p><strong>Geen tracking.</strong> Deze site bewaart alleen wat nodig is
      om te werken, zoals je login en je keuze voor licht of donker.</p>
    <div class="privacy-melding-acties">
      <a href="/privacy.html">Wat we opslaan</a>
      <button type="button" class="btn btn-primary btn-sm">Oké</button>
    </div>`;
  document.body.appendChild(el);

  // Twee frames wachten, anders ziet de browser de beginstand niet en
  // springt de melding in beeld in plaats van dat hij binnenschuift.
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-zichtbaar")));

  el.querySelector("button").addEventListener("click", () => {
    try { localStorage.setItem(SLEUTEL, "1"); } catch {}
    el.classList.remove("is-zichtbaar");
    let weg = false;
    const opruimen = () => { if (!weg) { weg = true; el.remove(); } };
    el.addEventListener("transitionend", opruimen, { once: true });
    setTimeout(opruimen, 700);
  });
}

// Niet tegelijk met het intro: pas als dat weg is, en dan nog even wachten
// zodat de pagina eerst rustig kan binnenkomen.
if (window.__mcgLoader && !window.__mcgReady) {
  document.addEventListener("mcg:ready", () => setTimeout(toon, 900), { once: true });
} else {
  setTimeout(toon, 900);
}
