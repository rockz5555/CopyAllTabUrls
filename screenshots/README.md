# Store screenshots

Four 1280 × 800 PNGs, ready for the Chrome Web Store and Firefox AMO listings. Each one renders
the real popup from `chrome/popup.html` and fills it with demo tabs from `mock-chrome.js`, so no
personal browsing data ever appears in the artwork.

| File | Angle |
| --- | --- |
| `copy-all-urls-store-01.png` | Hero: the popup floating over a browser, headline "Every tab. One clipboard." |
| `copy-all-urls-store-02.png` | Feature callouts: formats, selection, paste & open, privacy |
| `copy-all-urls-store-03.png` | The three copy formats side by side with live-looking output |
| `copy-all-urls-store-04.png` | Multi-window support with one window expanded and one collapsed |

## What each image shows

### 01 — Every tab. One clipboard.

The popup sits on a graphite-and-ember stage with a blurred browser window behind it. Seven demo
tabs are loaded, the counter reads **Tabs 7**, and the primary action says **Copy 7 URLs**. The
headline and feature chips explain the one-click promise; the fake browser content is blurred so
the popup stays the focus.

### 02 — Inside the popup

The popup is enlarged on the left with a numbered list on the right:

1. **Three copy formats** — URLs, Title + URL, Markdown.
2. **Pick exactly what you copy** — checkboxes, per-window select all, search, live count.
3. **Paste & open** — reopen clipboard links as background tabs.
4. **Private by design** — local-only processing.

### 03 — Three copy formats

The popup is paired with three glass cards that show the exact text each format produces for the
same tabs: plain URLs, `Title — URL`, and Markdown links. The **URLs** card is highlighted to
match the active state in the popup.

### 04 — Multi-window support

Two browser windows are grouped inside the popup. **Window 1** is expanded with the active tab
marked, while **Window 2** is collapsed to its header and tab count. The collapsed window is a
view-only fold: its tabs stay selected and are still copied, which is the point of the shot.

## Regenerating

```powershell
node screenshots/build.mjs
```

The script:

1. Injects `mock-chrome.js` into a temporary copy of `chrome/popup.html` so the real UI runs
   without an extension host.
2. Drives headless Chrome (or Edge) through the DevTools protocol, waits for fonts and the popup
   to settle, and captures each scene at 2×.
3. Downsamples to exactly 1280 × 800 and removes the temporary files.

Set `CHROME_PATH` if Chrome/Edge is not in a standard Windows location. Add `?blur=1` to a scene
URL to blur tab titles and URLs; the bundled store shots use the mock data unblurred.
