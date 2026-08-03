import { supabaseClient } from "./supabase-client.js";

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loginMessage = document.getElementById("login-message");
const logoutBtn = document.getElementById("logout-btn");
const tabButtons = document.querySelectorAll(".tab-btn");
const listContainer = document.getElementById("list-container");
const dashError = document.getElementById("dash-error");

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

let currentTab = "pending";

/* ---------------- Auth ---------------- */

async function refreshView() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    loadData(currentTab);
  } else {
    loginView.style.display = "flex";
    dashboardView.style.display = "none";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "Bezig…";
  loginMessage.className = "form-message";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "Inloggen";

  if (error) {
    loginMessage.textContent = "Inloggen mislukt — controleer je gegevens.";
    loginMessage.className = "form-message is-error";
    return;
  }

  loginForm.reset();
  refreshView();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  refreshView();
});

supabaseClient.auth.onAuthStateChange(() => refreshView());

/* ---------------- Tabs ---------------- */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentTab = btn.dataset.tab;
    loadData(currentTab);
  });
});

/* ---------------- Data laden ---------------- */

function showDashError(message) {
  dashError.textContent = message;
  dashError.classList.add("is-visible");
}
function clearDashError() {
  dashError.textContent = "";
  dashError.classList.remove("is-visible");
}

async function loadData(tab) {
  clearDashError();
  listContainer.textContent = "";

  if (tab === "players") {
    const { data, error } = await supabaseClient
      .from("players")
      .select("*")
      .eq("approved", true)
      .order("minecraft_name", { ascending: true });

    if (error) { showDashError(error.message); return; }
    renderPlayers(data);
    return;
  }

  const { data, error } = await supabaseClient
    .from("requests")
    .select("*")
    .eq("status", tab)
    .order("created_at", { ascending: tab === "pending" });

  if (error) { showDashError(error.message); return; }
  renderRequests(data, tab);
}

/* ---------------- Renderen (veilig: textContent i.p.v. innerHTML) ---------------- */

function emptyState(text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = text;
  return div;
}

const emptyMessages = {
  pending: "Geen openstaande aanmeldingen. 🎉",
  approved: "Nog niemand goedgekeurd.",
  denied: "Nog niemand afgekeurd.",
};

function renderRequests(rows, tab) {
  if (!rows || rows.length === 0) {
    listContainer.appendChild(emptyState(emptyMessages[tab]));
    return;
  }

  rows.forEach((req) => {
    const card = document.createElement("div");
    card.className = "request-card";

    const info = document.createElement("div");
    info.className = "request-info";

    const nameRow = document.createElement("div");
    const name = document.createElement("span");
    name.className = "request-name";
    name.textContent = req.minecraft_name;
    const badge = document.createElement("span");
    badge.className = "badge badge-" + tab;
    badge.textContent = tab === "pending" ? "Openstaand" : tab === "approved" ? "Goedgekeurd" : "Afgekeurd";
    nameRow.appendChild(name);
    nameRow.appendChild(badge);

    const email = document.createElement("div");
    email.className = "request-email";
    email.textContent = req.email;

    const reason = document.createElement("p");
    reason.className = "request-reason";
    reason.textContent = req.reason;

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = "Aangemeld: " + dateFormatter.format(new Date(req.created_at));

    info.appendChild(nameRow);
    info.appendChild(email);
    info.appendChild(reason);
    info.appendChild(meta);
    card.appendChild(info);

    if (tab === "pending") {
      const actions = document.createElement("div");
      actions.className = "request-actions";

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn btn-success btn-sm";
      approveBtn.type = "button";
      approveBtn.textContent = "Goedkeuren";
      approveBtn.addEventListener("click", () => approveRequest(req, approveBtn));

      const denyBtn = document.createElement("button");
      denyBtn.className = "btn btn-danger btn-sm";
      denyBtn.type = "button";
      denyBtn.textContent = "Afkeuren";
      denyBtn.addEventListener("click", () => denyRequest(req, denyBtn));

      actions.appendChild(approveBtn);
      actions.appendChild(denyBtn);
      card.appendChild(actions);
    }

    listContainer.appendChild(card);
  });
}

function renderPlayers(rows) {
  if (!rows || rows.length === 0) {
    listContainer.appendChild(emptyState("Nog geen actieve spelers."));
    return;
  }

  rows.forEach((player) => {
    const card = document.createElement("div");
    card.className = "request-card";

    const info = document.createElement("div");
    info.className = "request-info";
    const name = document.createElement("span");
    name.className = "request-name";
    name.textContent = player.minecraft_name;
    info.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = "Speler sinds: " + dateFormatter.format(new Date(player.created_at));
    info.appendChild(meta);

    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "request-actions";
    const revokeBtn = document.createElement("button");
    revokeBtn.className = "btn btn-danger btn-sm";
    revokeBtn.type = "button";
    revokeBtn.textContent = "Toegang intrekken";
    revokeBtn.addEventListener("click", () => revokePlayer(player, revokeBtn));
    actions.appendChild(revokeBtn);
    card.appendChild(actions);

    listContainer.appendChild(card);
  });
}

/* ---------------- Acties ---------------- */

async function approveRequest(req, btn) {
  btn.disabled = true;
  clearDashError();

  const { error: updateError } = await supabaseClient
    .from("requests")
    .update({ status: "approved" })
    .eq("id", req.id);

  if (updateError) { showDashError(updateError.message); btn.disabled = false; return; }

  const { error: insertError } = await supabaseClient
    .from("players")
    .insert({ minecraft_name: req.minecraft_name, approved: true });

  if (insertError) { showDashError(insertError.message); btn.disabled = false; return; }

  loadData(currentTab);
}

async function denyRequest(req, btn) {
  btn.disabled = true;
  clearDashError();

  const { error } = await supabaseClient
    .from("requests")
    .update({ status: "denied" })
    .eq("id", req.id);

  if (error) { showDashError(error.message); btn.disabled = false; return; }

  loadData(currentTab);
}

async function revokePlayer(player, btn) {
  if (!confirm(`Toegang van ${player.minecraft_name} intrekken?`)) return;
  btn.disabled = true;
  clearDashError();

  const { error } = await supabaseClient
    .from("players")
    .update({ approved: false })
    .eq("id", player.id);

  if (error) { showDashError(error.message); btn.disabled = false; return; }

  loadData("players");
}

/* ---------------- Start ---------------- */
refreshView();
