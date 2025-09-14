import { showToast } from './helper.js';

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await browser.tabs.query({});
  const list = document.getElementById('urlList');
  const tabCountSpan = document.getElementById('tabCount');

  list.innerHTML = '';
  tabCountSpan.textContent = tabs.length;

  tabs.forEach((el) => {
    const tab = el;

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      return;
    }
    const li = document.createElement('li');
    const img = document.createElement('img');
    const span = document.createElement('span');

    img.src = `${tab.favIconUrl}`;
    img.width = 32;

    span.style.cssText = `
      position: relative;
      font-family: monospace;
      font-size: 1.2em;
      top: -1.6rem;
      left: 2.8rem;
    `;
    span.textContent += tab.title;

    li.textContent = tab.url;

    list.appendChild(img);
    list.appendChild(span);
    list.appendChild(li);

    li.addEventListener('click', () => {
      navigator.clipboard
        .writeText(tab.url)
        .then(() => showToast('URL copied to clipboard!'))
        .catch((err) => {
          console.error('Failed to copy: ', err);
          showToast('Failed to copy URL');
        });
    });
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    const textToCopy = tabs.map(tab => tab.url).join('\n');

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => showToast('All URLs copied!'))
      .catch((err) => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy URLs');
      });
  });

  document
    .getElementById('pasteOpenBtn')
    .addEventListener('click', async () => {
      try {
        const pastedText = await navigator.clipboard.readText();
        const pastedUrls = pastedText
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url.startsWith('http'));

        pastedUrls.forEach((url) => {
          chrome.tabs.create({ url });
        });

        showToast(`${pastedUrls.length} tabs opened from clipboard`);
      } catch (err) {
        console.error('Failed to read clipboard: ', err);
        showToast('Could not read clipboard. Check permissions.');
      }
    });
});
