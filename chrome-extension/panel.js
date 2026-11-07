const keyForm = document.querySelector("#key-form");
const keyInput = document.querySelector("#api-key");
const keyStatus = document.querySelector("#key-status");
const clearKeyButton = document.querySelector("#clear-key");
const addressForm = document.querySelector("#address-form");
const addressInput = document.querySelector("#address");
const sourceBadge = document.querySelector("#source-badge");
const messageElement = document.querySelector("#message");
const matchesElement = document.querySelector("#matches");
const propertyElement = document.querySelector("#property");

let activeTabId = null;
let lookupSequence = 0;

function showMessage(text, kind = "info") {
  messageElement.textContent = text;
  messageElement.className = text ? `message visible ${kind}` : "message";
}

function checkedResponse(response) {
  if (!response?.ok) throw new Error(response?.error || "The extension request failed.");
  return response;
}

async function request(type, payload = {}) {
  return checkedResponse(await chrome.runtime.sendMessage({ type, ...payload }));
}

async function initialize() {
  try {
    const status = await request("GET_KEY_STATUS");
    setKeyStatus(status.hasApiKey);
  } catch (error) {
    showMessage(error.message, "error");
  }
  await refreshActiveTab();
}

function setKeyStatus(saved) {
  keyStatus.textContent = saved ? "Team key saved in this browser." : "No key saved.";
  clearKeyButton.hidden = !saved;
}

async function refreshActiveTab() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    sourceBadge.textContent = "Address unavailable";
    return;
  }

  const tab = tabs[0];
  activeTabId = tab?.id ?? null;
  if (typeof activeTabId !== "number") {
    sourceBadge.textContent = "Address unavailable";
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { type: "GET_ADDRESS" });
    if (response?.address) acceptAddress(response.address, "Detected on listing");
    else showManualAddressHint();
  } catch {
    showManualAddressHint();
  }
}

function showManualAddressHint() {
  if (sourceBadge.textContent === "Detected on listing") return;
  sourceBadge.textContent = "Manual entry";
  sourceBadge.classList.remove("detected");
  if (!addressInput.value) showMessage("No address field was detected. Enter the property address to search.");
}

function acceptAddress(address, source) {
  if (typeof address !== "string" || !address.trim()) {
    addressInput.value = "";
    sourceBadge.textContent = "Waiting for address";
    sourceBadge.classList.remove("detected");
    matchesElement.hidden = true;
    propertyElement.hidden = true;
    showMessage("The listing changed. Waiting for its address, or enter one below.");
    return;
  }
  const changed = addressInput.value.trim() !== address.trim();
  addressInput.value = address;
  sourceBadge.textContent = source;
  sourceBadge.classList.toggle("detected", source === "Detected on listing");
  if (changed) runLookup(address);
}

async function runLookup(input) {
  const address = input.trim();
  if (!address) {
    showMessage("Enter an address to search.", "error");
    return;
  }

  const sequence = ++lookupSequence;
  matchesElement.hidden = true;
  matchesElement.replaceChildren();
  propertyElement.hidden = true;
  propertyElement.replaceChildren();
  showMessage("Matching this address with Microburbs…");

  try {
    const result = await request("LOOKUP_ADDRESS", { address });
    if (sequence !== lookupSequence) return;
    if (addressInput.value.trim() !== address) return;

    if (!result.candidates.length) {
      showMessage(result.message || "No exact property match was returned. Check the address and try again.", "error");
      return;
    }

    const exact = result.candidates.find((candidate) => candidate.id === result.exactMatchId);
    if (exact) {
      await showProperty(exact, sequence);
      return;
    }
    showCandidates(result.candidates, sequence);
  } catch (error) {
    if (sequence === lookupSequence) showMessage(error.message, "error");
  }
}

function showCandidates(candidates, sequence) {
  matchesElement.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Confirm the matching address";
  const list = document.createElement("div");
  list.className = "candidate-list";

  for (const candidate of candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate";
    button.textContent = candidate.displayName;
    button.addEventListener("click", () => showProperty(candidate, sequence));
    list.append(button);
  }

  matchesElement.append(heading, list);
  matchesElement.hidden = false;
  showMessage("Choose the exact home. We do not guess when the address is ambiguous.");
}

async function showProperty(candidate, sequence) {
  propertyElement.hidden = false;
  propertyElement.replaceChildren();
  showMessage("Loading property facts…");

  try {
    const facts = await request("LOAD_PROPERTY", {
      id: candidate.id,
      displayName: candidate.displayName
    });
    if (sequence !== lookupSequence) return;
    renderProperty(facts);
    showMessage("");
  } catch (error) {
    if (sequence === lookupSequence) {
      propertyElement.hidden = true;
      showMessage(error.message, "error");
    }
  }
}

function renderProperty(result) {
  propertyElement.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "property-heading";
  const address = document.createElement("h3");
  address.textContent = result.displayName || "Matched property";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Microburbs data for this matched home";
  heading.append(address, subtitle);
  propertyElement.append(heading);

  const basics = result.basics && typeof result.basics === "object" ? result.basics : {};
  const valuation = result.valuation && typeof result.valuation === "object" ? result.valuation : {};
  const facts = [];

  if (isPresent(valuation.predicted_price)) {
    const range = formatRange(valuation.predicted_price_low, valuation.predicted_price_high);
    facts.push({
      label: "Estimated value",
      value: formatMoney(valuation.predicted_price),
      note: range ? `Estimated range ${range}` : "",
      primary: true
    });
  }
  addFact(facts, "Bedrooms", basics.bed_count);
  addFact(facts, "Bathrooms", basics.bath_count);
  addFact(facts, "Parking", basics.parking_count);
  addFact(facts, "Home type", basics.dwelling_type);
  if (isPresent(basics.land_area_sqm)) addFact(facts, "Land area", `${formatNumber(basics.land_area_sqm)} m²`);

  if (isPresent(valuation.confidence_score)) {
    const confidence = Number(valuation.confidence_score);
    addFact(facts, "Estimate confidence", `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}%`);
  }

  if (!facts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-facts";
    const messages = [result.basicsMessage, result.valuationMessage].filter(Boolean);
    empty.textContent = messages.join(" ") || "No property facts are available for this address yet.";
    propertyElement.append(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "facts-grid";
  for (const fact of facts) {
    const card = document.createElement("article");
    card.className = fact.primary ? "fact-card primary" : "fact-card";
    const label = document.createElement("p");
    label.className = "fact-label";
    label.textContent = fact.label;
    const value = document.createElement("p");
    value.className = "fact-value";
    value.textContent = fact.value;
    card.append(label, value);
    if (fact.note) {
      const note = document.createElement("p");
      note.className = "fact-note";
      note.textContent = fact.note;
      card.append(note);
    }
    grid.append(card);
  }
  propertyElement.append(grid);

  if (valuation.prediction_date) {
    const date = document.createElement("p");
    date.className = "fact-note";
    date.textContent = `Estimate date: ${formatDate(valuation.prediction_date)}`;
    propertyElement.append(date);
  }

  const unavailable = [result.basicsMessage, result.valuationMessage].filter(Boolean);
  if (unavailable.length) {
    const note = document.createElement("p");
    note.className = "empty-facts";
    note.textContent = unavailable.join(" ");
    propertyElement.append(note);
  }
}

function addFact(facts, label, value) {
  if (isPresent(value)) facts.push({ label, value: String(value) });
}

function isPresent(value) {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "string") {
    return value.trim() !== "" && !/^(?:nan|null|none|n\/a|not available)$/i.test(value.trim());
  }
  return true;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(number) : String(value);
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(number)
    : String(value);
}

function formatRange(low, high) {
  if (!isPresent(low) || !isPresent(high)) return "";
  return `${formatMoney(low)}–${formatMoney(high)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

keyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("SAVE_API_KEY", { apiKey: keyInput.value });
    keyInput.value = "";
    setKeyStatus(true);
    showMessage("Team key saved. Address matching is ready.");
    if (addressInput.value.trim()) runLookup(addressInput.value);
  } catch (error) {
    showMessage(error.message, "error");
  }
});

clearKeyButton.addEventListener("click", async () => {
  try {
    await request("REMOVE_API_KEY");
    setKeyStatus(false);
    propertyElement.hidden = true;
    showMessage("Team key removed from this browser.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sourceBadge.textContent = "Manual entry";
  sourceBadge.classList.remove("detected");
  runLookup(addressInput.value);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ADDRESS_UPDATE" && message.tabId === activeTabId) {
    if (message.address) acceptAddress(message.address, "Detected on listing");
    else acceptAddress(null, "Detected on listing");
  }
});

chrome.tabs.onActivated.addListener(refreshActiveTab);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete") refreshActiveTab();
});

initialize();
