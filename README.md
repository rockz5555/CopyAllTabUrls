# Copy All Tab URLs

A browser extension to copy/paste all open tab URLs to the clipboard.  
Supports both **Chrome** and **Firefox**.

## Features

- Copies and pastes URLs of all open tabs in the current window  
- Easy-to-use popup interface  
- Cross-browser compatibility (Chrome & Firefox)

## Installation

### Chrome

1. Download or clone the repository  
2. Go to `chrome://extensions/` in your browser  
3. Enable "Developer mode"  
4. Click "Load unpacked" and select the extension folder

### Firefox

1. Download or clone the repository  
2. Go to `about:debugging#/runtime/this-firefox` in your browser  
3. Click "Load Temporary Add-on"  
4. Select the `manifest.json` file inside the extension folder

> ⚠️ Firefox requires version 109+ and Manifest V3 support

## Usage

1. Click the extension icon in the browser toolbar  
2. In the popup, click the button to copy all tab URLs  
3. Paste the copied URLs wherever you need

## Permissions

- `tabs`: Access open tabs  
- `clipboardWrite`: Copy URLs to clipboard  
- `scripting`: Run scripts in the browser (Chrome only)

## License

MIT
