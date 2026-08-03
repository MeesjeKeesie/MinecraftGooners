import { supabaseClient } from "./supabase-client.js";

const form = document.getElementById("signup-form");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("form-message");

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "form-message " + (type === "success" ? "is-success" : "is-error");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMinecraftName(value) {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const minecraftName = form.minecraft_name.value.trim();
  const email = form.email.value.trim();
  const discord = form.discord.value.trim();
  const age = Number(form.age.value);
  const reason = form.reason.value.trim();
  const honeypot = form.website.value.trim();

  // Spambot liep in de val: doe alsof het gelukt is, verstuur niets.
  if (honeypot) {
    showMessage("Aanvraag verzonden — je hoort van ons zodra hij bekeken is.", "success");
    form.reset();
    return;
  }

  if (!isValidMinecraftName(minecraftName)) {
    showMessage("Vul een geldige Minecraft-naam in (3–16 tekens, letters/cijfers/underscore).", "error");
    return;
  }
  if (!isValidEmail(email)) {
    showMessage("Vul een geldig e-mailadres in.", "error");
    return;
  }
  if (discord.length < 2) {
    showMessage("Vul je Discord-gebruikersnaam in.", "error");
    return;
  }
  if (!Number.isInteger(age) || age < 5 || age > 120) {
    showMessage("Vul een geldige leeftijd in.", "error");
    return;
  }
  if (reason.length < 3) {
    showMessage("Vertel ons kort waarom je mee wilt doen.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Versturen…";

  const { error } = await supabaseClient
    .from("requests")
    .insert({
      minecraft_name: minecraftName,
      email: email,
      discord: discord,
      age: age,
      reason: reason
    });

  submitBtn.disabled = false;
  submitBtn.textContent = "Verstuur aanmelding";

  if (error) {
    console.error(error);
    showMessage("Er ging iets mis bij het versturen. Probeer het straks nog eens.", "error");
    return;
  }

  showMessage("Aanvraag verzonden ✅ — je hoort van ons zodra hij bekeken is.", "success");
  form.reset();
});
