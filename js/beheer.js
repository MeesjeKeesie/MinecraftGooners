import { supabaseClient } from "./supabase-client.js";
import { getProfile, roleLabel, can } from "./session.js";

const loadingView = document.getElementById("loading-view");
const panelView = document.getElementById("panel-view");
const panelError = document.getElementById("panel-error");
const whoAmI = document.getElementById("who-am-i");
const myRoleBadge = document.getElementById("my-role");
const controlRow = document.getElementById("control-row");
const actionMessage = document.getElementById("action-message");
const noRightsNote = document.getElementById("no-rights-note");
const consoleSection = document.getElementById("console-section");
const consoleInput = document.getElementById("console-input");
const consoleSend = document.getElementById("console-send");
const consoleOutput = document.getElementById("console-output");
const historyList = document.getElementById("history-list");
const usersSection = document.getElementById("users-section");
const usersList = document.getElementById("users-list");

const timeFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" });

let profile = null;
let pollTimer = null;

/* ------------------------- helpers ------------------------- */

function showError(message) {
  panelError.textContent = message;
  panelError.classList.add("is-visible");
}
function clearError() {
  panelError.textContent = "";
  panelError.classList.remove("is-visible");
}
function showAction(message, type) {
  actionMessage.textContent = message;
  actionMessage.className = "form-message " + (type === "success" ? "is-success" : "is-error");
}

/** Is de agent recent nog van zich hebben laten horen? */
function agentIsAlive(status) {
  if (!status?.agent_seen_at) return false;
  const seconds = (Date.now() - new Date(status.agent_seen_at).getTime()) / 1000;
  return seconds < 90;
}

/* ------------------------- status ------------------------- */

async function refreshStatus() {
  const { data, error } = await supabaseClient
    .from("server_status")
    .select("*")
    .eq("id", 1)
    .single();

  const dot = document.getElementById("status-dot");
  const title = document.getElementById("status-title");
  const sub = document.getElementById("status-sub");
  const meta = document.getElementById("status-meta");

  if (error || !data) {
    dot.className = "status-dot is-unknown";
    title.textContent = "Status onbekend";
    sub.textContent = "Kon de status niet ophalen.";
    meta.textContent = "";
    return null;
  }

  if (!agentIsAlive(data)) {
    dot.className = "status-dot is-unknown";
    title.textContent = "Geen verbinding met de server-laptop";
    sub.textContent = "De agent heeft zich al even niet gemeld. Staat de laptop aan?";
    meta.textContent = data.agent_seen_at
      ? "Laatst gezien: " + timeFormatter.format(new Date(data.agent_seen_at))
      : "";
    return data;
  }

  if (data.running) {
    dot.className = "status-dot is-online";
    title.textContent = "Server draait";
    sub.textContent = data.player_names
      ? `${data.players_online} online: ${data.player_names}`
      : `${data.players_online} van ${data.max_players} spelers online`;
  } else {
    dot.className = "status-dot is-offline";
    title.textContent = "Server staat uit";
    sub.textContent = "Niemand kan op dit moment joinen.";
  }

  meta.textContent = "Bijgewerkt: " + timeFormatter.format(new Date(data.updated_at));
  return data;
}

/* ------------------------- opdrachten ------------------------- */

async function sendCommand(command, payload = null) {
  clearError();
  const { error } = await supabaseClient
    .from("server_commands")
    .insert({ command, payload });

  if (error) {
    showAction("Niet gelukt: " + error.message, "error");
    return false;
  }
  showAction("Opdracht verstuurd — de server pakt 'm binnen enkele seconden op.", "success");
  refreshHistory();
  return true;
}

function buildControls() {
  const buttons = [
    { command: "start", label: "Server starten", cls: "btn-success" },
    { command: "stop", label: "Server stoppen", cls: "btn-danger" },
    { command: "restart", label: "Herstarten", cls: "btn-ghost" },
  ];

  controlRow.textContent = "";
  let anyAllowed = false;

  for (const btn of buttons) {
    if (!can(profile.role, btn.command)) continue;
    anyAllowed = true;

    const el = document.createElement("button");
    el.className = "btn " + btn.cls;
    el.type = "button";
    el.textContent = btn.label;
    el.addEventListener("click", async () => {
      if (btn.command !== "start") {
        const confirmed = confirm(
          btn.command === "stop"
            ? "Server stoppen? Spelers die online zijn worden losgekoppeld."
            : "Server herstarten? Spelers worden even losgekoppeld."
        );
        if (!confirmed) return;
      }
      el.disabled = true;
      await sendCommand(btn.command);
      setTimeout(() => { el.disabled = false; }, 3000);
    });
    controlRow.appendChild(el);
  }

  noRightsNote.style.display = anyAllowed ? "none" : "block";
}

/* ------------------------- console ------------------------- */

consoleSend?.addEventListener("click", runConsoleCommand);
consoleInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runConsoleCommand();
});

async function runConsoleCommand() {
  const line = consoleInput.value.trim();
  if (!line) return;

  consoleSend.disabled = true;
  const ok = await sendCommand("console", line);
  consoleInput.value = "";

  if (ok) {
    consoleOutput.textContent = `> ${line}\nWachten op antwoord…`;
    pollConsoleResult(line);
  }
  consoleSend.disabled = false;
}

async function pollConsoleResult(line, attempt = 0) {
  if (attempt > 15) {
    consoleOutput.textContent = `> ${line}\n(geen antwoord ontvangen — draait de agent?)`;
    return;
  }

  const { data } = await supabaseClient
    .from("server_commands")
    .select("status, result")
    .eq("command", "console")
    .order("created_at", { ascending: false })
    .limit(1);

  const cmd = data?.[0];
  if (cmd && (cmd.status === "done" || cmd.status === "failed")) {
    consoleOutput.textContent = `> ${line}\n${cmd.result ?? "(geen uitvoer)"}`;
    refreshHistory();
    return;
  }

  setTimeout(() => pollConsoleResult(line, attempt + 1), 1000);
}

/* ------------------------- geschiedenis ------------------------- */

async function refreshHistory() {
  const { data, error } = await supabaseClient
    .from("server_commands")
    .select("id, command, payload, status, result, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  historyList.textContent = "";

  if (error || !data || data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nog geen opdrachten uitgevoerd.";
    historyList.appendChild(empty);
    return;
  }

  for (const cmd of data) {
    const card = document.createElement("div");
    card.className = "request-card";

    const info = document.createElement("div");
    info.className = "request-info";

    const head = document.createElement("div");
    const name = document.createElement("span");
    name.className = "request-name";
    name.textContent = cmd.command === "console" ? cmd.payload : cmd.command;
    head.appendChild(name);

    const badge = document.createElement("span");
    badge.className = "badge " + (
      cmd.status === "done" ? "badge-approved"
        : cmd.status === "failed" ? "badge-denied"
        : "badge-pending"
    );
    badge.textContent = {
      done: "Gelukt", failed: "Mislukt", pending: "In wachtrij", running: "Bezig",
    }[cmd.status] ?? cmd.status;
    head.appendChild(badge);
    info.appendChild(head);

    if (cmd.result) {
      const result = document.createElement("p");
      result.className = "request-reason mono";
      result.style.fontSize = "0.82rem";
      result.textContent = cmd.result.slice(0, 300);
      info.appendChild(result);
    }

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = timeFormatter.format(new Date(cmd.created_at));
    info.appendChild(meta);

    card.appendChild(info);
    historyList.appendChild(card);
  }
}

/* ------------------------- gebruikersbeheer ------------------------- */

async function refreshUsers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, role, created_at")
    .order("created_at", { ascending: true });

  usersList.textContent = "";

  if (error) {
    showError("Gebruikers ophalen mislukt: " + error.message);
    return;
  }

  for (const user of data) {
    const card = document.createElement("div");
    card.className = "request-card";

    const info = document.createElement("div");
    info.className = "request-info";

    const name = document.createElement("span");
    name.className = "request-name";
    name.textContent = user.display_name || "(naamloos)";
    info.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = "Lid sinds " + timeFormatter.format(new Date(user.created_at));
    info.appendChild(meta);
    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "request-actions";

    if (user.id === profile.id) {
      const self = document.createElement("span");
      self.className = "badge badge-approved";
      self.textContent = "Jij — " + roleLabel(user.role);
      actions.appendChild(self);
    } else {
      const select = document.createElement("select");
      select.className = "role-select";
      for (const value of ["none", "starter", "owner"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = roleLabel(value);
        if (user.role === value) option.selected = true;
        select.appendChild(option);
      }

      select.addEventListener("change", async () => {
        select.disabled = true;
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({ role: select.value })
          .eq("id", user.id);

        select.disabled = false;
        if (updateError) {
          showError("Rol wijzigen mislukt: " + updateError.message);
          refreshUsers();
        } else {
          clearError();
        }
      });

      actions.appendChild(select);
    }

    card.appendChild(actions);
    usersList.appendChild(card);
  }
}

/* ------------------------- uitloggen ------------------------- */

document.getElementById("logout-link").addEventListener("click", async (event) => {
  event.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

/* ------------------------- start ------------------------- */

(async () => {
  profile = await getProfile();

  if (!profile) {
    window.location.href = "account.html";
    return;
  }

  loadingView.style.display = "none";
  panelView.style.display = "block";

  whoAmI.textContent = profile.display_name || profile.email;
  myRoleBadge.textContent = roleLabel(profile.role);
  myRoleBadge.className = "badge " + (
    profile.role === "owner" ? "badge-approved"
      : profile.role === "starter" ? "badge-pending"
      : "badge-denied"
  );

  buildControls();

  if (profile.role === "owner") {
    consoleSection.style.display = "block";
    usersSection.style.display = "block";
    refreshUsers();
  }

  if (profile.role === "none") {
    document.getElementById("history-section").style.display = "none";
  } else {
    refreshHistory();
  }

  refreshStatus();
  pollTimer = setInterval(refreshStatus, 10000);
})();

window.addEventListener("beforeunload", () => clearInterval(pollTimer));
