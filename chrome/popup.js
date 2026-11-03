import { showToast } from "./helper.js";

/* Chrome exposes `chrome`, Firefox exposes both `browser` and `chrome`.
   Prefer the promise-based namespace so the same code runs everywhere. */
const api =
  globalThis.browser && globalThis.browser.tabs ? globalThis.browser : globalThis.chrome;

const FORMAT_KEY = "cau:format";
const SETTINGS_KEY = "cau:settings";
const MAX_OPEN_TABS = 20;
/* Keep the scan loader on screen long enough to read on instant tab queries. */
const LOADER_MIN_MS = 420;
const AVATAR_URL = "https://github.com/rockz5555.png?size=96";

const DEFAULT_SETTINGS = {
  groupBy: "window",
  sort: "default",
  hideDuplicates: false,
  copyHeadings: false,
  compact: false,
  showFavicons: true,
};

const GROUP_MODES = ["window", "domain", "none"];
const SORT_MODES = ["default", "az", "za"];

const GROUP_MODE_LABELS = {
  window: "window",
  domain: "domain",
  none: "tab order",
};

/* Common multi-label public suffixes so "news.bbc.co.uk" groups as bbc.co.uk
   instead of the misleading co.uk. Hosting suffixes keep subdomains intact. */
const MULTI_PART_SUFFIXES = new Set([
  "ac.uk",
  "co.in",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "co.za",
  "com.ar",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.mx",
  "com.pl",
  "com.sg",
  "com.tr",
  "edu.au",
  "gov.uk",
  "net.au",
  "ne.jp",
  "org.au",
  "org.uk",
  "blogspot.com",
  "firebaseapp.com",
  "github.io",
  "gitlab.io",
  "herokuapp.com",
  "netlify.app",
  "pages.dev",
  "vercel.app",
  "web.app",
]);

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 15H4.8A2.8 2.8 0 0 1 2 12.2V4.8A2.8 2.8 0 0 1 4.8 2h7.4A2.8 2.8 0 0 1 15 4.8v.7"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  window:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/></svg>',
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
  collapsed: new Set(),
  query: "",
  format: loadFormat(),
  settings: loadSettings(),
  currentWindowId: undefined,
  firstRender: true,
};

/* ---------------------------------------------------------------- DOM */

const el = {
  app: document.querySelector(".app"),
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
  settingsBtn: document.getElementById("settingsBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  settingsScrim: document.getElementById("settingsScrim"),
  settingsClose: document.getElementById("settingsClose"),
  settingsReset: document.getElementById("settingsReset"),
};

/* ------------------------------------------------------------- Helpers */

function loadGithubAvatar() {
  const img = document.querySelector(".support-avatar-img");
  if (!img) return;
  img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
  img.addEventListener("error", () => img.remove(), { once: true });
  img.src = `${AVATAR_URL}&t=${Date.now()}`;
}

/* Popups are created hidden and only become visible once the browser shows
   the window. Wait for that moment so the loader is actually on screen. */
function waitForPopupVisible() {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

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

function loadSettings() {
  const fallback = { ...DEFAULT_SETTINGS };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;

    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return fallback;

    return {
      groupBy: GROUP_MODES.includes(saved.groupBy) ? saved.groupBy : fallback.groupBy,
      sort: SORT_MODES.includes(saved.sort) ? saved.sort : fallback.sort,
      hideDuplicates: Boolean(saved.hideDuplicates),
      copyHeadings: Boolean(saved.copyHeadings),
      compact: Boolean(saved.compact),
      showFavicons:
        saved.showFavicons === undefined ? fallback.showFavicons : Boolean(saved.showFavicons),
    };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    /* ignore */
  }
}

function isDefaultSettings() {
  return Object.keys(DEFAULT_SETTINGS).every(
    (key) => state.settings[key] === DEFAULT_SETTINGS[key]
  );
}

function escapeMarkdown(text) {
  return String(text).replace(/([\\[\]])/g, "\\$1");
}

function hashHue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  /* Keep generated avatar hues inside the ember → amber band. */
  return 16 + (hash % 26);
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

function baseDomain(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (!host) {
      const protocol = parsed.protocol.replace(":", "");
      return protocol === "file" ? "Local files" : `${protocol} pages`;
    }

    if (host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return host;

    const parts = host.split(".");
    if (parts.length <= 2) return host;

    const lastTwo = parts.slice(-2).join(".");
    if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join(".");

    return lastTwo;
  } catch {
    return "Other";
  }
}

function groupKeyFor(tab) {
  if (state.settings.groupBy === "domain") return `domain:${baseDomain(tab.url)}`;
  if (state.settings.groupBy === "window") return `window:${tab.windowId}`;
  return "all";
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
    nativeId: tab.id,
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

function activateTab(tab) {
  return new Promise((resolve, reject) => {
    try {
      const result = api.tabs.update(tab.nativeId, { active: true });
      if (result && typeof result.then === "function") {
        result.then(() => resolve(), reject);
      } else {
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}

function focusWindow(windowId) {
  if (!api.windows || typeof api.windows.update !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    try {
      const result = api.windows.update(windowId, { focused: true });
      if (result && typeof result.then === "function") {
        result.then(() => resolve(), () => resolve());
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

async function goToTab(tab) {
  try {
    await activateTab(tab);
  } catch {
    showToast("Could not switch to that tab", { type: "error" });
    return;
  }

  await focusWindow(tab.windowId);

  try {
    window.close();
  } catch {
    /* popups can refuse to close; the tab is already focused either way */
  }
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
  let tabs = state.tabs;

  if (query) {
    tabs = tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(query) ||
        tab.url.toLowerCase().includes(query)
    );
  }

  if (state.settings.hideDuplicates) {
    const seen = new Set();
    tabs = tabs.filter((tab) => {
      const key = tab.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return tabs;
}

function compareTabs(a, b) {
  const byTitle = a.title.localeCompare(b.title, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (byTitle !== 0) return byTitle;
  return a.url.localeCompare(b.url, undefined, { numeric: true, sensitivity: "base" });
}

function sortTabs(tabs) {
  const mode = state.settings.sort;
  if (mode === "default") return tabs;

  const sorted = [...tabs].sort(compareTabs);
  return mode === "za" ? sorted.reverse() : sorted;
}

function getWindowNumbers() {
  const numbers = new Map();
  [...new Set(state.tabs.map((tab) => tab.windowId))].forEach((windowId, index) => {
    numbers.set(String(windowId), index + 1);
  });
  return numbers;
}

/* Turn a flat list into the sections the current settings ask for. */
function buildGroups(tabs) {
  const mode = state.settings.groupBy;

  if (mode === "none") {
    return [{ key: "all", kind: "none", label: "", tabs: sortTabs(tabs) }];
  }

  const map = new Map();
  sortTabs(tabs).forEach((tab) => {
    const key =
      mode === "domain" ? `domain:${baseDomain(tab.url)}` : `window:${tab.windowId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  });

  const windowNumbers = getWindowNumbers();
  const groups = [...map.entries()].map(([key, groupTabs]) => ({
    key,
    kind: mode,
    label:
      mode === "domain"
        ? baseDomain(groupTabs[0].url)
        : `Window ${windowNumbers.get(String(groupTabs[0].windowId)) || 1}`,
    tabs: groupTabs,
  }));

  if (mode === "domain") {
    groups.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
    );
  } else {
    groups.sort(
      (a, b) => Number(a.tabs[0].windowId) - Number(b.tabs[0].windowId)
    );
  }

  return groups;
}

function render(options = {}) {
  const visible = getVisibleTabs();
  const animate = options.animate !== undefined ? options.animate : state.firstRender;

  el.list.classList.toggle("is-compact", Boolean(state.settings.compact));
  el.list.classList.toggle("no-favicons", !state.settings.showFavicons);

  el.list.replaceChildren();
  el.list.removeAttribute("aria-busy");

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

  const groups = buildGroups(visible);
  /* A lone window needs no header; domain groups are always worth showing. */
  const showGroups =
    state.settings.groupBy === "domain" ||
    (state.settings.groupBy === "window" && groups.length > 1);
  let index = 0;

  groups.forEach((group) => {
    if (showGroups) el.list.appendChild(createGroupSeparator(group));
    group.tabs.forEach((tab) => {
      el.list.appendChild(createTabItem(tab, index, animate));
      index += 1;
    });
  });

  syncCounts();
  applyCollapseToDom();
  state.firstRender = false;
}

function createGroupSeparator(group) {
  const item = document.createElement("li");
  item.className = `group-sep group-sep--${group.kind}`;
  item.dataset.groupKey = group.key;

  const head = document.createElement("button");
  head.type = "button";
  head.className = "group-head";
  head.dataset.groupKey = group.key;
  head.dataset.groupLabel = group.label;
  head.setAttribute("aria-expanded", "true");
  head.setAttribute("aria-label", `Collapse ${group.label}`);

  const chevron = document.createElement("span");
  chevron.className = "group-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = ICONS.chevron;

  head.append(chevron);

  if (group.kind === "domain") {
    const badge = document.createElement("span");
    badge.className = "group-favicon";
    badge.style.setProperty("--hue", String(hashHue(group.label)));

    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    const letter = document.createElement("span");
    letter.className = "group-letter";
    letter.textContent = (group.label.trim().charAt(0) || "?").toUpperCase();

    if (group.tabs[0]?.favIconUrl) {
      image.src = group.tabs[0].favIconUrl;
      image.addEventListener("error", () => badge.classList.add("is-fallback"));
    } else {
      badge.classList.add("is-fallback");
    }

    badge.append(image, letter);
    head.append(badge);
  } else {
    const icon = document.createElement("span");
    icon.className = "group-icon";
    icon.innerHTML = ICONS.window;
    icon.setAttribute("aria-hidden", "true");
    head.append(icon);
  }

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.label;
  head.append(name);

  const actions = document.createElement("span");
  actions.className = "group-actions";

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = `${group.tabs.length} tab${group.tabs.length === 1 ? "" : "s"}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "text-btn group-toggle";
  toggle.dataset.groupKey = group.key;
  toggle.dataset.groupLabel = group.label;
  toggle.textContent = "Select all";
  toggle.setAttribute("aria-label", `Select all tabs in ${group.label}`);

  actions.append(count, toggle);
  item.append(head, actions);
  return item;
}

function createTabItem(tab, index, animate) {
  const item = document.createElement("li");
  item.className = "tab-item";
  item.dataset.tabId = tab.id;
  item.dataset.windowId = String(tab.windowId);
  item.dataset.groupKey = groupKeyFor(tab);
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

  const isCurrentTab = tab.active && tab.windowId === state.currentWindowId;

  if (isCurrentTab) {
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

  /* The tab the popup is already attached to needs no jump button. */
  if (!isCurrentTab) {
    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "icon-btn tab-go";
    goBtn.title = "Go to this tab";
    goBtn.setAttribute("aria-label", `Go to “${tab.title}”`);
    goBtn.innerHTML = ICONS.go;

    goBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      goToTab(tab);
    });

    item.append(goBtn);
  }

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
    const groups = buildGroups(visible);
    const sites = new Set(visible.map((tab) => baseDomain(tab.url)).filter(Boolean));
    const tabWord = `${visible.length} tab${visible.length === 1 ? "" : "s"}`;

    if (state.settings.groupBy === "domain") {
      el.listMeta.textContent = `${tabWord} · ${groups.length} domain${
        groups.length === 1 ? "" : "s"
      }`;
    } else if (state.settings.groupBy === "window") {
      el.listMeta.textContent = `${tabWord} · ${groups.length} window${
        groups.length === 1 ? "" : "s"
      } · ${sites.size} site${sites.size === 1 ? "" : "s"}`;
    } else {
      el.listMeta.textContent = `${tabWord} · ${sites.size} site${
        sites.size === 1 ? "" : "s"
      }`;
    }
  }

  updateGroupToggles();
}

function updateGroupToggles() {
  const groups = new Map(buildGroups(getVisibleTabs()).map((group) => [group.key, group.tabs]));

  el.list.querySelectorAll(".group-toggle").forEach((button) => {
    const tabs = groups.get(button.dataset.groupKey) || [];
    const allSelected =
      tabs.length > 0 && tabs.every((tab) => state.selected.has(tab.id));
    const label = button.dataset.groupLabel || "this group";

    button.textContent = allSelected ? "Clear" : "Select all";
    button.setAttribute(
      "aria-label",
      allSelected ? `Clear selection in ${label}` : `Select all tabs in ${label}`
    );
  });
}

function isGroupCollapsed(key) {
  return !state.query.trim() && state.collapsed.has(key);
}

/* Collapse is a view concern: hidden tabs stay selected and still copy. */
function applyCollapseToDom() {
  const searching = Boolean(state.query.trim());
  const collapsedKeys = new Set();

  el.list.querySelectorAll(".group-sep").forEach((separator) => {
    const key = separator.dataset.groupKey;
    const collapsed = isGroupCollapsed(key);
    const head = separator.querySelector(".group-head");
    const name = separator.querySelector(".group-name")?.textContent || "group";

    separator.classList.toggle("is-collapsed", collapsed);
    if (collapsed) collapsedKeys.add(key);

    if (head) {
      head.disabled = searching;
      head.setAttribute("aria-expanded", String(!collapsed));
      head.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${name}`);
    }
  });

  el.list.querySelectorAll(".tab-item").forEach((tabItem) => {
    tabItem.hidden = collapsedKeys.has(tabItem.dataset.groupKey);
  });
}

function toggleGroupSection(key) {
  if (state.collapsed.has(key)) state.collapsed.delete(key);
  else state.collapsed.add(key);
  applyCollapseToDom();
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

/* -------------------------------------------------------------- Settings */

let settingsHideTimer = 0;

function syncSettingsUI() {
  el.settingsPanel.querySelectorAll(".seg").forEach((seg) => {
    const key = seg.dataset.setting;
    const buttons = [...seg.querySelectorAll("button[data-value]")];
    const current = String(state.settings[key]);
    const activeIndex = buttons.findIndex((button) => button.dataset.value === current);

    seg.style.setProperty("--i", String(Math.max(0, activeIndex)));
    seg.style.setProperty("--count", String(buttons.length));

    buttons.forEach((button) => {
      const active = button.dataset.value === current;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
  });

  el.settingsPanel.querySelectorAll("input[data-toggle]").forEach((input) => {
    input.checked = Boolean(state.settings[input.dataset.toggle]);
  });

  el.settingsBtn.classList.toggle("has-custom", !isDefaultSettings());
}

function isSettingsOpen() {
  return !el.settingsPanel.hidden && el.settingsPanel.classList.contains("is-open");
}

function setSettingsOpen(open) {
  window.clearTimeout(settingsHideTimer);

  if (open) {
    syncSettingsUI();
    el.settingsScrim.hidden = false;
    el.settingsPanel.hidden = false;
    document.body.classList.add("settings-open");
    el.app.inert = true;

    requestAnimationFrame(() => {
      el.settingsPanel.classList.add("is-open");
      el.settingsScrim.classList.add("is-open");
    });

    el.settingsBtn.setAttribute("aria-expanded", "true");
    el.settingsBtn.classList.add("is-open");
    window.setTimeout(() => el.settingsClose.focus(), 40);
    return;
  }

  el.settingsPanel.classList.remove("is-open");
  el.settingsScrim.classList.remove("is-open");
  el.settingsBtn.setAttribute("aria-expanded", "false");
  el.settingsBtn.classList.remove("is-open");
  document.body.classList.remove("settings-open");
  el.app.inert = false;

  settingsHideTimer = window.setTimeout(() => {
    if (el.settingsPanel.classList.contains("is-open")) return;
    el.settingsPanel.hidden = true;
    el.settingsScrim.hidden = true;
  }, 230);
}

function closeSettings(options = {}) {
  setSettingsOpen(false);
  if (options.restoreFocus !== false) el.settingsBtn.focus();
}

function updateSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS) || state.settings[key] === value) return;

  state.settings[key] = value;
  saveSettings();
  syncSettingsUI();
  render({ animate: true });
}

function resetSettings() {
  state.settings = { ...DEFAULT_SETTINGS };
  state.collapsed.clear();
  saveSettings();
  syncSettingsUI();
  render({ animate: true });
  showToast("Settings reset to defaults", { type: "info", duration: 2200 });
}

function cycleGrouping() {
  const nextIndex = (GROUP_MODES.indexOf(state.settings.groupBy) + 1) % GROUP_MODES.length;
  const next = GROUP_MODES[nextIndex];

  updateSetting("groupBy", next);
  showToast(next === "none" ? "Grouping off" : `Grouped by ${GROUP_MODE_LABELS[next]}`, {
    type: "info",
    duration: 1800,
  });
}

/* --------------------------------------------------------------- Copying */

/* Groups decide both on-screen and clipboard order, so the text matches the list. */
function getSelectedTabs() {
  return buildGroups(getVisibleTabs())
    .flatMap((group) => group.tabs)
    .filter((tab) => state.selected.has(tab.id));
}

function buildCopyText(tabs) {
  const groups = buildGroups(tabs);

  if (!state.settings.copyHeadings || state.settings.groupBy === "none") {
    return FORMATTERS[state.format](groups.flatMap((group) => group.tabs));
  }

  return groups
    .map((group) => {
      const heading =
        state.format === "markdown"
          ? `## ${escapeMarkdown(group.label)}`
          : `# ${group.label}`;
      return `${heading}\n${FORMATTERS[state.format](group.tabs)}`;
    })
    .join("\n\n");
}

async function handleCopy() {
  const selected = getSelectedTabs();

  if (selected.length === 0) {
    showToast("Select at least one tab first", { type: "info" });
    return;
  }

  const text = buildCopyText(selected);
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
    const head = event.target.closest(".group-head");
    if (head) {
      if (!state.query.trim()) toggleGroupSection(head.dataset.groupKey);
      return;
    }

    const toggle = event.target.closest(".group-toggle");
    if (!toggle) return;

    const groupKey = toggle.dataset.groupKey;
    const group = buildGroups(getVisibleTabs()).find((entry) => entry.key === groupKey);
    const tabs = group ? group.tabs : [];
    if (tabs.length === 0) return;

    const allSelected = tabs.every((tab) => state.selected.has(tab.id));
    tabs.forEach((tab) => {
      if (allSelected) state.selected.delete(tab.id);
      else state.selected.add(tab.id);
    });

    applySelectionToDom();
  });

  el.list.addEventListener("pointermove", (event) => {
    const target = event.target;
    const item =
      target instanceof Element ? target.closest(".tab-item") : null;
    if (!item) return;

    const rect = item.getBoundingClientRect();
    item.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    item.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });

  el.copyBtn.addEventListener("click", handleCopy);
  el.pasteBtn.addEventListener("click", handlePasteOpen);

  el.settingsBtn.addEventListener("click", () => setSettingsOpen(true));
  el.settingsClose.addEventListener("click", () => closeSettings());
  el.settingsScrim.addEventListener("click", () => closeSettings());
  el.settingsReset.addEventListener("click", resetSettings);

  el.settingsPanel.addEventListener("click", (event) => {
    const option = event.target.closest(".seg button[data-value]");
    if (!option) return;

    const seg = option.closest(".seg");
    updateSetting(seg.dataset.setting, option.dataset.value);
  });

  el.settingsPanel.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-toggle]");
    if (input) updateSetting(input.dataset.toggle, input.checked);
  });

  el.settingsPanel.addEventListener("keydown", (event) => {
    const seg = event.target.closest(".seg");
    if (!seg) return;

    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const options = [...seg.querySelectorAll("button[data-value]")];
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
    updateSetting(seg.dataset.setting, options[next].dataset.value);
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);

    if (isSettingsOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
      return;
    }

    if (!typing && !event.metaKey && !event.ctrlKey && event.key === ",") {
      event.preventDefault();
      setSettingsOpen(true);
      return;
    }

    if (
      !typing &&
      !event.metaKey &&
      !event.ctrlKey &&
      (event.key === "g" || event.key === "G")
    ) {
      event.preventDefault();
      cycleGrouping();
      return;
    }

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
  syncSettingsUI();

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

    /* Keep the loader up for a readable beat after the popup is on screen,
       not just while it is hidden behind the browser window. */
    await Promise.race([
      waitForPopupVisible(),
      new Promise((resolve) => window.setTimeout(resolve, 800)),
    ]);
    await new Promise((resolve) => window.setTimeout(resolve, LOADER_MIN_MS));

    render();
  } catch (error) {
    console.error("Copy All URLs: failed to read tabs", error);
    el.list.replaceChildren();
    el.list.removeAttribute("aria-busy");
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

  /* Non-critical remote avatar: load it after the list is on screen so it
     can never delay the popup's first paint. */
  loadGithubAvatar();
}

init();
