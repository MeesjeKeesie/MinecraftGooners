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

// Elke keer dat we data ophalen krijgt die aanroep een nummer. Alleen het
// antwoord van de nieuwste aanroep mag renderen. Zonder dit maakten drie
// gelijktijdige aanroepen (van onAuthStateChange) eerst alledrie de lijst
// leeg, waarna alledrie hun resultaat toevoegden — vandaar dat je alles
// drie keer onder elkaar zag staan.
let loadGeneration = 0;

// Voorkomt dat refreshView meerdere keren tegelijk draait.
let viewRefreshing = false;

let myUserId = null;

/* ---------------- Auth ---------------- */

async function refreshView() {
  if (viewRefreshing) return;
  viewRefreshing = true;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      loginView.style.display = "flex";
      dashboardView.style.display = "none";
      return;
    }

    // Ingelogd zijn is niet genoeg — alleen de eigenaar mag hier komen.
    // Dit is puur voor de weergave; de echte grens ligt in de RLS-policies.
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "owner") {
      loginView.style.display = "flex";
      dashboardView.style.display = "none";
      loginMessage.textContent =
        "Je bent ingelogd, maar deze pagina is alleen voor de eigenaar. Ga naar het beheerpaneel voor de serverbesturing.";
      loginMessage.className = "form-message is-error";
      return;
    }

    myUserId = session.user.id;
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    loadData(currentTab);
  } finally {
    viewRefreshing = false;
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
  const generation = ++loadGeneration;
  clearDashError();

  // Hulpje: alleen renderen als er ondertussen geen nieuwere aanroep
  // is gestart. Zo kan een traag antwoord nooit meer over een nieuwer
  // resultaat heen schrijven of het verdubbelen.
  const isCurrent = () => generation === loadGeneration;

  if (tab === "accounts") {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, display_name, role, created_at")
      .order("created_at", { ascending: true });

    if (!isCurrent()) return;
    listContainer.textContent = "";
    if (error) { showDashError(error.message); return; }
    renderAccounts(data);
    return;
  }

  if (tab === "players") {
    const { data, error } = await supabaseClient
      .from("players")
      .select("*")
      .eq("approved", true)
      .order("minecraft_name", { ascending: true });

    if (!isCurrent()) return;
    listContainer.textContent = "";
    if (error) { showDashError(error.message); return; }
    renderPlayers(data);
    return;
  }

  const { data, error } = await supabaseClient
    .from("requests")
    .select("*")
    .eq("status", tab)
    .order("created_at", { ascending: tab === "pending" });

  if (!isCurrent()) return;
  listContainer.textContent = "";
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
    email.className = "request-sub";
    email.textContent = req.email;

    const extra = document.createElement("div");
    extra.className = "request-sub";
    extra.textContent = "Discord: " + req.discord + " · Leeftijd: " + req.age;

    const reason = document.createElement("p");
    reason.className = "request-reason";
    reason.textContent = req.reason;

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = "Aangemeld: " + dateFormatter.format(new Date(req.created_at));

    info.appendChild(nameRow);
    info.appendChild(email);
    info.appendChild(extra);
    info.appendChild(reason);
    info.appendChild(meta);
    card.appendChild(info);

    if (tab === "pending") {
      const noteWrap = document.createElement("div");
      noteWrap.className = "request-note-wrap";
      const noteInput = document.createElement("textarea");
      noteInput.className = "note-input";
      noteInput.placeholder = "Optionele reden bij afkeuren (wordt meegestuurd in de e-mail)";
      noteWrap.appendChild(noteInput);
      card.appendChild(noteWrap);

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
      denyBtn.addEventListener("click", () => denyRequest(req, noteInput.value.trim(), denyBtn));

      actions.appendChild(approveBtn);
      actions.appendChild(denyBtn);
      card.appendChild(actions);
    }

    listContainer.appendChild(card);
  });
}

function renderAccounts(rows) {
  if (!rows || rows.length === 0) {
    listContainer.appendChild(emptyState("Nog geen website-accounts."));
    return;
  }

  const roleLabels = {
    owner: "Eigenaar",
    starter: "Mag starten",
    none: "Geen rechten",
  };

  rows.forEach((account) => {
    const card = document.createElement("div");
    card.className = "request-card";

    const info = document.createElement("div");
    info.className = "request-info";

    const name = document.createElement("span");
    name.className = "request-name";
    name.textContent = account.display_name || "(naamloos)";
    info.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = "Geregistreerd: " + dateFormatter.format(new Date(account.created_at));
    info.appendChild(meta);
    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "request-actions";

    if (account.id === myUserId) {
      // Je eigen rol kun je niet wijzigen — anders kun je jezelf
      // per ongeluk buiten je eigen beheerpaneel werken.
      const self = document.createElement("span");
      self.className = "badge badge-approved";
      self.textContent = "Jij — " + (roleLabels[account.role] ?? account.role);
      actions.appendChild(self);
    } else {
      const select = document.createElement("select");
      select.className = "role-select";

      for (const value of ["none", "starter", "owner"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = roleLabels[value];
        if (account.role === value) option.selected = true;
        select.appendChild(option);
      }

      const previous = account.role;
      select.addEventListener("change", async () => {
        if (select.value === "owner" && previous !== "owner") {
          const confirmed = confirm(
            `${account.display_name || "Deze gebruiker"} eigenaar maken?\n\n` +
            "Een eigenaar kan alles: de server stoppen, console-commando's " +
            "uitvoeren, aanmeldingen beheren en rollen van anderen wijzigen."
          );
          if (!confirmed) { select.value = previous; return; }
        }

        select.disabled = true;
        const { error } = await supabaseClient
          .from("profiles")
          .update({ role: select.value })
          .eq("id", account.id);

        select.disabled = false;
        if (error) {
          showDashError("Rol wijzigen mislukt: " + error.message);
          select.value = previous;
        } else {
          clearDashError();
          loadData("accounts");
        }
      });

      actions.appendChild(select);
    }

    card.appendChild(actions);
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

  // Best-effort: de goedkeuring zelf staat al vast, ook als de mail faalt.
  const { error: emailError } = await supabaseClient.functions.invoke("notify-applicant", {
    body: { email: req.email, minecraft_name: req.minecraft_name, decision: "approved" }
  });
  if (emailError) {
    showDashError("Goedgekeurd, maar de e-mail kon niet worden verstuurd: " + emailError.message);
  }

  loadData(currentTab);
}

async function denyRequest(req, note, btn) {
  btn.disabled = true;
  clearDashError();

  const { error } = await supabaseClient
    .from("requests")
    .update({ status: "denied" })
    .eq("id", req.id);

  if (error) { showDashError(error.message); btn.disabled = false; return; }

  const { error: emailError } = await supabaseClient.functions.invoke("notify-applicant", {
    body: { email: req.email, minecraft_name: req.minecraft_name, decision: "denied", note: note || null }
  });
  if (emailError) {
    showDashError("Afgekeurd, maar de e-mail kon niet worden verstuurd: " + emailError.message);
  }

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
