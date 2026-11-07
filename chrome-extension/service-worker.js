const API_BASE = "https://api-ht.microburbs.com.au";
const API_KEY_STORAGE = "microburbsApiKey";
const CACHE_TTL_MS = 60 * 60 * 1000;
const responseCache = new Map();
const addressesByTab = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("Could not enable the Microburbs side panel:", error);
  });
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch((error) => {
    console.error("Could not restrict extension storage access:", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("Could not enable the Microburbs side panel:", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ADDRESS_FOUND") {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number") {
      const address = typeof message.address === "string" ? message.address : null;
      if (address) addressesByTab.set(tabId, address);
      else addressesByTab.delete(tabId);
      chrome.runtime.sendMessage({ type: "ADDRESS_UPDATE", tabId, address }).catch(() => {
        // The side panel is not open; it will request the current address when opened.
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_ADDRESS") {
    const tabId = sender.tab?.id;
    sendResponse({ ok: true, address: typeof tabId === "number" ? addressesByTab.get(tabId) ?? null : null });
    return false;
  }

  const task = handleRequest(message);
  task.then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "The request failed." });
  });
  return true;
});

async function handleRequest(message) {
  switch (message?.type) {
    case "GET_KEY_STATUS": {
      const stored = await chrome.storage.local.get(API_KEY_STORAGE);
      return { ok: true, hasApiKey: Boolean(stored[API_KEY_STORAGE]) };
    }
    case "SAVE_API_KEY": {
      const apiKey = typeof message.apiKey === "string" ? message.apiKey.trim() : "";
      if (!apiKey) throw new Error("Enter your Microburbs team key first.");
      await chrome.storage.local.set({ [API_KEY_STORAGE]: apiKey });
      responseCache.clear();
      return { ok: true };
    }
    case "REMOVE_API_KEY":
      await chrome.storage.local.remove(API_KEY_STORAGE);
      responseCache.clear();
      return { ok: true };
    case "LOOKUP_ADDRESS":
      return lookupAddress(message.address);
    case "LOAD_PROPERTY":
      return loadProperty(message.id, message.displayName);
    default:
      return { ok: false, error: "Unsupported extension request." };
  }
}

async function lookupAddress(input) {
  const address = typeof input === "string" ? input.trim() : "";
  if (!address || address.length > 250) {
    throw new Error("Enter a property address of 250 characters or fewer.");
  }

  const body = await apiGet("/v1/geocode/address", { address });
  const candidates = Array.isArray(body.data) ? body.data.map((candidate) => ({
    id: candidate?.id ?? candidate?.gnaf_id ?? "",
    displayName: candidate?.display_name ?? candidate?.address ?? ""
  })).filter((candidate) => candidate.id && candidate.displayName) : [];

  const exactMatches = candidates.filter((candidate) =>
    normalizeAddress(candidate.displayName) === normalizeAddress(address)
  );

  return {
    ok: true,
    candidates: exactMatches,
    exactMatchId: exactMatches.length === 1 ? exactMatches[0].id : null,
    message: exactMatches.length ? body.message ?? null : candidates.length
      ? "Microburbs returned suggestions, but none exactly matched this address. Check the unit, street, and suburb; no property facts were loaded."
      : body.message ?? null
  };
}

async function loadProperty(id, displayName) {
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{5,40}$/.test(id)) {
    throw new Error("The selected property identifier is invalid.");
  }

  const encodedId = encodeURIComponent(id);
  const [basics, valuation] = await Promise.all([
    apiGet(`/v1/properties/${encodedId}/basics/all`),
    apiGet(`/v1/properties/${encodedId}/valuation/avm`)
  ]);

  return {
    ok: true,
    displayName: typeof displayName === "string" ? displayName : "",
    basics: basics.data ?? null,
    basicsMessage: basics.message ?? null,
    valuation: valuation.data ?? null,
    valuationMessage: valuation.message ?? null
  };
}

async function apiGet(path, params = {}) {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE);
  const apiKey = stored[API_KEY_STORAGE];
  if (!apiKey) throw new Error("Save your Microburbs team key in the panel to connect to the API.");

  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.body;

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The Microburbs API took too long to respond. Try again.");
    }
    throw new Error("Could not reach the Microburbs API. Check your connection and try again.");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The Microburbs API returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : "";
    if (response.status === 401) throw new Error("The API rejected this team key. Check it and save it again.");
    if (response.status === 403) {
      throw new Error(detail || "This property is outside the hackathon API coverage area.");
    }
    if (response.status === 429) throw new Error("The API is rate-limiting requests. Wait a moment and retry.");
    throw new Error(detail || `The Microburbs API returned HTTP ${response.status}.`);
  }

  if (!body || !Object.hasOwn(body, "data")) {
    throw new Error("The Microburbs API response did not contain a data field.");
  }

  responseCache.set(cacheKey, { savedAt: Date.now(), body });
  if (responseCache.size > 200) responseCache.delete(responseCache.keys().next().value);
  return body;
}

function normalizeAddress(value) {
  const roadTypes = {
    st: "street", rd: "road", ave: "avenue", av: "avenue", dr: "drive",
    pde: "parade", tce: "terrace", cres: "crescent", cct: "circuit",
    ct: "court", pl: "place", ln: "lane", hwy: "highway", blvd: "boulevard"
  };

  return String(value)
    .toLowerCase()
    .replace(/\b(?:nsw|vic|qld|wa|sa|tas|nt|act|australia)\b/g, " ")
    .replace(/\b\d{4}\s*$/, " ")
    .replace(/\b(?:unit|apartment|apt|flat|shop|suite)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => roadTypes[word] ?? word)
    .join(" ");
}
