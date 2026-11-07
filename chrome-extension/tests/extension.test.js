const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const extensionPath = path.join(__dirname, "..");

function createWorker(fetch) {
  const listeners = {};
  const values = {};
  const chrome = {
    runtime: {
      onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
      onStartup: { addListener: (listener) => { listeners.startup = listener; } },
      onMessage: { addListener: (listener) => { listeners.message = listener; } },
      sendMessage: async () => ({})
    },
    sidePanel: { setPanelBehavior: async () => ({}) },
    storage: {
      local: {
        get: async (key) => ({ [key]: values[key] }),
        set: async (entries) => Object.assign(values, entries),
        remove: async (key) => { delete values[key]; },
        setAccessLevel: async () => ({})
      }
    }
  };

  vm.runInNewContext(
    fs.readFileSync(path.join(extensionPath, "service-worker.js"), "utf8"),
    { chrome, fetch, URL, AbortSignal, DOMException, Date, Map, console, Object, encodeURIComponent, Error, String }
  );

  return {
    values,
    send(message) {
      return new Promise((resolve) => listeners.message(message, {}, resolve));
    }
  };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("saves a key, matches a unit address exactly, and loads available facts", async () => {
  const requests = [];
  const app = createWorker(async (url, options) => {
    const parsedUrl = new URL(url);
    requests.push({ url: parsedUrl, authorization: options.headers.Authorization });

    if (parsedUrl.pathname === "/v1/geocode/address") {
      return jsonResponse({
        data: [{ id: "GANSW710347863", display_name: "UNIT 304/9 Crystal Street, Waterloo (NSW)" }]
      });
    }
    if (parsedUrl.pathname.endsWith("/basics/all")) {
      return jsonResponse({ data: { bed_count: 2, bath_count: 2, parking_count: 1, dwelling_type: "nan" } });
    }
    if (parsedUrl.pathname.endsWith("/valuation/avm")) {
      return jsonResponse({
        data: {
          predicted_price: 907500,
          predicted_price_low: 707850,
          predicted_price_high: 1107150,
          prediction_date: "2026-07-27",
          confidence_score: 82
        }
      });
    }
    throw new Error(`Unexpected API request: ${parsedUrl.pathname}`);
  });

  const saved = await app.send({ type: "SAVE_API_KEY", apiKey: " test-team-key " });
  assert.equal(saved.ok, true);
  assert.equal(app.values.microburbsApiKey, "test-team-key");

  const match = await app.send({
    type: "LOOKUP_ADDRESS",
    address: "304/9 Crystal Street, Waterloo NSW 2017"
  });
  assert.equal(match.exactMatchId, "GANSW710347863");
  assert.equal(match.candidates.length, 1);

  const property = await app.send({
    type: "LOAD_PROPERTY",
    id: match.exactMatchId,
    displayName: match.candidates[0].displayName
  });
  assert.equal(property.basics.bed_count, 2);
  assert.equal(property.valuation.predicted_price, 907500);
  assert.deepEqual(
    requests.map((request) => request.url.pathname),
    [
      "/v1/geocode/address",
      "/v1/properties/GANSW710347863/basics/all",
      "/v1/properties/GANSW710347863/valuation/avm"
    ]
  );
  assert(requests.every((request) => request.authorization === "Bearer test-team-key"));
});

test("does not offer or load a fact for a non-exact geocoder suggestion", async () => {
  const requests = [];
  const app = createWorker(async (url) => {
    const parsedUrl = new URL(url);
    requests.push(parsedUrl.pathname);
    return jsonResponse({
      data: [{ id: "GANSW999999999", display_name: "1 Wrong Street, Redfern (NSW)" }]
    });
  });
  await app.send({ type: "SAVE_API_KEY", apiKey: "test-team-key" });

  const match = await app.send({ type: "LOOKUP_ADDRESS", address: "304/9 Crystal Street, Waterloo" });
  assert.equal(match.candidates.length, 0);
  assert.equal(match.exactMatchId, null);
  assert.match(match.message, /none exactly matched/);
  assert.equal(requests.length, 1);
});

test("asks for confirmation if the API returns duplicate exact matches", async () => {
  const app = createWorker(async () => jsonResponse({
    data: [
      { id: "GANSW710347863", display_name: "UNIT 304/9 Crystal Street, Waterloo (NSW)" },
      { id: "GANSW710347864", display_name: "304/9 Crystal Street, Waterloo NSW 2017" }
    ]
  }));
  await app.send({ type: "SAVE_API_KEY", apiKey: "test-team-key" });

  const match = await app.send({
    type: "LOOKUP_ADDRESS",
    address: "304/9 Crystal Street, Waterloo NSW 2017"
  });
  assert.equal(match.candidates.length, 2);
  assert.equal(match.exactMatchId, null);
});

test("reports missing keys and rejects invalid input before making API calls", async () => {
  let requestCount = 0;
  const app = createWorker(async () => {
    requestCount += 1;
    return jsonResponse({ data: [] });
  });

  const missingKey = await app.send({ type: "LOOKUP_ADDRESS", address: "1 Main Street, Waterloo" });
  assert.match(missingKey.error, /team key/);

  const emptyAddress = await app.send({ type: "LOOKUP_ADDRESS", address: "  " });
  assert.match(emptyAddress.error, /address/);

  const tooLongAddress = await app.send({ type: "LOOKUP_ADDRESS", address: "x".repeat(251) });
  assert.match(tooLongAddress.error, /250 characters/);

  await app.send({ type: "SAVE_API_KEY", apiKey: "test-team-key" });
  const invalidId = await app.send({ type: "LOAD_PROPERTY", id: "../invalid", displayName: "Invalid" });
  assert.match(invalidId.error, /identifier is invalid/);
  assert.equal(requestCount, 0);
});

test("maps authentication, coverage, rate-limit, and server errors explicitly", async (t) => {
  const cases = [
    [401, {}, /rejected this team key/],
    [403, { detail: "Outside coverage" }, /Outside coverage/],
    [429, {}, /rate-limiting/],
    [500, { detail: "API unavailable" }, /API unavailable/]
  ];

  for (const [status, body, expectedMessage] of cases) {
    await t.test(`HTTP ${status}`, async () => {
      const app = createWorker(async () => jsonResponse(body, status));
      await app.send({ type: "SAVE_API_KEY", apiKey: "test-team-key" });
      const result = await app.send({ type: "LOOKUP_ADDRESS", address: "1 Main Street, Waterloo" });
      assert.match(result.error, expectedMessage);
    });
  }
});

test("reports network, timeout, malformed JSON, and invalid API envelopes", async (t) => {
  const cases = [
    ["network failure", async () => { throw new Error("offline"); }, /Could not reach the Microburbs API/],
    ["timeout", async () => {
      const error = new DOMException("timed out", "TimeoutError");
      throw error;
    }, /took too long/],
    ["malformed JSON", async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }), /unreadable response/],
    ["missing data envelope", async () => jsonResponse({ unexpected: true }), /did not contain a data field/]
  ];

  for (const [name, fetch, expectedMessage] of cases) {
    await t.test(name, async () => {
      const app = createWorker(fetch);
      await app.send({ type: "SAVE_API_KEY", apiKey: "test-team-key" });
      const result = await app.send({ type: "LOOKUP_ADDRESS", address: "1 Main Street, Waterloo" });
      assert.match(result.error, expectedMessage);
    });
  }
});

test("detects a unit-prefixed listing heading without reading general listing content", () => {
  const messages = [];
  const listener = {};
  const heading = {
    innerText: "70/830 Bourke Street, Waterloo NSW 2017",
    textContent: "",
    getClientRects: () => [1]
  };
  const document = {
    body: {},
    querySelectorAll: (selector) => selector === "h1" ? [heading] : []
  };

  class MutationObserver {
    observe() {}
  }

  vm.runInNewContext(
    fs.readFileSync(path.join(extensionPath, "content.js"), "utf8"),
    {
      chrome: {
        runtime: {
          sendMessage: async (message) => { messages.push(message); },
          onMessage: { addListener: (callback) => { listener.callback = callback; } }
        }
      },
      document,
      location: { href: "https://www.domain.com.au/listing" },
      window: { addEventListener() {} },
      MutationObserver,
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
      setTimeout,
      clearTimeout,
      console
    }
  );

  let response;
  listener.callback({ type: "GET_ADDRESS" }, {}, (value) => { response = value; });
  assert.equal(response.address, heading.innerText);
  assert(messages.some((message) => message.type === "ADDRESS_FOUND" && message.address === heading.innerText));

  const nonAddressHeading = { ...heading, innerText: "A wonderful home near the city" };
  document.querySelectorAll = (selector) => selector === "h1" ? [nonAddressHeading] : [];
  vm.runInNewContext(
    fs.readFileSync(path.join(extensionPath, "content.js"), "utf8"),
    {
      chrome: {
        runtime: {
          sendMessage: async (message) => { messages.push(message); },
          onMessage: { addListener: (callback) => { listener.callback = callback; } }
        }
      },
      document,
      location: { href: "https://www.domain.com.au/another-listing" },
      window: { addEventListener() {} },
      MutationObserver,
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
      setTimeout,
      clearTimeout,
      console
    }
  );

  listener.callback({ type: "GET_ADDRESS" }, {}, (value) => { response = value; });
  assert.equal(response.address, null);
});
