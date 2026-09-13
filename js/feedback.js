import { supabaseClient } from "./supabase-client.js";
import { getProfile } from "./session.js";

const form = document.getElementById("feedback-form");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("form-message");
const charCount = document.getElementById("char-count");
const emailField = document.getElementById("email-field");
const anonRow = document.getElementById("anon-row");
const anonToggle = document.getElementById("anonymous-toggle");
const anonExplainer = document.getElementById("anon-explainer");
const listEl = document.getElementById("feedback-list");
const tabButtons = document.querySelectorAll(".tab-btn");

const dateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" });

const categoryLabels = {
  klacht: "Klacht",
  idee: "Idee",
  bug: "Bug",
  vraag: "Vraag",
  overig: "Overig",
};

const statusLabels = {
  nieuw: "Nieuw",
  opgepakt: "Opgepakt",
  opgelost: "Opgelost",
  afgewezen: "Afgewezen",
};

// Welke badge-kleur hoort bij welke status. De klassen komen uit style.css.
const statusBadgeClass = {
  opgelost: "badge-approved",
  opgepakt: "badge-pending",
  afgewezen: "badge-denied",
  nieuw: "badge-pending",
};

let profile = null;
let currentFilter = "alles";
let allItems = [];

/* ------------------------- helpers ------------------------- */

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "form-message " + (type === "success" ? "is-success" : "is-error");
}

function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "form-message";
}

function emptyState(text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = text;
  return div;
}

/* ------------------------- wie ben je ------------------------- */

async function loadProfile() {
  profile = await getProfile();

  if (profile) {
    // Ingelogd: e-mailadres weten we al, maar je mag wel kiezen of je
    // naam erbij komt.
    emailField.style.display = "none";
    anonRow.style.display = "";
    anonExplainer.textContent =
      `Laat dit uit en "${profile.display_name || profile.email}" komt erbij te staan als ik je bericht publiceer.`;
  } else {
    // Niet ingelogd: altijd anoniem, dus geen keuze te maken.
    emailField.style.display = "";
    anonRow.style.display = "none";
  }
}

/* ------------------------- tellertje ------------------------- */

form.message.addEventListener("input", () => {
  charCount.textContent = form.message.value.length;
});

/* ------------------------- versturen ------------------------- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const category = form.category.value;
  const title = form.title.value.trim();
  const message = form.message.value.trim();
  const contactEmail = form.contact_email.value.trim();
  const honeypot = form.website.value.trim();

  // Spambot liep in de val: doe alsof het gelukt is, verstuur niets.
  if (honeypot) {
    showMessage("Bedankt! Je bericht is binnengekomen.", "success");
    form.reset();
    return;
  }

  if (!categoryLabels[category]) {
    showMessage("Kies waar je bericht over gaat.", "error");
    return;
  }
  if (title.length < 3 || title.length > 80) {
    showMessage("Vul een korte samenvatting in van 3 tot 80 tekens.", "error");
    return;
  }
  if (message.length < 10) {
    showMessage("Vertel er iets meer over — minimaal 10 tekens.", "error");
    return;
  }
  if (message.length > 2000) {
    showMessage("Je bericht is te lang. Maximaal 2000 tekens.", "error");
    return;
  }
  if (!profile && contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    showMessage("Dat e-mailadres klopt niet. Laat het leeg als je geen antwoord hoeft.", "error");
    return;
  }

  const isAnonymous = profile ? anonToggle.checked : true;

  submitBtn.disabled = true;
  submitBtn.textContent = "Versturen…";

  const { error } = await supabaseClient.from("feedback").insert({
    category,
    title,
    message,
    author_id: profile ? profile.id : null,
    author_name: profile && !isAnonymous ? (profile.display_name || null) : null,
    is_anonymous: isAnonymous,
    contact_email: profile ? null : (contactEmail || null),
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Versturen";

  if (error) {
    showMessage("Versturen mislukt: " + error.message, "error");
    return;
  }

  form.reset();
  charCount.textContent = "0";
  showMessage(
    "Bedankt! Je bericht is binnengekomen. Ik lees het en publiceer het als het voor iedereen nuttig is.",
    "success"
  );
});

/* ------------------------- lijst ------------------------- */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

async function loadList() {
  // Let op: we lezen feedback_public, niet de tabel zelf. Daar zitten
  // geen e-mailadressen in en alleen wat gepubliceerd is.
  const { data, error } = await supabaseClient
    .from("feedback_public")
    .select("*")
    .order("created_at", { ascending: false });

  listEl.textContent = "";

  if (error) {
    listEl.appendChild(emptyState("Kon de berichten niet ophalen."));
    return;
  }

  allItems = data ?? [];
  renderList();
}

function renderList() {
  listEl.textContent = "";

  const items = currentFilter === "alles"
    ? allItems
    : allItems.filter((item) => item.category === currentFilter);

  if (items.length === 0) {
    listEl.appendChild(emptyState(
      allItems.length === 0
        ? "Er is nog niets gepubliceerd. Wees de eerste."
        : "Niets in deze categorie."
    ));
    return;
  }

  items.forEach((item) => listEl.appendChild(buildCard(item)));
}

function buildCard(item) {
  const card = document.createElement("div");
  card.className = "request-card";

  const info = document.createElement("div");
  info.className = "request-info";

  // Kop: samenvatting + categorie + status
  const head = document.createElement("div");

  const name = document.createElement("span");
  name.className = "request-name";
  name.textContent = item.title;
  head.appendChild(name);

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "badge";
  categoryBadge.textContent = categoryLabels[item.category] ?? item.category;
  head.appendChild(categoryBadge);

  if (item.status && item.status !== "nieuw") {
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge " + (statusBadgeClass[item.status] ?? "");
    statusBadge.textContent = statusLabels[item.status] ?? item.status;
    head.appendChild(statusBadge);
  }

  info.appendChild(head);

  // Wie en wanneer
  const meta = document.createElement("div");
  meta.className = "request-sub";
  meta.textContent =
    (item.author_name ? item.author_name : "Anoniem")
    + " · " + dateFormatter.format(new Date(item.created_at));
  info.appendChild(meta);

  // Het bericht zelf
  const body = document.createElement("p");
  body.className = "request-reason";
  body.textContent = item.message;
  info.appendChild(body);

  // Reactie van de eigenaar
  if (item.owner_reply) {
    const reply = document.createElement("div");
    reply.className = "news-note";

    const replyLabel = document.createElement("div");
    replyLabel.className = "request-meta";
    replyLabel.textContent = item.replied_at
      ? "Reactie · " + dateFormatter.format(new Date(item.replied_at))
      : "Reactie";
    reply.appendChild(replyLabel);

    const replyText = document.createElement("p");
    replyText.className = "request-reason";
    replyText.style.marginBottom = "0";
    replyText.textContent = item.owner_reply;
    reply.appendChild(replyText);

    info.appendChild(reply);
  }

  card.appendChild(info);
  return card;
}

/* ------------------------- start ------------------------- */

loadProfile();
loadList();
