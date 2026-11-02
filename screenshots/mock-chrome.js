(() => {
  const params = new URLSearchParams(location.search);
  const blur = params.get("blur") === "1";
  const scenario = params.get("scenario") || "single";

  const tab = (id, windowId, index, title, url) => ({
    id,
    windowId,
    index,
    active: false,
    title,
    url,
    favIconUrl: `https://icons.duckduckgo.com/ip3/${new URL(url).hostname.replace(/^www\./, "")}.ico`,
  });

  const singleTabs = [
    { ...tab(101, 1, 0, "rockz5555 / CopyAllTabUrls", "https://github.com/rockz5555/CopyAllTabUrls"), active: true },
    tab(102, 1, 1, "Copy All URLs - Community", "https://www.figma.com/community/file/12890455/copy-all-urls"),
    tab(103, 1, 2, "Launch checklist", "https://www.notion.so/launch-checklist-8f2c1a"),
    tab(104, 1, 3, "chrome.tabs - MDN Web Docs", "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs"),
    tab(105, 1, 4, "lofi beats to code to", "https://www.youtube.com/watch?v=jfKfPfyJRdk"),
    tab(106, 1, 5, "Dark UI inspiration", "https://dribbble.com/shots/popular/web-design"),
    tab(107, 1, 6, "Clipboard API on Firefox - Stack Overflow", "https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript"),
  ];

  const multiTabs = [
    { ...tab(201, 1, 0, "rockz5555 / CopyAllTabUrls", "https://github.com/rockz5555/CopyAllTabUrls"), active: true },
    tab(202, 1, 1, "Copy All URLs - Community", "https://www.figma.com/community/file/12890455/copy-all-urls"),
    tab(205, 2, 0, "lofi beats to code to", "https://www.youtube.com/watch?v=jfKfPfyJRdk"),
    tab(206, 2, 1, "Dark UI inspiration", "https://dribbble.com/shots/popular/web-design"),
    tab(207, 2, 2, "Clipboard API on Firefox - Stack Overflow", "https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript"),
    tab(208, 2, 3, "Linear - Product roadmap", "https://linear.app/copy-all-urls/roadmap"),
  ];

  const demoTabs = scenario === "multi" ? multiTabs : singleTabs;

  const api = {
    tabs: {
      query: async () => demoTabs.map((t) => ({ ...t })),
      update: async () => ({ ok: true }),
      create: async () => ({ ok: true }),
    },
    windows: {
      getCurrent: async () => ({ id: 1, focused: true }),
      update: async () => ({ ok: true }),
    },
  };

  try {
    Object.defineProperty(globalThis, "chrome", {
      value: api,
      configurable: true,
      writable: true,
    });
  } catch {
    globalThis.chrome = api;
  }

  if (blur) {
    const style = document.createElement("style");
    style.textContent = `
      .tab-title,
      .tab-url {
        filter: blur(4.5px);
        opacity: .82;
        user-select: none;
      }
      .tab-title { filter: blur(5px); }
    `;
    document.documentElement.appendChild(style);
  }

  const reportSize = () => {
    const app = document.querySelector(".app");
    const height = Math.ceil(
      (app ? app.getBoundingClientRect().height : document.documentElement.scrollHeight) + 20
    );
    try {
      parent.postMessage({ type: "cau:size", height }, "*");
    } catch {
      /* standalone render */
    }
  };

  window.addEventListener("load", () => {
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        reportSize();
        setTimeout(reportSize, 250);
        setTimeout(reportSize, 800);

        if (scenario === "multi") {
          setTimeout(() => {
            const head = document.querySelector('.window-head[data-window-id="2"]');
            if (head) head.click();
            setTimeout(reportSize, 300);
            setTimeout(reportSize, 700);
          }, 320);
        }

        try {
          parent.postMessage({ type: "cau:ready" }, "*");
        } catch {
          /* standalone render */
        }
      });
    });
  });
})();
