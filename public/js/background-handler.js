document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("background-select");
  const savedTheme = localStorage.getItem("theme") || "default";
  applyTheme(savedTheme);

  if (select) {
    select.value = savedTheme;
    select.addEventListener("change", () => {
      const selected = select.value;
      localStorage.setItem("theme", selected);
      applyTheme(selected);
    });
  }
});

function applyTheme(theme) {
  document.body.classList.remove("default", "dark");
  document.body.classList.add(theme);

  const bgImage =
    theme === "dark"
      ? "url('darkpigetback.png')"
      : "url('pigetback.png')";
  document.body.style.backgroundImage = bgImage;
}
