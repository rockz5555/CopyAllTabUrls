# Store listing copy

Ready-to-paste text for the Chrome Web Store and Firefox Add-ons (AMO) listings.
Version: 1.2.0

---

## Build the upload packages

```powershell
npm install
npm run package
```

This writes `dist/copy-all-urls-chrome-1.2.0.zip` and
`dist/copy-all-urls-firefox-1.2.0.zip`, each with `manifest.json` at the archive root.

## Submission checklist

### Chrome Web Store

1. Register at https://chrome.google.com/webstore/devconsole (one-time $5 fee).
2. Create a new item and upload `dist/copy-all-urls-chrome-1.2.0.zip`.
3. Paste the name, short description, and detailed description from this file.
4. Category: **Productivity**. Language: **English**.
5. Upload the 128×128 icon and at least one screenshot (1280×800 or 640×480) from
   [`screenshots/`](./screenshots/).
6. Complete the Privacy tab using the single purpose, permission justifications, and data usage
   text below.
7. Submit for review.

### Firefox Add-ons (AMO)

1. Open https://addons.mozilla.org/developers/addon/submit/ and choose **On this site**.
2. Upload `dist/copy-all-urls-firefox-1.2.0.zip`.
3. In **Compatibility**, enable **Firefox for Android** (the manifest declares `gecko_android`).
4. Paste the name, summary, description, category, tags, license, and links from this file.
5. Add at least one screenshot from [`screenshots/`](./screenshots/).
6. Complete the data collection disclosure.
7. Submit for review.

> On Firefox for Android the popup opens as a full-screen overlay. The shared stylesheet adapts
> with a `pointer: coarse` media query, but test on a phone before submitting.

Store artwork lives in [`screenshots/`](./screenshots/): four 1280×800 PNGs covering the hero view,
feature callouts, copy formats, and multi-window collapse. They are generated from the real popup
with mock tab data (no personal URLs) via `node screenshots/build.mjs`. See
[`screenshots/README.md`](./screenshots/README.md) for a description of each image.

---

## Name

```
Copy All URLs
```

## Short description (Chrome Web Store, max 132 characters)

```
Copy every open tab as plain URLs, titles, or Markdown. Paste a list back to reopen tabs. No accounts, no tracking.
```

## Summary (Firefox AMO, max 250 characters)

```
Copy every open tab as plain URLs, titles, or Markdown links, then paste the list back to reopen tabs. Filter by title or URL, pick tabs per window, and jump to any tab. Everything stays on your device.
```

## Detailed description

```
Copy All URLs turns a window full of tabs into a clean list you can paste anywhere.

Open the popup and every tab is there, grouped by window and ready to copy. Prefer domains? One tap regroups the list by site, with collapsible sections and per-group select all. Uncheck the ones you don't need, or use Select all / Clear. Search by page title or URL to narrow the list as you type. The counter always shows exactly how many links will land on your clipboard.

Three copy formats
- URLs: one plain link per line
- Title + URL: "Page title — https://example.com/page"
- Markdown: ready-to-paste "- [Page title](https://example.com/page)" links

View options
- Group by window, domain, or show one flat list
- Sort tabs A→Z or Z→A inside each group
- Hide duplicate URLs
- Add group headings to the copied text
- Switch to compact rows or hide favicons
Your choices are saved locally.

Paste & open
Copied a list of links from a chat, an email, or a document? Open the popup and press Paste & open. It finds the http(s) links in your clipboard, removes duplicates, and opens them as background tabs, up to 20 at a time. Markdown lists work too.

Built for real tab habits
- Tabs are grouped by window or domain, with the active tab marked
- Collapse a window or domain section to focus on the rest, without losing the selection
- Select or clear a whole window or domain without touching the others
- Copy a single URL from any tab without changing your selection
- Jump straight to any tab, even in another window
- Letter avatars stand in when a site has no favicon
- A radar-scan loader keeps the popup alive while tabs are indexed

Keyboard
- / focuses search
- Enter copies the selected tabs
- Left and right arrows switch format
- G cycles window, domain, and flat grouping
- , opens view options
- Esc clears the search, then closes the popup

Private by design
The extension reads tab titles and URLs only to build the list you ask for. Nothing is sent anywhere. There are no accounts, no analytics, no ads, and no remote code. Your tab list never leaves your device.

Permissions
- tabs: read the open tabs so they can be listed and copied
- clipboardWrite: copy the selected links
- clipboardRead: read links when you press Paste & open
```

## Single purpose statement (Chrome Web Store)

```
Copy the URLs of open browser tabs to the clipboard, and open links from the clipboard as new tabs.
```

## Permission justifications (Chrome Web Store)

`tabs`

```
Required to list the user's open tabs, including titles and URLs, so the user can choose which ones to copy. Tab data is processed locally and is never transmitted.
```

`clipboardWrite`

```
Required to place the selected tab URLs on the clipboard when the user presses Copy.
```

`clipboardRead`

```
Required only when the user presses Paste & open, to read links from the clipboard and reopen them as tabs. The clipboard is never read at any other time.
```

## Data usage (Chrome Web Store)

- Does the extension collect user data? **No**
- Does it sell or transfer data to third parties? **No**
- Does it use data for purposes unrelated to its single purpose? **No**
- Does it use remote code? **No**
- Does it use analytics, ads, or tracking? **No**

Privacy policy URL: none required; the extension has no server component and stores only the chosen copy format and view options in `localStorage`.

## Developer details

- Developer name: `Nijoo`
- Developer website: https://github.com/rockz5555
- Support: https://github.com/rockz5555/CopyAllTabUrls/issues
- In-product credit: the popup footer reads "Built by Nijoo"

## Firefox AMO fields

- Name: `Copy All URLs`
- Author: `Nijoo`
- Category: Tabs
- Tags: `tabs`, `clipboard`, `urls`, `markdown`, `productivity`
- Homepage: https://github.com/rockz5555/CopyAllTabUrls
- Support: https://github.com/rockz5555/CopyAllTabUrls/issues
- License: MIT

Data collection disclosure: the add-on collects no data. All processing happens locally in the
popup. The only stored values are the preferred copy format and view options, kept in local storage.

## What's new (release notes)

```
1.2.0
- Group tabs by domain, by window, or in one flat list
- New view options panel: sort A→Z, hide duplicates, group headings, compact rows, favicons
- Copy section headings with plain-text or Markdown output
- Keyboard shortcuts: G cycles grouping, , opens view options
- Collapsible domain sections with per-group select and clear

1.1.0
- New hand-drawn icon set for Chrome and Firefox
- Frosted-glass action buttons with a clearer success state
- Jump to any tab directly from the popup, including tabs in other windows
```
