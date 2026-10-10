const { withPage, check, finish } = require('./helpers');

(async () => {
    await withPage(null, async (page) => {
        const idx = await page.evaluate(() => PRODUCTS.findIndex(p => p.name === 'Lucky Me Noodles - Beef'));
        const card = page.locator(`#product-${idx}`);
        check('noodle card has Cook toggle', await card.locator(`#cook-${idx}`).count() === 1);
        const other = await page.evaluate(() => PRODUCTS.findIndex(p => p.category !== 'Noodles'));
        check('non-noodle has no Cook toggle', await page.locator(`#cook-${other}`).count() === 0);
        check('cook off by default', !(await card.locator(`#cook-${idx}`).isChecked()));

        await card.locator('.product-header').click();
        await card.locator('.cust-btn').first().click();
        let tx = await page.evaluate(() => transactions.at(-1));
        check('uncooked price 12', tx.totalPrice === 12 && !tx.cooked, JSON.stringify(tx));

        if (!(await page.locator(`#body-${idx}`).isVisible())) await page.locator(`#product-${idx} .product-header`).click();
        await page.locator(`#product-${idx} label[for="cook-${idx}"]`).click();
        check('cook toggle checks', await page.locator(`#cook-${idx}`).isChecked());
        await page.locator(`#product-${idx} .cust-btn`).first().click();
        tx = await page.evaluate(() => transactions.at(-1));
        check('cooked adds +10 per item', tx.cooked === true && tx.unitPrice === 22 && tx.totalPrice === 22 * tx.qty, JSON.stringify(tx));
        const log = await page.locator('#txLogBody').textContent();
        check('log shows (+Cook)', log.includes('(+Cook)'));
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: require('path').join(__dirname, 'out', 'noodles-cook.png') });
    });
    finish();
})();
