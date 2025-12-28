const header = document.querySelector(".site-header");
const navToggle = header?.querySelector(".nav-toggle");
const nav = header?.querySelector(".site-nav");

if (header && navToggle && nav) {
  const closeMenu = () => {
    header.classList.remove("is-menu-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    header.classList.add("is-menu-open");
    navToggle.setAttribute("aria-expanded", "true");
  };

  navToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (header.classList.contains("is-menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}
