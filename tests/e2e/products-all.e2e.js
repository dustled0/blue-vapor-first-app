const { withPage, check, finish } = require('./helpers');
const fs = require('fs');

(async () => {
    await withPage(null, async (page) => {
        await page.locator('.header-actions > button', { hasText: 'Products' }).click();
        check('modal opens', await page.locator('#productsModal.open').count() === 1);

        const row = n => page.locator(`#productsContent .prow[data-name="${n}"]`);
        const price = n => page.evaluate(x => PRODUCTS.find(p => p.name === x).price, n);

        await row('winston').locator('.prow-price').fill('12');
        await row('winston').locator('.prow-price').dispatchEvent('change');
        check('winston price 12', await price('Winston') === 12);
        check('row shows Edited', (await row('winston').textContent()).includes('Edited'));
        const footer = await page.locator('#productsFooter').textContent();
        check('footer shows 1 change', footer.includes('1 change'), footer);

        await row('winston').locator('.prow-reset').click();
        check('reset restores 11', await price('Winston') === 11);
        check('footer hidden after reset', await page.locator('#productsFooter').isHidden());

        await row('milo').locator('.prow-hw').uncheck();
        check('milo hot water off', await page.evaluate(() => !HOT_WATER_PRODUCTS.includes('Milo')));

        await row('c2').locator('.prow-del').click();
        await page.locator('#confirmOk').click();
        check('c2 gone from cards', await page.locator('.product-card[data-name="c2"]').count() === 0);
        const removed = await page.locator('#productsContent details.prow-removed').textContent();
        check('Removed (1) lists C2', removed.includes('Removed (1)') && removed.includes('C2'), removed);
        await page.locator('#productsContent details.prow-removed summary').click();
        await page.locator('#productsContent details.prow-removed button', { hasText: 'Restore' }).click();
        check('c2 restored', await page.locator('.product-card[data-name="c2"]').count() === 1);

        await page.locator('#productsSearch').fill('kop');
        const vis = await page.$$eval('#productsContent .prow', els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.name));
        check('search filters rows', vis.length > 0 && vis.every(n => n.includes('kop')), vis.join(','));
        await page.locator('#productsSearch').fill('');

        await row('winston').locator('.prow-price').fill('abc');
        await row('winston').locator('.prow-price').dispatchEvent('change');
        check('invalid price unchanged', await price('Winston') === 11);
        check('invalid price reverts input', await row('winston').locator('.prow-price').inputValue() === '11');

        await row('winston').locator('.prow-price').fill('13');
        await row('winston').locator('.prow-price').dispatchEvent('change');
        const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#productsFooter a, #productsFooter button').first().click()]);
        check('download name', dl.suggestedFilename() === 'data.js', dl.suggestedFilename());
        const text = fs.readFileSync(await dl.path(), 'utf8');
        const w = new Function(text + '; return PRODUCTS.find(p => p.name === "Winston");')();
        check('downloaded data has edited price', w && w.price === 13, JSON.stringify(w));
    });

    await withPage({ width: 390, height: 800 }, async (page) => {
        await page.locator('#moreBtn').click();
        await page.locator('#moreMenu button', { hasText: 'Products' }).click();
        check('phone menu opens modal', await page.locator('#productsModal.open').count() === 1);
    });
    finish();
})();
