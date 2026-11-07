const ADDRESS_SELECTORS = [
  "h1",
  '[data-testid="property-address"]',
  '[data-testid="listing-address"]',
  '[data-testid="address-line1"]',
  '[data-testid="listing-details__address"]',
  '[data-testid="listing-details__heading"]',
  '[itemprop="streetAddress"]',
  'address'
];

let lastAddress = null;
let lastPageUrl = location.href;
let scanTimer;

function isVisible(element) {
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function looksLikeStreetAddress(value) {
  if (!value || value.length > 180) return false;
  const hasStreetNumberAndName = /\b(?:\d+[a-z]?\s*\/\s*)?\d+[a-z]?\s+(?:[\w'-]+\s+){0,6}(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|terrace|tce|crescent|cres|circuit|cct|court|ct|place|pl|lane|ln|highway|hwy|boulevard|blvd|way|close|grove|esplanade|square|walk|quay)\b/i.test(value);
  return hasStreetNumberAndName;
}

function findAddress() {
  for (const selector of ADDRESS_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const value = (element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .trim();
      if (looksLikeStreetAddress(value)) return value;
    }
  }
  return null;
}

function publishAddress(address) {
  if (address === lastAddress) return;
  lastAddress = address;
  chrome.runtime.sendMessage({ type: "ADDRESS_FOUND", address }).catch(() => {
    // The extension service worker may be restarting; the panel can request a fresh scan.
  });
}

function scanPage() {
  const pageUrl = location.href;
  if (pageUrl !== lastPageUrl) {
    lastPageUrl = pageUrl;
    publishAddress(null);
  }
  const address = findAddress();
  if (address) publishAddress(address);
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanPage, 350);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_ADDRESS") {
    scanPage();
    sendResponse({ ok: true, address: lastAddress });
  }
});

const observer = new MutationObserver(scheduleScan);
if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener("popstate", scheduleScan);
window.addEventListener("hashchange", scheduleScan);
scanPage();
