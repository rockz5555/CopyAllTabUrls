import { showToast } from './helper.js';

document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('urlList');
  const tabCountSpan = document.getElementById('tabCount');
  const copyBtn = document.getElementById('copyBtn');
  const pasteOpenBtn = document.getElementById('pasteOpenBtn');

  try {
    const tabs = await browser.tabs.query({});
    const urls = tabs.map((tab) => tab.url);

    list.innerHTML = '';
    tabCountSpan.textContent = tabs.length;

    urls.forEach((url) => {
      const li = document.createElement('li');
      li.textContent = url;
      list.appendChild(li);

      li.addEventListener('click', () => {
        navigator.clipboard
          .writeText(url)
          .then(() => showToast('URL copied to clipboard!'))
          .catch((err) => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy URL');
          });
      });
    });

    copyBtn.addEventListener('click', () => {
      const textToCopy = urls.join('\n');
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => showToast('All URLs copied!'))
        .catch((err) => {
          console.error('Failed to copy: ', err);
          showToast('Failed to copy URLs');
        });
    });

    pasteOpenBtn.addEventListener('click', async () => {
      try {
        const pastedText = await navigator.clipboard.readText();
        const pastedUrls = pastedText
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url.startsWith('http'));

        pastedUrls.forEach((url) => {
          browser.tabs.create({ url });
        });

        showToast(`${pastedUrls.length} tabs opened from clipboard`);
      } catch (err) {
        console.error('Failed to read clipboard: ', err);
        showToast('Could not read clipboard. Check permissions.');
      }
    });
  } catch (err) {
    console.error('Error querying tabs:', err);
    showToast('Could not retrieve tabs.');
  }
});
