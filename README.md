# Copy All Tab URLs

<img src="./icon.png?raw=true" alt="Logo" width="256" />

A polished browser extension that puts every open tab on your clipboard in one click — as plain
URLs, titled links, or Markdown. Works on **Chrome** and **Firefox**.

---

## ✨ Features

- ⚡ **One-click copy** — grab every selected tab URL instantly
- 🎯 **Pick exactly what you copy** — checkboxes, select all / clear, and a live counter
- 🪟 **Per-window controls** — select all or clear tabs in each window independently
- 🔍 **Instant search** — filter by page title or URL as you type
- 🧾 **Three copy formats** — plain URLs, `Title — URL`, or Markdown links
- 📋 **Copy a single URL** — hover any tab and hit its copy button
- 📥 **Paste & open** — paste a list of links (even Markdown) and reopen them as tabs
- 🪟 **Multi-window aware** — tabs are grouped by window, with the active tab highlighted
- 🗂️ **Collapsible windows** — fold a window's tabs to focus on the rest without losing your selection
- 🎨 **Redline-glass UI** — crimson neon glow, frosted glass cards, CRT haze, and buttery micro-interactions
- ⌨️ **Keyboard friendly** — `/` to search, `Enter` to copy, `Esc` to clear/close
- 🧩 **Graceful favicons** — letter avatars when a site has no icon

---

## 🛠️ Installation

### Chrome

<img src="./chrome.svg" alt="Logo" width="68" />

1. Download or clone this repository
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `chrome` folder

### Firefox

<img src="./firefox.svg" alt="Logo" width="68" />

1. Download or clone this repository
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file inside the `firefox` folder

> ⚠️ Firefox requires version 109+ and Manifest V3 support

---

## 📦 Usage

1. Click the extension icon in your browser toolbar
2. Untick any tabs you don't want (or press **Select all** / **Clear**)
3. Pick a format — **URLs**, **Title + URL**, or **Markdown**
4. Hit **Copy** and paste anywhere

**Paste & open:** copy a list of links from anywhere, open the popup, and press
**Paste & open** to launch them as background tabs (up to 20 at a time).

### Shortcuts

| Key       | Action                        |
| --------- | ----------------------------- |
| `/`       | Focus the search field        |
| `Enter`   | Copy the selected tabs        |
| `Esc`     | Clear search, then close      |
| `←` `→`   | Switch copy format            |

---

## 🔐 Permissions

- `tabs` — read the open tabs you choose to copy
- `clipboardWrite` — copy URLs to your clipboard
- `clipboardRead` — read links when you press **Paste & open**

No data ever leaves your browser. There are no network requests, analytics, or remote code.

---

## 🧑‍💻 Development

The popup is shared between both builds. To keep them in sync, edit the files in `chrome/`, then
copy `popup.html`, `styles.css`, `popup.js`, and `helper.js` into `firefox/`.

---

## 👤 Author

Built and maintained by **Nijoo** — [github.com/rockz5555](https://github.com/rockz5555).

---

## 📄 License

MIT — feel free to use, modify, and share.

---
