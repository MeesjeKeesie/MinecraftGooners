document.addEventListener("DOMContentLoaded", () => {
  const copyBtn = document.getElementById("copy-address");
  if (!copyBtn) return;

  copyBtn.addEventListener("click", async () => {
    const value = copyBtn.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      const original = copyBtn.textContent;
      copyBtn.textContent = "Gekopieerd!";
      setTimeout(() => { copyBtn.textContent = original; }, 1800);
    } catch (err) {
      copyBtn.textContent = "Kon niet kopiëren";
    }
  });
});
