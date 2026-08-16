import { supabaseClient } from "./supabase-client.js";

let mode = "login"; // of "register"

const titleEl = document.getElementById("form-title");
const introEl = document.getElementById("form-intro");
const nameField = document.getElementById("name-field");
const nameInput = document.getElementById("display-name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordHint = document.getElementById("password-hint");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("message");
const toggleText = document.getElementById("toggle-text");
const toggleLink = document.getElementById("toggle-mode");

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "form-message " + (type === "success" ? "is-success" : "is-error");
}

function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "form-message";
}

function applyMode() {
  clearMessage();
  const registering = mode === "register";

  titleEl.textContent = registering ? "Registreren" : "Inloggen";
  introEl.textContent = registering
    ? "Maak een account aan. De eigenaar wijst je daarna een rol toe."
    : "Log in om de serverbesturing te gebruiken.";
  nameField.style.display = registering ? "block" : "none";
  passwordHint.style.display = registering ? "block" : "none";
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  submitBtn.textContent = registering ? "Account aanmaken" : "Inloggen";
  toggleText.textContent = registering ? "Heb je al een account?" : "Nog geen account?";
  toggleLink.textContent = registering ? "Inloggen" : "Registreren";
}

toggleLink.addEventListener("click", (event) => {
  event.preventDefault();
  mode = mode === "login" ? "register" : "login";
  applyMode();
});

submitBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const displayName = nameInput.value.trim();

  if (!email || !password) {
    showMessage("Vul je e-mailadres en wachtwoord in.", "error");
    return;
  }
  if (mode === "register" && password.length < 8) {
    showMessage("Kies een wachtwoord van minimaal 8 tekens.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Bezig…";
  clearMessage();

  if (mode === "register") {
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });

    submitBtn.disabled = false;
    applyMode();

    if (error) {
      showMessage("Registreren mislukt: " + error.message, "error");
      return;
    }
    showMessage(
      "Account aangemaakt. Check je e-mail als er om bevestiging wordt gevraagd, en vraag de eigenaar om je een rol te geven.",
      "success"
    );
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  applyMode();

  if (error) {
    showMessage("Inloggen mislukt — controleer je gegevens.", "error");
    return;
  }
  window.location.href = "beheer.html";
});

// Al ingelogd? Dan meteen door naar het beheerpaneel.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = "beheer.html";
  applyMode();
})();
