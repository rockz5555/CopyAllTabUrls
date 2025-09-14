import { showToast } from './helper.js';

chrome.tabs.query({}, function (tabs) {
  const list = document.getElementById('urlList');
  const tabCountSpan = document.getElementById('tabCount');

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

  document.getElementById('copyBtn').addEventListener('click', () => {
    const textToCopy = urls.join('\n');

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
