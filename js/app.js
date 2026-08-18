/**
 * Haalt de nieuwste release van GitHub op, zodat de downloadknop en het
 * versienummer vanzelf meegaan met elke nieuwe uitgave.
 *
 * Werkt het niet — GitHub plat, geen internet, of het uurlimiet bereikt —
 * dan blijft de knop gewoon naar de releases-pagina wijzen. De pagina is
 * dus nooit stuk, alleen minder specifiek.
 */

const REPO = "MeesjeKeesie/MinecraftGooners";

const downloadBtn = document.getElementById("download-btn");
const downloadMeta = document.getElementById("download-meta");

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" });

function formatSize(bytes) {
  if (!bytes) return null;
  return Math.round(bytes / 1024 / 1024) + " MB";
}

async function loadLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) return;

  const release = await response.json();

  // Pak het eerste .exe-bestand dat aan de release hangt. Zo hoef je de
  // bestandsnaam hier niet bij te werken als je versienummer verandert.
  const installer = (release.assets ?? []).find((asset) =>
    asset.name.toLowerCase().endsWith(".exe")
  );

  if (installer) {
    downloadBtn.href = installer.browser_download_url;
    downloadBtn.textContent = "Download voor Windows";
    downloadBtn.setAttribute("download", "");
  }

  const parts = [];

  if (release.tag_name) parts.push("Versie " + release.tag_name.replace(/^v/, ""));
  if (release.published_at) parts.push(dateFormatter.format(new Date(release.published_at)));
  const size = formatSize(installer?.size);
  if (size) parts.push(size);
  parts.push("Windows 10 of nieuwer");

  downloadMeta.textContent = parts.join(" \u00B7 ");
}

loadLatestRelease().catch(() => {
  // Stil laten mislukken: de standaardtekst in de HTML blijft dan staan.
});
