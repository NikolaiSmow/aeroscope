const navLinks = Array.from(document.querySelectorAll(".section-nav a"));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  },
  { rootMargin: "-18% 0px -66%", threshold: [0.1, 0.35, 0.6] },
);

sections.forEach((section) => observer.observe(section));

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(target.innerText.trim());
    } catch {
      return;
    }

    const originalLabel = button.innerText;
    button.innerText = "Copied";
    window.setTimeout(() => {
      button.innerText = originalLabel;
    }, 1400);
  });
});
