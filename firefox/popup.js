import { showToast } from "./helper.js";

/* Chrome exposes `chrome`, Firefox exposes both `browser` and `chrome`.
   Prefer the promise-based namespace so the same code runs everywhere. */
const api =
  globalThis.browser && globalThis.browser.tabs ? globalThis.browser : globalThis.chrome;

const FORMAT_KEY = "cau:format";
const MAX_OPEN_TABS = 20;

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 15H4.8A2.8 2.8 0 0 1 2 12.2V4.8A2.8 2.8 0 0 1 4.8 2h7.4A2.8 2.8 0 0 1 15 4.8v.7"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

const FORMATTERS = {
  urls: (tabs) => tabs.map((tab) => tab.url).join("\n"),
  titled: (tabs) => tabs.map((tab) => `${tab.title} — ${tab.url}`).join("\n"),
  markdown: (tabs) =>
    tabs.map((tab) => `- [${escapeMarkdown(tab.title)}](${tab.url})`).join("\n"),
};

const FORMAT_LABELS = {
  urls: "plain URLs",
  titled: "titles + URLs",
  markdown: "Markdown links",
};

const state = {
  tabs: [],
  selected: new Set(),
  query: "",
  format: loadFormat(),
  currentWindowId: undefined,
  firstRender: true,
};

/* ---------------------------------------------------------------- DOM */

const el = {
  list: document.getElementById("urlList"),
  tabCount: document.getElementById("tabCount"),
  searchInput: document.getElementById("searchInput"),
  searchField: document.getElementById("searchField"),
  clearSearch: document.getElementById("clearSearch"),
  formatSwitch: document.getElementById("formatSwitch"),
  listMeta: document.getElementById("listMeta"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyHint: document.getElementById("emptyHint"),
  copyBtn: document.getElementById("copyBtn"),
  copyLabel: document.getElementById("copyLabel"),
  copyIcon: document.querySelector("#copyBtn .btn-icon"),
  pasteBtn: document.getElementById("pasteOpenBtn"),
};

/* ------------------------------------------------------------- Helpers */

function loadFormat() {
  try {
    const saved = localStorage.getItem(FORMAT_KEY);
    if (saved && saved in FORMATTERS) return saved;
  } catch {
    /* storage can be unavailable; fall back to default */
  }
  return "urls";
}

function saveFormat(format) {
  try {
    localStorage.setItem(FORMAT_KEY, format);
  } catch {
    /* ignore */
  }
}

function escapeMarkdown(text) {
  return String(text).replace(/([\\[\]])/g, "\\$1");
}

function hashHue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  /* Keep generated avatar hues inside the red → pink → ember band. */
  return 330 + (hash % 70);
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function prettifyUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "ftp:", "file:"].includes(parsed.protocol)) {
      return url;
    }
    const host = parsed.hostname.replace(/^www\./i, "");
    if (!host) return url;
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${host}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || "";
  } catch {
    return "";
  }
}

function initialFor(tab) {
  const source = tab.title || hostOf(tab.url) || tab.url;
  const letter = source.trim().charAt(0);
  return (letter || "?").toUpperCase();
}

function normalizeTab(tab) {
  const url = tab.url || tab.pendingUrl || "";
  const title = (tab.title || "").trim() || hostOf(url) || url || "Untitled tab";

  return {
    id: String(tab.id ?? `${tab.windowId}:${tab.index}`),
    url,
    title,
    favIconUrl: tab.favIconUrl || "",
    windowId: tab.windowId ?? 0,
    active: Boolean(tab.active),
  };
}

function queryTabs() {
  return new Promise((resolve, reject) => {
    try {
      const result = api.tabs.query({});
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
      } else {
        resolve(result || []);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function getCurrentWindow() {
  if (!api.windows || typeof api.windows.getCurrent !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const result = api.windows.getCurrent({});
      if (result && typeof result.then === "function") {
        result.then(resolve, () => resolve(null));
      } else {
        resolve(result || null);
      }
    } catch {
      resolve(null);
    }
  });
}

function createTab(url) {
  return new Promise((resolve) => {
    try {
      const result = api.tabs.create({ url, active: false });
      if (result && typeof result.then === "function") {
        result.then(() => resolve(true), () => resolve(false));
      } else {
        resolve(true);
      }
    } catch {
      resolve(false);
    }
  });
}

async function copyText(text) {
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("clipboard timeout")), 700);
      }),
    ]);
    return true;
  } catch {
    /* Fallback for browsers that block or stall the async clipboard API. */
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function extractUrls(text) {
  const found = [];
  const pattern = /https?:\/\/[^\s<>"'`)\]]+/gi;

  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const matches = line.match(pattern);
      if (!matches) return;
      matches.forEach((match) => {
        const cleaned = match.replace(/[.,;:!?*_~]+$/, "");
        if (cleaned.length > 8) found.push(cleaned);
      });
    });

  return [...new Set(found)];
}

/* ------------------------------------------------------------ Rendering */

function getVisibleTabs() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.tabs;

  return state.tabs.filter(
    (tab) =>
      tab.title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query)
  );
}

function render() {
  const visible = getVisibleTabs();
  const animate = state.firstRender;

  el.list.replaceChildren();

  if (visible.length === 0) {
    el.list.hidden = true;
    el.emptyState.hidden = false;
    updateEmptyState();
    syncCounts();
    state.firstRender = false;
    return;
  }

  el.list.hidden = false;
  el.emptyState.hidden = true;

  const groups = new Map();
  visible.forEach((tab) => {
    if (!groups.has(tab.windowId)) groups.set(tab.windowId, []);
    groups.get(tab.windowId).push(tab);
  });

  const multipleWindows = groups.size > 1;
  let index = 0;

  groups.forEach((tabs, windowId) => {
    if (multipleWindows) {
      const windowNumber = [...groups.keys()].indexOf(windowId) + 1;
      el.list.appendChild(createWindowSeparator(windowId, tabs, windowNumber));
    }
    tabs.forEach((tab) => {
      el.list.appendChild(createTabItem(tab, index, animate));
      index += 1;
    });
  });

  syncCounts();
  state.firstRender = false;
}

function createWindowSeparator(windowId, tabs, windowNumber) {
  const item = document.createElement("li");
  item.className = "window-sep";

  const name = document.createElement("span");
  name.className = "window-name";
  name.textContent = `Window ${windowNumber}`;

  const actions = document.createElement("span");
  actions.className = "window-actions";

  const count = document.createElement("span");
  count.className = "window-count";
  count.textContent = `${tabs.length} tab${tabs.length === 1 ? "" : "s"}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "text-btn window-toggle";
  toggle.dataset.windowId = String(windowId);
  toggle.dataset.windowLabel = `window ${windowNumber}`;
  toggle.textContent = "Select all";
  toggle.setAttribute("aria-label", `Select all tabs in window ${windowNumber}`);

  actions.append(count, toggle);
  item.append(name, actions);
  return item;
}

function createTabItem(tab, index, animate) {
  const item = document.createElement("li");
  item.className = "tab-item";
  item.dataset.tabId = tab.id;
  item.style.setProperty("--hue", String(hashHue(tab.url || tab.title)));

  if (animate) {
    item.classList.add("enter");
    item.style.setProperty("--i", String(Math.min(index, 10)));
  }

  const selected = state.selected.has(tab.id);
  item.classList.toggle("is-selected", selected);

  const row = document.createElement("label");
  row.className = "tab-row";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "tab-check";
  check.checked = selected;
  check.setAttribute(
    "aria-label",
    `Include “${tab.title}” when copying`
  );

  const favicon = document.createElement("span");
  favicon.className = "favicon";

  const image = document.createElement("img");
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";

  const letter = document.createElement("span");
  letter.className = "favicon-letter";
  letter.textContent = initialFor(tab);

  if (tab.favIconUrl) {
    image.src = tab.favIconUrl;
    image.addEventListener("error", () => favicon.classList.add("is-fallback"));
  } else {
    favicon.classList.add("is-fallback");
  }

  favicon.append(image, letter);

  const text = document.createElement("span");
  text.className = "tab-text";

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title;

  const url = document.createElement("span");
  url.className = "tab-url";
  url.textContent = prettifyUrl(tab.url);

  text.append(title, url);
  row.append(check, favicon, text);

  if (tab.active && tab.windowId === state.currentWindowId) {
    const tag = document.createElement("span");
    tag.className = "tab-tag";
    tag.textContent = "Active";
    row.appendChild(tag);
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "icon-btn tab-copy";
  copyBtn.title = "Copy this URL";
  copyBtn.setAttribute("aria-label", `Copy URL of “${tab.title}”`);
  copyBtn.innerHTML = ICONS.copy;

  check.addEventListener("change", () => {
    if (check.checked) state.selected.add(tab.id);
    else state.selected.delete(tab.id);
    item.classList.toggle("is-selected", check.checked);
    syncCounts();
  });

  copyBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const ok = await copyText(tab.url);
    if (!ok) {
      showToast("Could not copy this URL", { type: "error" });
      return;
    }

    copyBtn.classList.add("is-copied");
    copyBtn.innerHTML = ICONS.check;
    showToast("URL copied to clipboard", { type: "success", duration: 2200 });

    window.setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyBtn.innerHTML = ICONS.copy;
    }, 1200);
  });

  item.append(row, copyBtn);
  return item;
}

function updateEmptyState() {
  if (state.query.trim()) {
    el.emptyTitle.textContent = "No matching tabs";
    el.emptyHint.textContent = `Nothing matches “${state.query.trim()}”. Try another search.`;
  } else {
    el.emptyTitle.textContent = "No tabs to show";
    el.emptyHint.textContent = "Open a page, then reopen this popup.";
  }
}

function syncCounts() {
  const visible = getVisibleTabs();
  const selectedVisible = visible.filter((tab) => state.selected.has(tab.id));
  const count = selectedVisible.length;

  el.copyLabel.textContent =
    count === 0 ? "Select tabs to copy" : `Copy ${count} URL${count === 1 ? "" : "s"}`;
  el.copyBtn.disabled = count === 0;

  el.selectAllBtn.disabled = visible.length === 0;
  el.selectAllBtn.textContent =
    visible.length > 0 && count === visible.length ? "Clear" : "Select all";

  if (visible.length === 0) {
    el.listMeta.textContent = state.query.trim() ? "No matches" : "No tabs";
  } else if (state.query.trim()) {
    el.listMeta.textContent = `${visible.length} of ${state.tabs.length} tabs`;
  } else {
    const sites = new Set(visible.map((tab) => hostOf(tab.url)).filter(Boolean));
    el.listMeta.textContent = `${visible.length} tab${visible.length === 1 ? "" : "s"} · ${
      sites.size
    } site${sites.size === 1 ? "" : "s"}`;
  }

  updateWindowToggles();
}

function updateWindowToggles() {
  const visible = getVisibleTabs();

  el.list.querySelectorAll(".window-toggle").forEach((button) => {
    const windowId = button.dataset.windowId;
    const tabs = visible.filter((tab) => String(tab.windowId) === windowId);
    const allSelected =
      tabs.length > 0 && tabs.every((tab) => state.selected.has(tab.id));
    const label = button.dataset.windowLabel || "this window";

    button.textContent = allSelected ? "Clear" : "Select all";
    button.setAttribute(
      "aria-label",
      allSelected ? `Clear selection in ${label}` : `Select all tabs in ${label}`
    );
  });
}

/* Update checkboxes in place so per-window toggles don't reset the scroll position. */
function applySelectionToDom() {
  el.list.querySelectorAll(".tab-item").forEach((item) => {
    const selected = state.selected.has(item.dataset.tabId);
    item.classList.toggle("is-selected", selected);

    const check = item.querySelector(".tab-check");
    if (check) check.checked = selected;
  });

  syncCounts();
}

/* -------------------------------------------------------------- Actions */

function setFormat(format) {
  if (!(format in FORMATTERS)) return;

  state.format = format;
  saveFormat(format);

  const options = [...el.formatSwitch.querySelectorAll(".format-option")];
  options.forEach((option) => {
    const active = option.dataset.format === format;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-checked", String(active));
  });

  const activeIndex = options.findIndex((option) => option.dataset.format === format);
  el.formatSwitch.style.setProperty("--i", String(Math.max(0, activeIndex)));
}

async function handleCopy() {
  const selected = getVisibleTabs().filter((tab) => state.selected.has(tab.id));

  if (selected.length === 0) {
    showToast("Select at least one tab first", { type: "info" });
    return;
  }

  const text = FORMATTERS[state.format](selected);
  const ok = await copyText(text);

  if (!ok) {
    showToast("Copy failed — clipboard is blocked", { type: "error" });
    return;
  }

  el.copyBtn.classList.add("is-success");
  el.copyIcon.innerHTML = ICONS.check;

  window.setTimeout(() => {
    el.copyBtn.classList.remove("is-success");
    el.copyIcon.innerHTML = ICONS.copy;
  }, 1400);

  const label = FORMAT_LABELS[state.format] || "URLs";
  showToast(
    `${selected.length} tab${selected.length === 1 ? "" : "s"} copied as ${label}`,
    { type: "success" }
  );
}

async function handlePasteOpen() {
  let clipboardText = "";

  try {
    clipboardText = await navigator.clipboard.readText();
  } catch {
    showToast("Clipboard access is blocked. Allow it and try again.", {
      type: "error",
    });
    return;
  }

  const urls = extractUrls(clipboardText);

  if (urls.length === 0) {
    showToast("No http(s) links found in the clipboard", { type: "info" });
    return;
  }

  const toOpen = urls.slice(0, MAX_OPEN_TABS);
  el.pasteBtn.classList.add("is-busy");
  el.pasteBtn.disabled = true;

  let opened = 0;
  for (let i = 0; i < toOpen.length; i += 4) {
    const batch = toOpen.slice(i, i + 4);
    const results = await Promise.all(batch.map((url) => createTab(url)));
    opened += results.filter(Boolean).length;
  }

  el.pasteBtn.classList.remove("is-busy");
  el.pasteBtn.disabled = false;

  const skipped = urls.length - toOpen.length;
  const suffix = skipped > 0 ? ` · ${skipped} more skipped` : "";
  showToast(
    `${opened} tab${opened === 1 ? "" : "s"} opened from clipboard${suffix}`,
    { type: opened > 0 ? "success" : "error" }
  );
}

/* --------------------------------------------------------------- Events */

function bindEvents() {
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value;
    const hasValue = state.query.length > 0;
    el.clearSearch.hidden = !hasValue;
    el.searchField.classList.toggle("has-value", hasValue);
    render();
  });

  el.clearSearch.addEventListener("click", () => {
    el.searchInput.value = "";
    state.query = "";
    el.clearSearch.hidden = true;
    el.searchField.classList.remove("has-value");
    el.searchInput.focus();
    render();
  });

  el.formatSwitch.addEventListener("click", (event) => {
    const option = event.target.closest(".format-option");
    if (option) setFormat(option.dataset.format);
  });

  el.formatSwitch.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const options = [...el.formatSwitch.querySelectorAll(".format-option")];
    const current = options.findIndex((option) =>
      option.classList.contains("is-active")
    );

    let next = current;
    if (event.key === "ArrowLeft") next = (current - 1 + options.length) % options.length;
    if (event.key === "ArrowRight") next = (current + 1) % options.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = options.length - 1;

    event.preventDefault();
    options[next].focus();
    setFormat(options[next].dataset.format);
  });

  el.selectAllBtn.addEventListener("click", () => {
    const visible = getVisibleTabs();
    const allSelected =
      visible.length > 0 && visible.every((tab) => state.selected.has(tab.id));

    visible.forEach((tab) => {
      if (allSelected) state.selected.delete(tab.id);
      else state.selected.add(tab.id);
    });

    applySelectionToDom();
  });

  el.list.addEventListener("click", (event) => {
    const toggle = event.target.closest(".window-toggle");
    if (!toggle) return;

    const windowId = toggle.dataset.windowId;
    const tabs = getVisibleTabs().filter(
      (tab) => String(tab.windowId) === windowId
    );
    if (tabs.length === 0) return;

    const allSelected = tabs.every((tab) => state.selected.has(tab.id));
    tabs.forEach((tab) => {
      if (allSelected) state.selected.delete(tab.id);
      else state.selected.add(tab.id);
    });

    applySelectionToDom();
  });

  el.copyBtn.addEventListener("click", handleCopy);
  el.pasteBtn.addEventListener("click", handlePasteOpen);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      el.searchInput.focus();
      el.searchInput.select();
      return;
    }

    if (event.key === "Escape") {
      if (state.query) {
        el.clearSearch.click();
      } else {
        window.close();
      }
      return;
    }

    if (
      event.key === "Enter" &&
      !typing &&
      !event.metaKey &&
      !event.ctrlKey &&
      !(target instanceof HTMLElement && target.closest("button, a"))
    ) {
      event.preventDefault();
      handleCopy();
    }
  });
}

/* ----------------------------------------------------------------- Init */

async function init() {
  bindEvents();
  setFormat(state.format);

  try {
    const [tabs, currentWindow] = await Promise.all([
      queryTabs(),
      getCurrentWindow(),
    ]);

    state.currentWindowId = currentWindow ? currentWindow.id : undefined;
    state.tabs = (Array.isArray(tabs) ? tabs : [])
      .map(normalizeTab)
      .filter((tab) => Boolean(tab.url));

    state.selected = new Set(state.tabs.map((tab) => tab.id));
    el.tabCount.textContent = String(state.tabs.length);

    render();
  } catch (error) {
    console.error("Copy All URLs: failed to read tabs", error);
    el.list.replaceChildren();
    el.list.hidden = true;
    el.emptyState.hidden = false;
    el.emptyTitle.textContent = "Could not read tabs";
    el.emptyHint.textContent = "Check the extension's permissions and try again.";
    el.listMeta.textContent = "Unavailable";
    el.tabCount.textContent = "0";
    el.copyBtn.disabled = true;
    el.copyLabel.textContent = "Select tabs to copy";
    el.selectAllBtn.disabled = true;
  }
}

init();
