# Product Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner add products (one or a pasted list), edit price / category / hot water, and remove products from inside the app, saved in the browser and downloadable as an updated `data.js`.

**Architecture:** A new pure-logic file `catalog.js` (no DOM) owns the change layer: building the effective catalog from `data.js` + stored changes, mutations, paste parsing, and `data.js` generation. It is unit-tested with Node's built-in test runner. `index.html` holds the glue (load/save, refilling `PRODUCTS` / `HOT_WATER_PRODUCTS` in place, undo) and the Products modal UI, verified with Playwright end-to-end scripts driving headless Chrome.

**Tech Stack:** Vanilla JS (no build), localStorage, `node --test` for `catalog.js`, Playwright (`connectOverCDP`) against Windows Chrome for UI.

**Spec:** `docs/superpowers/specs/2026-10-07-product-management-design.md`

## Global Constraints

- No build tools, no framework, no new runtime dependencies. `catalog.js` loads with a plain `<script src="catalog.js"></script>` after `data.js`.
- `catalog.js` must work both as a browser global (`window.Catalog`) and as a Node module (`module.exports = Catalog`) so tests can `require` it.
- Storage key: `honesty-store-catalog`, value `{ added: [], edited: {}, removed: [] }`.
- `data.js` keeps `const PRODUCTS` / `const HOT_WATER_PRODUCTS`; the app refills them in place (`arr.length = 0; arr.push(...)`), never reassigns.
- Sort rule: categories A–Z with `'Other Products'` last; products A–Z within a category (case-insensitive).
- Names: trim, collapse inner whitespace, strip `` <>"`\ ``, max 40 chars; uniqueness compared case-insensitively.
- Price: strip `₱`, commas, spaces; must be a number `> 0` and `<= 99999`; decimals allowed.
- New category names are title-cased (`snacks` → `Snacks`); missing category in a paste → `Other Products`.
- Hot water: yes/no only; fee always from existing `hotWaterFee(name)`.
- Every name rendered into HTML uses `esc()`; every name passed in an inline `onclick` uses `jsArg()` (both already exist in `index.html`).
- UI copy has no em-dashes. Follow CLAUDE.md conventions (CSS variables, dark mode via `body.dark-mode`, `modalConfirm()` / `showToast()`, `saveToStorage()` before `renderAll()`).
- Past transactions are never modified by catalog changes.

## Review Focus

1. **Corrupt `honesty-store-catalog` JSON**: app must fall back to plain `data.js`, show one warning toast, and still sell. Test in Task 2 (e2e).
2. **Paste copied from Excel / Windows**: CRLF line endings, tab separators, blank and whitespace-only lines, trailing commas. Expected: parsed like comma lines, blank lines ignored. Test in Task 3.
3. **Case/whitespace duplicates** (`"winston "`, `"WINSTON"`): treated as the existing Winston everywhere (add-one blocks, paste marks `exists`/`same`). Tests in Tasks 1 and 3.
4. **Editing a price after sales exist**: today's earlier sales keep their old `unitPrice`/`totalPrice`; next sale uses the new price. Test in Task 5 (e2e).
5. **Removing a product that is in "Top today" or open while "Selling to" is set**: card and Top today entry disappear with no page error; its past sales still show in Recent Transactions. Test in Task 5 (e2e).

---

## File Structure

- Create `catalog.js`: pure catalog logic (`window.Catalog` / `module.exports`).
- Create `tests/catalog.test.js`: `node --test` unit tests for `catalog.js`.
- Create `tests/e2e/package.json` (dependency `playwright@1`), `tests/e2e/run.sh` (starts server + Chrome, runs one e2e file, cleans up), `tests/e2e/*.e2e.js`.
- Modify `index.html`: script tag, catalog glue in the `<script>`, Products modal markup + CSS, header button + More-menu item.
- Modify `sw.js`: add `./catalog.js` to `APP_FILES`, bump `CACHE` to `honesty-store-v2`.
- Modify `.gitignore`: `tests/e2e/node_modules/`.
- Modify `CLAUDE.md`: document the feature (Task 6).

## E2E harness (used by Tasks 2, 4, 5, 6)

WSL has no Chrome libraries, so e2e tests run with **Windows** Node against **Windows** Chrome:

- `tests/e2e/run.sh <file.e2e.js>`:
  1. `cd tests/e2e && npm install --silent` if `node_modules` is missing.
  2. Start `python3 -m http.server 8765 --bind 0.0.0.0` from the repo root (background).
  3. Start `"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir='C:\Windows\Temp\hs-e2e-profile'` (background), wait until `curl localhost:8765/index.html` succeeds and 2 s have passed.
  4. Run `"/mnt/c/Program Files/nodejs/node.exe" "$(wslpath -w tests/e2e/<file>)"`; capture its exit code.
  5. Always clean up: kill the http.server PID; stop Chrome processes whose command line contains `hs-e2e-profile` via `powershell.exe Get-CimInstance Win32_Process ... | Stop-Process`. Exit with the test's code.
- Each `*.e2e.js` connects with `chromium.connectOverCDP('http://localhost:9333')`, uses a fresh `newContext()`, opens `http://localhost:8765/index.html`, clears localStorage and reloads, collects `pageerror` events, and **exits 1** if any assertion fails or any page error occurred, printing `PASS <name>` / `FAIL <name>: <reason>` per check. A shared `tests/e2e/helpers.js` exports `{ withPage(viewport, fn), check(name, cond, detail) , finish() }`.

---

### Task 1: Catalog core (build, sort, normalize, mutations)

**Files:**
- Create: `catalog.js`
- Create: `tests/catalog.test.js`
- Modify: `.gitignore` (add `tests/e2e/node_modules/`)

**Interfaces:**
- Produces (all on `Catalog`, all pure; inputs never mutated):
  - `cleanName(raw: string): string`
  - `nameKey(name: string): string` → `cleanName(name).toLowerCase()`
  - `parsePrice(raw: string|number): number|null`
  - `titleCase(s: string): string`
  - `emptyChanges(): {added: Item[], edited: {[name]: Partial<{price, category, hotWater}>}, removed: string[]}`
  - `sortProducts(list: Product[]): Product[]` where `Product = {name, price, category}`
  - `build(base: {products: Product[], hotWater: string[]}, changes) : {products: Product[], hotWater: string[], changes, info: {[name]: 'added'|'edited'}, removedBase: Product[]}` (`changes` returned is pruned; `removedBase` lists base products currently removed, for the Restore section)
  - `addProducts(base, changes, items: Item[]): changes` where `Item = {name, price, category, hotWater: boolean}`; skips items whose `nameKey` already exists in the built catalog
  - `editProduct(base, changes, name, fields: {price?, category?, hotWater?}): changes` (added product → edit inside `added`; base product → store only fields differing from base)
  - `removeProduct(base, changes, name): changes` (added → delete from `added`; base → push to `removed`, drop its `edited`)
  - `restoreProduct(changes, name): changes`
  - `resetProduct(changes, name): changes` (delete `edited[name]`)
  - `changeCount(changes): number` → `added.length + Object.keys(edited).length + removed.length`

- [ ] **Step 1: Write failing tests** in `tests/catalog.test.js` (`const test = require('node:test'); const assert = require('node:assert/strict'); const Catalog = require('../catalog.js');`) with a small base: `products: [{name:'Winston',price:11,category:'Cigarettes'},{name:'Milo',price:10,category:'Hot Water'},{name:'Ajinomoto',price:8,category:'Other Products'},{name:'C2',price:15,category:'Drinks'}]`, `hotWater: ['Milo']`. Tests:
  - `cleanName('  Lola\'s   <b>Pan</b> ')` → `"Lola's bPan/b"`; a 50-char name → length 40.
  - `nameKey('  WINSTON ')` → `'winston'`.
  - `parsePrice('₱1,200')` → `1200`; `parsePrice('12.5')` → `12.5`; `parsePrice('0')`, `parsePrice('abc')`, `parsePrice('100000')`, `parsePrice('')` → `null`.
  - `titleCase('snacks and chips')` → `'Snacks And Chips'`.
  - `build(base, emptyChanges())` → categories order `['Cigarettes','Drinks','Hot Water','Other Products']`, hotWater `['Milo']`, `info` `{}`.
  - add `{name:'Piattos',price:15,category:'Snacks',hotWater:false}` → category order becomes `Cigarettes, Drinks, Hot Water, Snacks, Other Products` (Other Products is always last); `info.Piattos === 'added'`.
  - `addProducts` with name `' winston'` → changes unchanged (duplicate skipped).
  - `editProduct(base, c, 'Winston', {price: 12})` → `edited.Winston` `{price:12}`; then `editProduct(..., {price: 11})` → `edited` has no `Winston` (equal to base dropped).
  - `editProduct(..., 'Milo', {hotWater:false})` → built `hotWater` excludes `'Milo'`.
  - `removeProduct(base, c, 'C2')` → built products exclude C2, `removedBase` contains C2; `restoreProduct` brings it back.
  - `removeProduct` on an added product removes it from `added` and does not touch `removed`.
  - Pruning: `build(base, {added:[{name:'Winston',price:11,category:'Cigarettes',hotWater:false}], edited:{Milo:{price:10}}, removed:['Gone']})` → returned `changes` equals `emptyChanges()`.
  - Browser override wins: base later contains `Piattos` price 14 while changes edit `Piattos` price 15 → built price 15.
  - `changeCount` of `{added:[x], edited:{a:{}}, removed:['b']}` → 3.

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '../catalog.js'`

- [ ] **Step 3: Implement `catalog.js`** as an IIFE assigning `const Catalog = {...}` then `if (typeof module !== 'undefined') module.exports = Catalog; else window.Catalog = Catalog;`. Category comparison for sorting uses `localeCompare` on title-cased categories with `'Other Products'` forced last. Add `tests/e2e/node_modules/` to `.gitignore`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/`
Expected: all tests PASS, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add catalog.js tests/catalog.test.js .gitignore
git commit -m "feat: add pure catalog logic for in-app product management"
```

---

### Task 2: Wire the catalog into the app (load, apply, undo, corrupt fallback) + e2e harness

**Files:**
- Modify: `index.html` (script tag after `data.js` at line 15; glue functions near `// ============ STATE ============`; init before `migrateUtcDates();` at ~line 4271)
- Modify: `sw.js` (`APP_FILES` add `'./catalog.js'`, `CACHE = 'honesty-store-v2'`)
- Create: `tests/e2e/package.json`, `tests/e2e/run.sh`, `tests/e2e/helpers.js`, `tests/e2e/catalog-load.e2e.js`

**Interfaces:**
- Consumes: Task 1 `Catalog.*`.
- Produces (globals in `index.html`):
  - `const BASE_CATALOG = { products: PRODUCTS.map(p => ({...p})), hotWater: [...HOT_WATER_PRODUCTS] }` captured before the first apply.
  - `let catalogChanges` and `let catalogInfo` (`{[name]: 'added'|'edited'}`) and `let catalogRemoved` (`Product[]`).
  - `const CATALOG_KEY = \`${STORAGE_KEY}-catalog\``
  - `loadCatalog(): void` — reads `CATALOG_KEY`; on JSON error or wrong shape uses `Catalog.emptyChanges()` and calls `showToast('Saved product changes could not be read. Using data.js.', 'undo')` once (after first render).
  - `applyCatalog(): void` — `Catalog.build(BASE_CATALOG, catalogChanges)`, refills `PRODUCTS` and `HOT_WATER_PRODUCTS` in place, stores pruned changes (removes the key when `changeCount` is 0), sets `catalogInfo` / `catalogRemoved`.
  - `commitCatalog(newChanges, message: string): void` — snapshots previous changes, sets `catalogChanges`, `applyCatalog()`, `renderAll()`, `filterProducts()`, calls `renderProductsModal()` if defined and the modal is open, then `showToast(message, 'info', { label: 'Undo', onClick: () => commitCatalog(prev, 'Product change undone') })`.

- [ ] **Step 1: Write the e2e harness and failing test** `tests/e2e/catalog-load.e2e.js` with checks:
  - `typeof Catalog === 'object'` in the page.
  - Setting `localStorage['honesty-store-catalog'] = JSON.stringify({added:[{name:'Piattos',price:15,category:'Snacks',hotWater:false}],edited:{Winston:{price:12}},removed:['C2']})` then reload → a `.product-card[data-name="piattos"]` exists, `.category-header[data-category="snacks"]` exists, Winston card price tag shows `₱12`, no `[data-name="c2"]` card.
  - `addTransaction('Piattos', 15, CUSTOMERS[0], 1, false, PRODUCTS.findIndex(p => p.name === 'Piattos'))` → `transactions.at(-1).totalPrice === 15`.
  - Setting the key to `'{not json'` then reload → page loads, product count equals `data.js` count (58), toast text contains `could not be read`, no page errors.
  - `commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{name:'Nova',price:15,category:'Snacks',hotWater:false}]), 'Added Nova')` then clicking `.toast .toast-action` → no Nova card.

- [ ] **Step 2: Run, verify it fails**

Run: `bash tests/e2e/run.sh catalog-load.e2e.js`
Expected: exit 1, `FAIL` on `typeof Catalog`

- [ ] **Step 3: Implement** the script tag, glue functions, init call order (`loadCatalog(); applyCatalog();` before `migrateUtcDates();`), and the `sw.js` change.

- [ ] **Step 4: Run, verify it passes**

Run: `bash tests/e2e/run.sh catalog-load.e2e.js` and `node --test tests/`
Expected: all `PASS`, exit 0; unit tests still pass

- [ ] **Step 5: Commit**

```bash
git add index.html sw.js tests/e2e
git commit -m "feat: load product catalog changes from browser storage"
```

---

### Task 3: Paste parsing and data.js generation (pure)

**Files:**
- Modify: `catalog.js`
- Modify: `tests/catalog.test.js`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces:
  - `Catalog.parsePaste(text: string, products: Product[], hotWater: string[]): Row[]` where `Row = {line: number, raw: string, name, price, category, hotWater: boolean, status: 'new'|'exists'|'same'|'problem', reason?: string, diff?: {price?, category?, hotWater?}}`. `line` is 1-based over non-blank lines' original line numbers. `exists` = name present and at least one field differs (diff lists the differing new values); `same` = present with no differences.
  - `Catalog.toDataJs({products: Product[], hotWater: string[], customers: string[], fee: number, overrides: object}): string`

- [ ] **Step 1: Write failing tests**:
  - `parsePaste('Piattos, 15, Snacks\r\nNova\t₱15\tsnacks\r\n\r\n  \r\nKopiko Blanca, 10, Hot Water, HW\r\n', base.products, base.hotWater)` → 3 rows; statuses `new,new,new`; row 2 category `'Snacks'`; row 3 `hotWater === true`; row line numbers `1,2,5`.
  - Missing category → `'Other Products'`; trailing comma `'Chippy, 12,'` → category `'Other Products'`, status `new`.
  - `'winston, 12, Cigarettes'` → `exists`, `diff` `{price: 12}`; `'WINSTON, 11, cigarettes'` → `same`.
  - `', 10, Snacks'` → `problem`, reason `'Missing name'`; `'Chips, abc'` → `problem`, reason `'Price must be a number above 0'`; `'Chips'` (no price) → `problem` same reason.
  - Same name twice in one paste → second row `problem`, reason `'Listed twice'`.
  - `toDataJs(...)` output, evaluated with `new Function(src + '; return {PRODUCTS, HOT_WATER_PRODUCTS, CUSTOMERS, HOT_WATER_FEE, HOT_WATER_FEE_OVERRIDES};')()`, deep-equals the input (products sorted), declares with `const`, contains a `// Snacks (A-Z)` comment line, and starts with the existing header comment `// ============ DATA ============`.

- [ ] **Step 2: Run, verify fail** — `node --test tests/` → FAIL `Catalog.parsePaste is not a function`

- [ ] **Step 3: Implement** in `catalog.js`. Split lines on `/\r?\n/`; per line split on tab if it contains a tab, else on comma; trim cells; fourth cell `hw` (case-insensitive) sets hot water. `toDataJs` reproduces the current `data.js` layout: header comment block (4 lines, verbatim from current `data.js`), `HOT_WATER_PRODUCTS` wrapped at ~5 names per line, `PRODUCTS` with a `// <Category> (A-Z)` comment before each group and one `{ name: '...', price: N, category: '...' }` per line (single quotes, `'` escaped as `\'`), then `// Customers (A-Z)`, `CUSTOMERS`, `HOT_WATER_FEE`, the overrides comment and `HOT_WATER_FEE_OVERRIDES`.

- [ ] **Step 4: Run, verify pass** — `node --test tests/` → `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add catalog.js tests/catalog.test.js
git commit -m "feat: parse pasted product lists and generate data.js"
```

---

### Task 4: Products modal shell + "All products" tab (edit, remove, restore, reset, download)

**Files:**
- Modify: `index.html` (header button after History; More-menu item; modal markup next to `#debtModal`; CSS block before `/* ===== RESPONSIVE ===== */`; JS section `// ============ PRODUCTS MODAL ============`)
- Create: `tests/e2e/products-all.e2e.js`

**Interfaces:**
- Consumes: Task 2 `commitCatalog`, `catalogInfo`, `catalogRemoved`, `BASE_CATALOG`, `catalogChanges`; Task 1 `editProduct/removeProduct/restoreProduct/resetProduct/changeCount`; Task 3 `toDataJs`.
- Produces:
  - Markup `#productsModal` (`.modal-overlay` > `.modal`), `#productsTabs`, `#productsContent`, `#productsFooter`.
  - `let productsTab = 'all'`; `openProducts(tab = 'all')`, `closeProducts()`, `setProductsTab(tab)`, `renderProductsModal()` (renders tabs, active tab via `renderProductsAll()` / `renderProductsAddOne()` / `renderProductsAddMany()`, and footer).
  - `renderProductsAll()`; handlers `onProductPrice(name, input)`, `onProductCategory(name, select)`, `onProductHotWater(name, checkbox)`, `confirmRemoveProduct(name)` (async, `modalConfirm('Remove Product', \`Remove ${name}? Past sales are kept.\`, 'danger', 'delete', 'Remove', 'Cancel')`), `restoreRemovedProduct(name)`, `resetEditedProduct(name)`.
  - `downloadDataJs()` — Blob download named `data.js` from `Catalog.toDataJs({products: PRODUCTS, hotWater: HOT_WATER_PRODUCTS, customers: CUSTOMERS, fee: HOT_WATER_FEE, overrides: HOT_WATER_FEE_OVERRIDES})`; toast `Downloaded data.js. Replace the file in the app folder, then push to GitHub.`
  - `renderProductsAddOne()` / `renderProductsAddMany()` exist as stubs rendering an empty note (filled in Task 5).
- Behavior pinned by spec: tabs use `.summary-tab`; rows grouped by category with a search input (`#productsSearch`, filters by name); price input validated with `Catalog.parsePrice` on `change` (invalid → revert value + toast `Price must be a number above 0`); category `<select>` lists current categories + `New category…` (choosing it opens `modalPrompt('New Category', 'Name of the new category', '', 'category')` and title-cases the answer); hot-water checkbox; tags `Added` / `Edited`; `Reset` link only on edited base rows; trash icon; collapsed `<details>` "Removed (n)" with Restore buttons; footer shown only when `Catalog.changeCount(catalogChanges) > 0`: `N change(s) not in data.js yet · Download data.js`. `modalPrompt` currently forces `type="number"`: add an optional 5th param `inputType = 'number'` and pass `'text'` here.

- [ ] **Step 1: Write failing e2e** `products-all.e2e.js`:
  - Click header `Products` button → `#productsModal.open`.
  - Change Winston price input to `12` and dispatch `change` → `PRODUCTS.find(p=>p.name==='Winston').price === 12`, row shows `Edited`, footer text contains `1 change`.
  - Click Reset on Winston → price `11`, footer hidden.
  - Uncheck Milo hot water → `HOT_WATER_PRODUCTS.includes('Milo') === false`.
  - Remove C2 (click trash, `#confirmOk`) → no `.product-card[data-name="c2"]`; `Removed (1)` section contains C2; Restore → card back.
  - Type `kop` in `#productsSearch` → only rows whose name contains `kop` visible.
  - Price `abc` → value reverts, price unchanged.
  - Download: `page.waitForEvent('download')` on clicking footer link (after one edit) → suggested filename `data.js`; file content evaluated via `new Function` yields `PRODUCTS` containing Winston at the edited price.
  - At 390px width: `#moreBtn` menu contains a `Products` item that opens the modal.

- [ ] **Step 2: Run, verify fail** — `bash tests/e2e/run.sh products-all.e2e.js` → exit 1

- [ ] **Step 3: Implement** markup, CSS (rows as a grid: name+tags / price / category / hot water / trash; dark mode via existing variables), JS above.

- [ ] **Step 4: Run, verify pass** — `bash tests/e2e/run.sh products-all.e2e.js` and `bash tests/e2e/run.sh catalog-load.e2e.js` → both exit 0

- [ ] **Step 5: Commit**

```bash
git add index.html tests/e2e/products-all.e2e.js
git commit -m "feat: products modal with inline edit, remove, restore and data.js download"
```

---

### Task 5: "Add one" and "Add many" tabs

**Files:**
- Modify: `index.html` (replace the Task 4 stubs)
- Create: `tests/e2e/products-add.e2e.js`

**Interfaces:**
- Consumes: Task 4 modal (`renderProductsModal`, `setProductsTab`), Task 2 `commitCatalog`, Task 1 `addProducts/editProduct/nameKey/parsePrice/titleCase`, Task 3 `parsePaste`.
- Produces: `renderProductsAddOne()`, `submitAddOne()`, `renderProductsAddMany()`, `updatePastePreview()`, `submitAddMany()`; `let pasteRows = []` and a `Set` of row indices ticked for update.
- Behavior pinned by spec:
  - Add one: inputs `#addName`, `#addPrice`, `#addCategory` (select + `New category…`), `#addHotWater` (unchecked); live message under name for duplicates: `<Name> already exists · Edit it` where "Edit it" switches to the All tab with `#productsSearch` prefilled. Button `Add product` disabled until name non-empty, not duplicate, price valid. On submit: `commitCatalog(..., \`Added ${name}\`)`, form cleared, focus back to `#addName`.
  - Add many: `<textarea id="pasteBox">` with placeholder showing the 3 example lines from the spec; preview table updates on `input`; status chips `New` (green), `Exists` (blue, with an update checkbox unticked by default and the diff shown e.g. `₱11 → ₱12`), `Same` (muted, "No change"), `Problem` (red, reason). Submit button `#pasteSubmit` label: `Add N products`, plus ` · Update M` when M > 0; disabled when both are 0. Submit applies adds and ticked updates in one `commitCatalog(..., \`Added N, updated M products\`)` (single Undo), then clears the textarea.

- [ ] **Step 1: Write failing e2e** `products-add.e2e.js`:
  - Add one `Piattos` / `15` / New category `Snacks` → `.product-card[data-name="piattos"]` exists under a `Snacks` header; selling it via its first `.cust-btn` records `totalPrice 15`.
  - Add one name `' winston '` → button disabled and message contains `already exists`.
  - Paste `'Nova, 15, Snacks\r\nwinston, 12, Cigarettes\r\nChips, abc\r\nNova, 16\r\n\r\nKopiko Blanca\t10\tHot Water\thw'` → preview statuses `New, Exists, Problem, Problem, New`; button text `Add 2 products`; tick the Winston update → `Add 2 products · Update 1`; submit → Nova and Kopiko Blanca cards exist, `HOT_WATER_PRODUCTS` includes `Kopiko Blanca`, Winston price 12; click toast Undo → Nova gone and Winston 11 (single undo for the batch).
  - Review Focus 4: record a Winston sale at 11, edit Winston to 12, record another → first transaction `unitPrice 11`, second `12`.
  - Review Focus 5: record a C2 sale (Top today shows C2), set `setSellTo(CUSTOMERS[0])`, remove C2 → no C2 card, Top today has no `C2`, Recent Transactions still lists `C2`, no page errors.
  - Name `Lola's Pandesal` added and sold via its `.quick-add` → no page errors.

- [ ] **Step 2: Run, verify fail** — `bash tests/e2e/run.sh products-add.e2e.js` → exit 1

- [ ] **Step 3: Implement** both tabs.

- [ ] **Step 4: Run, verify pass** — all three e2e files and `node --test tests/` pass

- [ ] **Step 5: Commit**

```bash
git add index.html tests/e2e/products-add.e2e.js
git commit -m "feat: add single products and pasted product lists"
```

---

### Task 6: Backup round trip, visual check, docs

**Files:**
- Create: `tests/e2e/products-backup.e2e.js`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above; existing `backupAll()` / `restoreBackup()`.

- [ ] **Step 1: Write e2e** `products-backup.e2e.js`:
  - Add `Piattos` via `commitCatalog`, run `backupAll()` and save the download; new context, clear storage, restore that file via `#restoreFile` + `#confirmOk` → Piattos card exists.
  - Restore into a browser that already has a different catalog (`Nova` added) → Nova still present, Piattos absent (settings only fill when missing).
  - Screenshots `products-light.png`, `products-dark.png` (after `toggleDarkMode()`), `products-phone.png` (390×844) of the open Products modal saved under the e2e folder's `out/` (gitignored: add `tests/e2e/out/` to `.gitignore`).

- [ ] **Step 2: Run** — `bash tests/e2e/run.sh products-backup.e2e.js` → exit 0. Open the three screenshots and confirm the modal is readable in both themes and at phone width (no horizontal scroll, controls not clipped). Fix CSS if not, re-run.

- [ ] **Step 3: Update `CLAUDE.md`**: File Structure gains `catalog.js` (pure catalog logic) and `tests/` (how to run `node --test tests/` and `bash tests/e2e/run.sh <file>`); Architecture gains a **Product catalog** bullet (change layer key, `BASE_CATALOG`, `applyCatalog()` refills arrays in place, `commitCatalog()` for every change with Undo, Products modal tabs, `downloadDataJs()`, pruning after replacing `data.js`); the Data layer bullet notes products can also be changed in-app.

- [ ] **Step 4: Run everything** — `node --test tests/` and each `bash tests/e2e/run.sh <file>` for all four e2e files → all exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/products-backup.e2e.js CLAUDE.md .gitignore
git commit -m "test: product catalog backup round trip; docs for product management"
```
