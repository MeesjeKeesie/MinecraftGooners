import { supabaseClient } from "./supabase-client.js";

const dot = document.getElementById("home-status-dot");
const text = document.getElementById("home-status-text");
const sub = document.getElementById("home-status-sub");

const timeFormatter = new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" });

function agentIsAlive(status) {
  if (!status?.agent_seen_at) return false;
  return (Date.now() - new Date(status.agent_seen_at).getTime()) / 1000 < 90;
}

async function refresh() {
  const [statusResult, settingsResult] = await Promise.all([
    supabaseClient
      .from("server_status")
      .select("running, players_online, max_players, player_names, agent_seen_at, last_event")
      .eq("id", 1)
      .single(),
    supabaseClient
      .from("server_settings")
      .select("maintenance, maintenance_message")
      .eq("id", 1)
      .single(),
  ]);

  const data = statusResult.data;
  const settings = settingsResult.data;

  // Onderhoud gaat boven alles
  if (settings?.maintenance) {
    dot.className = "status-dot is-maintenance";
    text.textContent = "Server in onderhoud";
    sub.textContent = settings.maintenance_message
      || "Sorry, de server is momenteel in onderhoud. Je kunt deze nu niet starten.";
    return;
  }

  if (statusResult.error || !data) {
    dot.className = "status-dot is-unknown";
    text.textContent = "Status onbekend";
    sub.textContent = "";
    return;
  }

  if (!agentIsAlive(data)) {
    dot.className = "status-dot is-unknown";
    text.textContent = "Status onbekend";
    sub.textContent = data.agent_seen_at
      ? "Laatst gezien om " + timeFormatter.format(new Date(data.agent_seen_at))
      : "";
    return;
  }

  if (data.running) {
    dot.className = "status-dot is-online";
    text.textContent = "Server is online";
    sub.textContent = data.players_online > 0
      ? `${data.players_online} van de ${data.max_players} spelers online`
      : "Nog niemand online — wees de eerste";
  } else {
    dot.className = "status-dot is-offline";
    text.textContent = "Server is offline";
    sub.textContent = data.last_event || "Heb je rechten? Dan kun je 'm zelf aanzetten.";
  }
}

refresh();
setInterval(refresh, 20000);
