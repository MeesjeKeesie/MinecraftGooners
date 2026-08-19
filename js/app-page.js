/*
 * Tabbladen op de app-pagina, plus het automatisch voorselecteren van
 * het apparaat waarop de bezoeker zit.
 */

const tabs = document.querySelectorAll(".tab-btn[data-panel]");
const panels = document.querySelectorAll(".tab-panel");

function toon(naam) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.panel === naam);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === "panel-" + naam);
  });

  // Zet het gekozen tabblad in de URL, zodat je iemand rechtstreeks
  // naar bijvoorbeeld app.html#android kunt sturen.
  history.replaceState(null, "", "#" + naam);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => toon(tab.dataset.panel));
});

/** Raadt het apparaat, zodat de juiste uitleg meteen openstaat. */
function raadPlatform() {
  const ua = navigator.userAgent;

  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";

  // iPads met recente iOS doen zich voor als een Mac. Onderscheid maken
  // kan door te kijken of het scherm aanraking ondersteunt.
  if (/Macintosh/i.test(ua)) {
    return navigator.maxTouchPoints > 1 ? "iphone" : "mac";
  }

  if (/Windows/i.test(ua)) return "windows";
  return "windows";
}

// Een tabblad in de URL wint van het raden.
const uitUrl = window.location.hash.replace("#", "");
const geldig = ["windows", "android", "mac", "iphone"];

toon(geldig.includes(uitUrl) ? uitUrl : raadPlatform());
