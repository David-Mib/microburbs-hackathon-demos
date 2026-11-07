# Chrome Extension Setup: Microburbs Property Facts

A Chrome Manifest V3 side-panel extension for supported realestate.com.au and domain.com.au listings. It detects an address from a small set of address-specific page fields, matches it with the Microburbs API, and shows the matched home's estimated value, estimate range, confidence, and property basics.

For the full judge-facing submission guide—including architecture and flow diagrams, market positioning, ROI assumptions, evidence, known limitations and recommendations—see the [repository README](../README.md).

## Install for the hackathon

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Select **Load unpacked** and choose this `chrome-extension` folder.
3. Open a supported property listing and click the extension icon to open its side panel.
4. Paste your team's API key into **Connect your team key** and save it. The key is kept in this browser's extension storage and is not included in the source files.
5. Confirm the matched address when the API returns candidates. If automatic detection is unavailable, enter the listing address manually.

If Chrome says Developer mode is managed by your administrator, unpacked extensions are blocked by browser policy. Ask your administrator or use a browser profile where you are authorized to load a local extension; do not try to bypass the policy.

The extension needs network access to `https://api-ht.microburbs.com.au`. The API key is sent to that API by the extension service worker. It is not sent to the listing page. Remove the key from the panel when finished.

## Live demo and judge walkthrough

1. Open a supported property detail page and the extension side panel.
2. Check that the detected address matches the listing; enter it manually if detection is unavailable.
3. Run the lookup and verify the returned Microburbs address is an exact match before loading facts.
4. Show returned valuation and basics when available. Repeat on a listing with missing data to demonstrate that unavailable facts are not invented.
5. If testing a no-exact-match case, show that the extension stops before loading property facts. Do not present a non-exact candidate as the property.
6. Explain that API coverage and available fields vary, and keep the team key off camera.

For a complete presenter checklist, tested example addresses, judge checklist and suggested demo narration, see the [live-demo runbook in the repository README](../README.md#live-demo-runbook-for-the-presenter-and-judges). Recheck sample addresses against the live API shortly before recording because responses can change.

## Address and data handling

- The content script checks only explicit address-oriented selectors; it does not read listing descriptions, prices, agent details, or photos.
- The address is normalized for case, punctuation, state suffixes, common road abbreviations, and unit prefixes before matching. If no exact normalized match is available, suggestions are not selectable and no property facts are loaded.
- Property facts are requested only after an address has been matched.
- The supplied CSVs are not required by the extension and are not bundled or republished. Keep them local and use them only under the hackathon instructions.
- The API currently covers the City of Sydney. A property outside coverage or a field with no available data is reported as unavailable.

## Development checks

This is a no-build extension. Run its automated API-flow and address-extraction tests with:

```powershell
node --test
```

Check JavaScript syntax with:

```powershell
Get-ChildItem -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Validate the manifest and reload the extension from `chrome://extensions` after changing its files:

```powershell
Get-Content -Raw .\manifest.json | ConvertFrom-Json | Out-Null
```

## Pitch materials

- [`pitch-deck.html`](pitch-deck.html) is the editable six-slide customer-facing pitch. Open it in Chrome and print to PDF if you need to export it again.
- [`pitch-deck.pdf`](pitch-deck.pdf) is the ready-to-share presentation.
- [`report.html`](report.html) contains the fuller buyer-value and product comparison report.
