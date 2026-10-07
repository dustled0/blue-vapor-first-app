const { withPage, check, finish } = require('./helpers');

const sell = (page, name) => page.evaluate(n => document.querySelector(`.product-card[data-name="${n}"] .cust-btn`).click(), name);
const price = (page, n) => page.evaluate(x => PRODUCTS.find(p => p.name === x).price, n);
const openTab = async (page, label) => {
    await page.locator('.header-actions > button', { hasText: 'Products' }).click();
    await page.locator('#productsTabs button', { hasText: label }).click();
};

(async () => {
    await withPage(null, async (page) => {
        await openTab(page, 'Add one');
        check('button disabled when empty', await page.locator('#addSubmit').isDisabled());
        await page.locator('#addName').fill('Piattos');
        await page.locator('#addPrice').fill('15');
        await page.locator('#addCategory').selectOption('__new__');
        await page.locator('#confirmMessage input').fill('snacks');
        await page.locator('#confirmOk').click();
        check('new category selected', (await page.locator('#addCategory option:checked').textContent()) === 'Snacks');
        await page.locator('#addPrice').press('Enter');
        check('piattos card exists', await page.locator('.product-card[data-name="piattos"]').count() === 1);
        const hdrs = await page.$$eval('#productList .category-header', els => els.map(e => e.textContent.trim()));
        check('Snacks header', hdrs.some(h => h.includes('Snacks')), hdrs.join('|'));
        check('form cleared', await page.locator('#addName').inputValue() === '');
        check('focus back to name', await page.evaluate(() => document.activeElement.id) === 'addName');
        await sell(page, 'piattos');
        check('sale at 15', await page.evaluate(() => transactions.at(-1).totalPrice) === 15);

        await page.locator('#addName').fill(' winston ');
        await page.locator('#addPrice').fill('12');
        check('duplicate disabled', await page.locator('#addSubmit').isDisabled());
        check('duplicate message', (await page.locator('#addDupMsg').textContent()).includes('already exists'));
        await page.locator('#addDupMsg a').click();
        check('Edit it goes to All with search', await page.locator('#productsSearch').inputValue() === 'Winston');

        // Add many
        await page.locator('#productsTabs button', { hasText: 'Add many' }).click();
        await page.locator('#pasteBox').fill('Nova, 15, Snacks\r\nwinston, 12, Cigarettes\r\nChips, abc\r\nNova, 16\r\n\r\nKopiko Blanca\t10\tHot Water\thw');
        const st = await page.$$eval('#pastePreview .paste-status', els => els.map(e => e.textContent.trim().split(/\s/)[0]));
        check('statuses', st.join(',') === 'New,Exists,Problem,Problem,New', st.join(','));
        check('button Add 2', (await page.locator('#pasteSubmit').textContent()).trim() === 'Add 2 products');
        await page.locator('#pastePreview input[type=checkbox]').check();
        check('button Add 2 Update 1', (await page.locator('#pasteSubmit').textContent()).trim() === 'Add 2 products · Update 1');
        await page.locator('#pasteSubmit').click();
        check('nova card', await page.locator('.product-card[data-name="nova"]').count() === 1);
        check('kopiko card', await page.locator('.product-card[data-name="kopiko blanca"]').count() === 1);
        check('kopiko hot water', await page.evaluate(() => HOT_WATER_PRODUCTS.includes('Kopiko Blanca')));
        check('winston 12', await price(page, 'Winston') === 12);
        check('textarea cleared', await page.locator('#pasteBox').inputValue() === '');
        await page.locator('.toast .toast-action').click();
        check('undo removes nova', await page.locator('.product-card[data-name="nova"]').count() === 0);
        check('undo winston 11', await price(page, 'Winston') === 11);

        // Review focus 4
        await sell(page, 'winston');
        await page.evaluate(() => commitCatalog(Catalog.editProduct(BASE_CATALOG, catalogChanges, 'Winston', { price: 12 }), 'x'));
        await sell(page, 'winston');
        const ups = await page.evaluate(() => transactions.filter(t => t.product === 'Winston').map(t => t.unitPrice));
        check('old sale keeps 11, new 12', ups.join(',') === '11,12', ups.join(','));

        // Review focus 5
        await sell(page, 'c2');
        check('top today has C2', (await page.locator('#topToday').textContent()).includes('C2'));
        await page.evaluate(() => setSellTo(CUSTOMERS[0]));
        await page.evaluate(() => commitCatalog(Catalog.removeProduct(BASE_CATALOG, catalogChanges, 'C2'), 'x'));
        check('c2 card gone', await page.locator('.product-card[data-name="c2"]').count() === 0);
        check('top today no C2', !(await page.locator('#topToday').textContent()).includes('C2'));
        check('log still lists C2', (await page.locator('#txLogBody').textContent()).includes('C2'));

        // Fix round 1: ticks follow the product, not the row index
        await page.evaluate(() => commitCatalog(Catalog.resetProduct(catalogChanges, 'Winston'), 'x'));
        check('winston back to 11', await price(page, 'Winston') === 11);
        await page.evaluate(() => setProductsTab('many'));
        await page.locator('#pasteBox').fill('winston, 12, Cigarettes\nMilo, 10, Hot Water');
        await page.locator('#pastePreview input[type=checkbox]').first().check();
        await page.locator('#pasteBox').fill('Milo, 10, Hot Water\nwinston, 12, Cigarettes');
        const ticks = await page.$$eval('#pastePreview input[type=checkbox]', els => els.map(e => e.checked));
        check('only winston ticked after reorder', ticks.filter(Boolean).length === 1 && ticks.at(-1) === true, ticks.join(','));
        await page.locator('#pasteSubmit').click();
        check('winston updated to 12', await price(page, 'Winston') === 12);
        check('milo hot water unchanged', await page.evaluate(() => HOT_WATER_PRODUCTS.includes('Milo')));

        // Final fix 1: re-adding a removed base product restores it (C2 was removed above)
        check('c2 still removed', await page.locator('.product-card[data-name="c2"]').count() === 0);
        await page.evaluate(() => setProductsTab('many'));
        await page.locator('#pasteBox').fill('c2, 16, Drinks');
        const rst = await page.locator('#pastePreview .paste-status').textContent();
        check('paste chip says Restore', rst.trim() === 'Restore', rst);
        check('paste count Add 1', (await page.locator('#pasteSubmit').textContent()).trim() === 'Add 1 product');
        await page.evaluate(() => setProductsTab('one'));
        await page.locator('#addName').fill('C2');
        await page.locator('#addPrice').fill('16');
        check('restore message', (await page.locator('#addDupMsg').textContent()).includes('Adding it restores it'));
        check('restore enabled', !(await page.locator('#addSubmit').isDisabled()));
        await page.locator('#addSubmit').click();
        check('c2 card back', await page.locator('.product-card[data-name="c2"]').count() === 1);
        check('c2 at 16', await price(page, 'C2') === 16);
        check('c2 no longer removed', await page.evaluate(() => catalogRemoved.every(p => p.name !== 'C2') && catalogChanges.added.every(a => a.name !== 'C2')));

        // Final fix 2: category text is escaped on the selling screen
        await page.evaluate(() => commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{ name: 'Lays', price: 9, category: 'Snacks & Chips' }]), 'x'));
        const hdr = await page.locator('#productList .category-header[data-category="snacks & chips"] h2').textContent();
        check('category header text exact', hdr === 'Snacks & Chips', hdr);
        check('no img in category header', await page.locator('#productList .category-header img').count() === 0);

        // apostrophe
        await page.evaluate(() => commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{ name: "Lola's Pandesal", price: 5, category: 'Other Products' }]), 'x'));
        await page.locator('.product-card[data-name="lola\'s pandesal"] .quick-add').evaluate(e => e.click());
        check('apostrophe sale', await page.evaluate(() => transactions.at(-1).product) === "Lola's Pandesal");
    });
    finish();
})();
