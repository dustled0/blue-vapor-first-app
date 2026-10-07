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

        // apostrophe
        await page.evaluate(() => commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{ name: "Lola's Pandesal", price: 5, category: 'Other Products' }]), 'x'));
        await page.locator('.product-card[data-name="lola\'s pandesal"] .quick-add').evaluate(e => e.click());
        check('apostrophe sale', await page.evaluate(() => transactions.at(-1).product) === "Lola's Pandesal");
    });
    finish();
})();
