const ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
};

const MAX_TOASTS = 3;

/**
 * Show a glassy toast notification.
 *
 * @param {string} message
 * @param {{ type?: "success" | "error" | "info", duration?: number }} [options]
 * @returns {Promise<void>} resolves once the toast has been dismissed
 */
const showToast = (message, options = {}) => {
  const { type = "success", duration = 3200 } = options;
  const container = document.getElementById("toastContainer");

  if (!container) return Promise.resolve();

  while (container.children.length >= MAX_TOASTS) {
    container.firstElementChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.style.setProperty("--duration", `${duration}ms`);

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICONS[type] || ICONS.info;

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const progress = document.createElement("span");
  progress.className = "toast-progress";
  progress.setAttribute("aria-hidden", "true");

  toast.append(icon, text, progress);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  return new Promise((resolve) => {
    let remaining = duration;
    let startedAt = Date.now();
    let timer = null;

    const dismiss = () => {
      if (!toast.isConnected) return resolve();
      toast.classList.remove("is-visible");
      toast.classList.add("is-leaving");
      window.setTimeout(() => {
        toast.remove();
        resolve();
      }, 280);
    };

    const start = () => {
      startedAt = Date.now();
      timer = window.setTimeout(dismiss, remaining);
    };

    toast.addEventListener("mouseenter", () => {
      window.clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      progress.style.animationPlayState = "paused";
    });

    toast.addEventListener("mouseleave", () => {
      progress.style.animationPlayState = "running";
      start();
    });

    start();
  });
};

export { showToast };
