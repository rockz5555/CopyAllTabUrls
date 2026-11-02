import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const chromeDir = join(root, "chrome");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error("No Chrome/Edge executable found. Set CHROME_PATH and retry.");
  process.exit(1);
}

const PREVIEW = join(chromeDir, "__shot.html");
const MOCK = join(chromeDir, "__shot-mock.js");
const profileRoot = mkdtempSync(join(tmpdir(), "cau-shot-"));

const variants = [
  { view: "scene", blur: false, out: "copy-all-urls-store-01.png" },
  { view: "detail", blur: false, out: "copy-all-urls-store-02.png" },
  { view: "formats", blur: false, out: "copy-all-urls-store-03.png" },
  { view: "multi", scenario: "multi", blur: false, out: "copy-all-urls-store-04.png" },
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitUntil(check, timeout, label) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else entry.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error(`CDP socket failed: ${url}`)), {
        once: true,
      });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
    });
  }

  close() {
    this.socket.close();
  }
}

function prepareHarness() {
  const popup = readFileSync(join(chromeDir, "popup.html"), "utf8");
  const marker = '<script src="popup.js" type="module"></script>';
  if (!popup.includes(marker)) {
    throw new Error("Could not find the popup.js script tag in chrome/popup.html");
  }
  writeFileSync(PREVIEW, popup.replace(marker, `<script src="__shot-mock.js"></script>\n  ${marker}`));
  writeFileSync(MOCK, readFileSync(join(here, "mock-chrome.js")));
}

async function launch(profileDir) {
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--window-size=1280,800",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const portFile = join(profileDir, "DevToolsActivePort");
  await waitUntil(() => existsSync(portFile), 25000, "Chrome DevTools port");
  const port = readFileSync(portFile, "utf8").split(/\r?\n/)[0].trim();

  const target = await waitUntil(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await response.json();
        return list.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      } catch {
        return null;
      }
    },
    20000,
    "Chrome page target"
  );

  return { proc, target };
}

function resize(big, target) {
  const script = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${big.replace(/'/g, "''")}')
$bmp = New-Object System.Drawing.Bitmap 1280, 800
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, 0, 0, 1280, 800)
$g.Dispose()
$bmp.Save('${target.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
`;
  spawnSyncPowerShell(script);
}

function spawnSyncPowerShell(script) {
  execFileSync("pwsh", ["-NoProfile", "-Command", script], { stdio: "inherit" });
}

async function shoot(variant) {
  const target = join(here, variant.out);
  const big = join(profileRoot, `${variant.view}-${variant.blur ? "blur" : "clear"}-2x.png`);
  const profileDir = join(profileRoot, `profile-${variant.view}-${variant.blur ? "blur" : "clear"}`);
  const url =
    pathToFileURL(join(here, "scene.html")).href +
    `?view=${variant.view}&blur=${variant.blur ? "1" : "0"}&scenario=${variant.scenario || "single"}`;

  const { proc, target: page } = await launch(profileDir);
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url });

    await waitUntil(
      async () => {
        const result = await cdp.send("Runtime.evaluate", {
          expression: "document.documentElement.dataset.ready === '1'",
          returnByValue: true,
        });
        return result.result.value === true;
      },
      25000,
      `${variant.view} scene ready`
    );

    await sleep(1500);

    const metrics = await cdp.send("Runtime.evaluate", {
      expression: "document.title",
      returnByValue: true,
    });

    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    writeFileSync(big, Buffer.from(shot.data, "base64"));

    cdp.send("Browser.close").catch(() => {});
    cdp.close();
    await Promise.race([
      new Promise((resolveExit) => proc.once("exit", resolveExit)),
      sleep(2500),
    ]);
    proc.kill();

    resize(big, target);
    rmSync(big, { force: true });
    console.log("wrote", target);
    console.log("  metrics", metrics.result.value);
  } finally {
    try {
      cdp.close();
    } catch {
      /* already closed */
    }
  }
}

prepareHarness();
try {
  for (const variant of variants) await shoot(variant);
} finally {
  rmSync(PREVIEW, { force: true });
  rmSync(MOCK, { force: true });
  try {
    rmSync(profileRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    /* Chrome can hold the throwaway profile briefly; the OS will clean temp. */
  }
}
