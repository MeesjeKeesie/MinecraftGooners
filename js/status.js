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
  const { data, error } = await supabaseClient
    .from("server_status")
    .select("running, players_online, max_players, player_names, agent_seen_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
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
    sub.textContent = "Heb je rechten? Dan kun je 'm zelf aanzetten.";
  }
}

refresh();
setInterval(refresh, 20000);
