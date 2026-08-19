/*
 * Registreert de service worker en regelt de installatieknop.
 * Wordt op elke pagina geladen.
 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Staat er een nieuwe versie klaar? Meteen doorschakelen, zodat
      // gebruikers niet met een oude versie blijven zitten.
      registration.addEventListener("updatefound", () => {
        const nieuwe = registration.installing;
        if (!nieuwe) return;
        nieuwe.addEventListener("statechange", () => {
          if (nieuwe.state === "installed" && navigator.serviceWorker.controller) {
            nieuwe.postMessage("skip-waiting");
          }
        });
      });
    } catch (err) {
      console.warn("Service worker niet geregistreerd:", err);
    }
  });

  // Na het activeren van een nieuwe versie één keer verversen.
  let ververst = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (ververst) return;
    ververst = true;
    window.location.reload();
  });
}

/* ---------------- Installatieknop ---------------- */

let installPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  // Voorkom de standaardbalk van de browser; we tonen onze eigen knop.
  event.preventDefault();
  installPrompt = event;
  toonInstallKnop();
});

function toonInstallKnop() {
  const knop = document.getElementById("install-app");
  if (!knop) return;

  knop.style.display = "inline-flex";
  knop.addEventListener("click", async () => {
    if (!installPrompt) return;
    knop.disabled = true;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    knop.style.display = "none";
  });
}

// Al geïnstalleerd? Dan de knop verbergen.
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  const knop = document.getElementById("install-app");
  if (knop) knop.style.display = "none";
});
