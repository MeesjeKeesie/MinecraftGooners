/**
 * Haalt de nieuwste release van GitHub op, zodat de downloadknoppen en de
 * versienummers vanzelf meegaan met elke nieuwe uitgave.
 *
 * Werkt het niet — GitHub plat, geen internet, of het uurlimiet bereikt —
 * dan blijven de knoppen gewoon naar de releases-pagina wijzen. De pagina is
 * dus nooit stuk, alleen minder specifiek.
 */

const REPO = "MeesjeKeesie/MinecraftGooners";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" });

function formatSize(bytes) {
  if (!bytes) return null;
  return Math.round(bytes / 1024 / 1024) + " MB";
}

/**
 * Werkt één downloadknop bij met het juiste bestand uit de release.
 *
 * De bestandsnaam staat hier bewust niet hard ingevuld — we zoeken op
 * extensie, zodat je je installer kunt hernoemen zonder deze code aan te
 * raken.
 */
function updateDownload({ buttonId, metaId, extension, label, requirement, release }) {
  const button = document.getElementById(buttonId);
  const meta = document.getElementById(metaId);
  if (!button) return;

  const asset = (release.assets ?? []).find((item) =>
    item.name.toLowerCase().endsWith(extension)
  );

  if (asset) {
    button.href = asset.browser_download_url;
    button.textContent = label;
    button.setAttribute("download", "");
  }

  if (!meta) return;

  const parts = [];
  if (release.tag_name) parts.push("Versie " + release.tag_name.replace(/^v/, ""));
  if (release.published_at) parts.push(dateFormatter.format(new Date(release.published_at)));

  const size = formatSize(asset?.size);
  if (size) parts.push(size);
  parts.push(requirement);

  meta.textContent = parts.join(" \u00B7 ");
}

async function loadLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) return;

  const release = await response.json();

  updateDownload({
    buttonId: "download-btn",
    metaId: "download-meta",
    extension: ".exe",
    label: "Download voor Windows",
    requirement: "Windows 10 of nieuwer",
    release,
  });

  // Bestaat er nog geen APK in de release? Dan laat updateDownload de knop
  // ongemoeid en blijft hij naar de releases-pagina wijzen.
  updateDownload({
    buttonId: "download-apk",
    metaId: "download-apk-meta",
    extension: ".apk",
    label: "Download voor Android",
    requirement: "Android 8 of nieuwer",
    release,
  });
}

loadLatestRelease().catch(() => {
  // Stil laten mislukken: de standaardtekst in de HTML blijft dan staan.
});
