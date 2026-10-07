# Product Management (add / edit / remove products in the app)

Date: 2026-10-07
Status: Design approved in chat, awaiting spec review

## Goal

Let the store owner manage the product catalog from inside the app instead of hand-editing `data.js`:

- Add products **one at a time** or **in bulk by pasting a list**.
- **Edit** a product's price, category, or hot-water setting, and **remove** products no longer sold.
- Changes apply **instantly in this browser** (and are included in Back up / Restore), and can be made **permanent everywhere** by downloading an updated `data.js` to replace the file and push to GitHub.

### Success criteria

- Adding a delivery of ~10 new items takes about a minute.
- A newly added product can be sold immediately.
- Past days, totals, and exports never change because of catalog edits.
- Phones work (no desktop-only APIs required).

### Decisions made with the owner

| Question | Decision |
|---|---|
| Where are new products saved? | Both: browser storage immediately, plus "Download data.js" to make them permanent |
| Bulk input style | Paste a list, one product per line, with a preview before saving |
| Scope | Add, edit (price / category / hot water), remove (hide) |
| Architecture | Option 1: a change layer on top of `data.js` |

### Assumptions (confirmed implicitly by approval)

- Product **names are not editable**. Sales are matched to products by name; to fix a typo, remove and re-add.
- Categories: pick an existing one or type a new one. Categories sort A–Z with "Other Products" last; products sort A–Z within a category (same rule `data.js` follows today).
- Hot water is a yes/no switch per product using the default fee (`HOT_WATER_FEE`, ₱5). Per-name overrides in `HOT_WATER_FEE_OVERRIDES` keep applying.
- Removing a product only hides it from selling. History, summaries, and exports keep its past sales at the price sold.

## 1. Data model and merge

### Stored change layer

One localStorage key, `honesty-store-catalog`:

```js
{
  added:   [{ name: 'Piattos', price: 15, category: 'Snacks', hotWater: false }],
  edited:  { 'Winston': { price: 12 }, 'Milo': { hotWater: false } }, // keyed by base product name, only changed fields
  removed: ['Cobra']                                                   // base product names
}
```

`data.js` remains the **base catalog** (`BASE_PRODUCTS` / `BASE_HOT_WATER_PRODUCTS`, captured once at load from the existing globals).

### buildCatalog()

Runs at load and after every catalog change:

1. Start from the base products (with `hotWater` derived from the base hot-water list).
2. Apply `edited` field overrides by name.
3. Drop names in `removed`.
4. Append `added` products.
5. Sort: categories A–Z with "Other Products" last; products A–Z within each category.
6. Refill the existing globals `PRODUCTS` (array of `{ name, price, category }`) and `HOT_WATER_PRODUCTS` (array of names) **in place** (`arr.length = 0; arr.push(...)`), so all current code (selling, summary, history, Excel, Top today, insights) keeps working unchanged.

`data.js` keeps declaring them with `const`; arrays declared `const` can still be emptied and refilled, so no declaration change is needed and any older copy of `data.js` keeps working. The base copies are deep-cloned once at startup, before the first `buildCatalog()`.

On load, `buildCatalog()` also **prunes** the change layer: edits equal to the base value, added products whose name now exists in the base with identical values, and removed names no longer in the base are dropped. This is what makes the layer empty out after the owner replaces `data.js` with a downloaded one.

### Invariants

- **Unique names**, compared case-insensitively with whitespace trimmed and collapsed. Adding an existing name is blocked; the preview offers updating it instead.
- Removing a **base** product adds it to `removed`. Removing an **added** product deletes it from `added`.
- An edit equal to the base value is dropped, so `edited` only holds real differences. Restoring a removed product deletes it from `removed`.
- After the owner replaces `data.js` with a downloaded one, the change layer is redundant: applying it again is a no-op. A later browser-only remove still hides the product.
- New products pushed to `data.js` from GitHub appear normally, unless this browser has an edit or removal for the same name, in which case the browser change wins.

### Effect on existing data

None. Transactions store product name and price at the time of sale. Backup/Restore already copies every `honesty-store*` key, so the catalog is included automatically.

## 2. UI

### Entry point

A **Products** button in the header next to History (inside the phone ••• menu at ≤480px). It opens a modal with three tabs using the existing `.summary-tab` chip style: **All products · Add one · Add many**.

### Tab: All products (edit and remove)

- Products grouped by category (same order as the selling screen), with a search box.
- Each row: name, then inline controls: **price** (₱ number input), **category** (dropdown of existing categories + "New category…"), **hot water** (yes/no switch).
- Changes save on blur / change (no Save button) with a small "Saved" toast.
- Rows show an **Added** tag (owner-added) or **Edited** tag (differs from `data.js`). Edited rows get a **Reset** link to restore the base values.
- Trash icon removes after a confirm: "Remove Cobra? Past sales are kept." Removed base products appear in a collapsed **Removed (n)** section at the bottom with a **Restore** button.

### Tab: Add one

- Fields: **Name**, **Price**, **Category** (dropdown + "New category…"), **Hot water** (off by default).
- Live validation. A duplicate name shows "Winston already exists · Edit it", linking to that row in All products.
- **Add product** saves, clears the form for the next entry, and shows a toast with **Undo**.

### Tab: Add many

- Paste box, one product per line: `Name, Price, Category[, hw]`.
  - Tabs are accepted as separators (copy from Excel).
  - Price may include `₱` and commas.
  - Missing category → "Other Products". Fourth value `hw` (case-insensitive) marks hot water.
- Live preview table, one row per line, with status:
  - **New**: will be added.
  - **Exists**: name already in the catalog. If price/category/hot water differ, it is offered as an **update** with a checkbox, unticked by default.
  - **Problem**: missing name, invalid price, or a name repeated within the paste. Skipped, with the reason shown.
- One button whose label reflects the counts ("Add 8 products", "Add 8 · Update 2"). Saves everything in one change with a toast and **Undo** for the whole batch.

### Shared footer

- Shown only when the change layer is non-empty: "**N changes not in data.js yet** · Download data.js".
- After a download it explains: replace `data.js` in the app folder and push to GitHub.

### Re-render

Every catalog change calls `buildCatalog()` then `renderAll()` (and re-applies the search filter and "Selling to" state), so new products can be sold immediately.

## 3. Edge cases and error handling

- **Index-based DOM ids** (`product-<idx>`, `body-<idx>`, `hw-<idx>`, bulk/guest inputs, Top today `quickTop(idx)`): after any catalog change the product list is fully re-rendered, so indices always match the current `PRODUCTS`. Top today recomputes indices by name. Unsaved typing inside an open product card is lost on re-render (already true after every sale).
- **Removed product currently open / in Top today**: its card disappears; Top today only lists products that still exist.
- **Hot water fee**: on → `hotWaterFee(name)` (default ₱5, per-name overrides still apply, including for added products whose name matches an override).
- **Categories**: new names are title-cased ("snacks" → "Snacks"). Categories with no products are not shown. Only Hot Water, Cigarettes, and Drinks keep their colored left edge; others render as plain cards.
- **Names**: trimmed, inner whitespace collapsed, ``<>"`\`` stripped, max 40 characters. Displayed via `esc()` / `jsArg()` so apostrophes are safe.
- **Price**: number > 0 and ≤ 99999 after stripping `₱`, commas, and spaces; decimals allowed.
- **Past sales**: never modified. Summary and History match by name as today.
- **Restore backup**: `honesty-store-catalog` follows the existing settings rule (only filled in when missing locally), so a restore never overwrites newer catalog changes.
- **Corrupt catalog JSON**: fall back to plain `data.js` and show a one-time warning toast; selling is never blocked.

## 4. Download data.js

- Generates a file named `data.js` that keeps the original header comments, `CUSTOMERS`, `HOT_WATER_FEE`, and `HOT_WATER_FEE_OVERRIDES` content, and rewrites `PRODUCTS` (sorted, one product per line, grouped by category comments) and `HOT_WATER_PRODUCTS`.
- The generated file must load in the app exactly like the current one (same global names and shapes).
- The "changes not in data.js yet" counter is the number of entries in the change layer (`added` + `edited` names + `removed`). Downloading does not reset it; it drops to 0 on its own once the downloaded file replaces `data.js` and the page is reloaded (pruning in section 1). Until then the footer shows the reminder to replace the file.

## 5. Testing

Run in a real browser (headless Chrome via Playwright, as with previous features):

1. Add one product → sellable at once, correct category and A–Z position, appears in Summary and the Excel export.
2. Paste a mixed list (new, existing-with-different-price, invalid price, duplicate within paste) → preview statuses and button counts correct; save; Undo the batch restores the previous catalog.
3. Edit a price → old transactions keep their old price; new sales use the new price.
4. Toggle hot water on/off → the fee is applied / not applied on the next sale.
5. Remove a base product → card gone, History still shows its past sales; Restore brings it back.
6. Download `data.js`, load it as the base → identical product list, change counter 0.
7. Back up, clear storage, restore → catalog changes return.
8. Names with apostrophes; no page errors; light mode, dark mode, and 390px phone width screenshots.

## Out of scope

- Renaming products.
- Stock / inventory quantities.
- Per-product custom hot-water fees from the UI.
- Managing the customer list from the UI.
