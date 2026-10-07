const { withPage, check, finish, URL } = require('./helpers');

(async () => {
    await withPage(null, async (page) => {
        check('Catalog loaded', await page.evaluate(() => typeof Catalog === 'object'));

        await page.evaluate(() => localStorage.setItem('honesty-store-catalog', JSON.stringify({
            added: [{ name: 'Piattos', price: 15, category: 'Snacks', hotWater: false }],
            edited: { Winston: { price: 12 } },
            removed: ['C2']
        })));
        await page.reload();
        check('added product card', await page.locator('.product-card[data-name="piattos"]').count() === 1);
        check('new category header', await page.locator('.category-header[data-category="snacks"]').count() === 1);
        const price = await page.locator('.product-card[data-name="winston"] .price-tag').first().textContent();
        check('edited price shown', price.includes('₱12'), price);
        check('removed product hidden', await page.locator('.product-card[data-name="c2"]').count() === 0);

        const total = await page.evaluate(() => {
            addTransaction('Piattos', 15, CUSTOMERS[0], 1, false, PRODUCTS.findIndex(p => p.name === 'Piattos'));
            return transactions.at(-1).totalPrice;
        });
        check('added product sellable', total === 15, String(total));

        await page.evaluate(() => localStorage.setItem('honesty-store-catalog', '{not json'));
        await page.reload();
        await page.waitForSelector('.toast.show');
        const count = await page.evaluate(() => PRODUCTS.length);
        check('corrupt data falls back to data.js', count === 58, String(count));
        const toast = await page.locator('#toast').textContent();
        check('corrupt data toast', toast.includes('could not be read'), toast);

        const backup = await page.evaluate(() => localStorage.getItem('honesty-store-catalog-corrupt-backup'));
        check('corrupt value backed up', backup === '{not json', String(backup));

        await page.evaluate(() => localStorage.removeItem('honesty-store-catalog'));
        await page.reload();
        await page.evaluate(() => commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{ name: 'Nova', price: 15, category: 'Snacks', hotWater: false }]), 'Added Nova'));
        check('commit adds Nova', await page.locator('.product-card[data-name="nova"]').count() === 1);
        await page.waitForSelector('.toast.show .toast-action');
        await page.locator('.toast .toast-action').click();
        check('undo removes Nova', await page.locator('.product-card[data-name="nova"]').count() === 0);
    });
    finish();
})();
