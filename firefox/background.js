browser.browserAction.onClicked.addListener((tab) => {
  console.log('Current tab URL:', tab.url);
});
