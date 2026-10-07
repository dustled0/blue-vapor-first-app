const { withPage, check, finish } = require('./helpers');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const card = (page, n) => page.locator(`.product-card[data-name="${n}"]`).count();
const add = (page, name, price, category) => page.evaluate(([n, p, c]) =>
    commitCatalog(Catalog.addProducts(BASE_CATALOG, catalogChanges, [{ name: n, price: p, category: c, hotWater: false }]), 'Added'), [name, price, category]);

async function restore(page, file) {
    await page.locator('#restoreFile').setInputFiles(file);
    await page.locator('#confirmOk').click();
    await page.waitForTimeout(300);
}

(async () => {
    let backupFile;
    await withPage(null, async (page) => {
        await add(page, 'Piattos', 15, 'Other Products');
        const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => backupAll())]);
        backupFile = path.join(OUT, 'backup.json');
        await dl.saveAs(backupFile);
        const data = JSON.parse(fs.readFileSync(backupFile, 'utf8')).data;
        check('backup includes catalog key', 'honesty-store-catalog' in data);
    });

    await withPage(null, async (page) => {
        check('fresh browser has no piattos', await card(page, 'piattos') === 0);
        await restore(page, backupFile);
        check('restore brings piattos back', await card(page, 'piattos') === 1);
    });

    await withPage(null, async (page) => {
        await add(page, 'Nova', 15, 'Other Products');
        await restore(page, backupFile);
        check('local nova kept', await card(page, 'nova') === 1);
        check('backup piattos not applied', await card(page, 'piattos') === 0);
    });

    const prep = async (page) => {
        await add(page, 'Piattos', 15, 'Other Products');
        await page.evaluate(() => commitCatalog(Catalog.editProduct(BASE_CATALOG, catalogChanges, 'Winston', { price: 12 }), 'Edited'));
        await page.evaluate(() => commitCatalog(Catalog.removeProduct(BASE_CATALOG, catalogChanges, 'C2'), 'Removed'));
        await page.evaluate(() => openProducts('all'));
        await page.locator('#productsContent details.prow-removed summary').click();
        await page.locator('.toast .toast-action').first().waitFor();
        await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    };
    const scroll = (page, bottom) => page.evaluate(b => { const m = document.querySelector('#productsModal .modal'); m.scrollTop = b ? m.scrollHeight : 0; }, bottom);
    await withPage(null, async (page) => {
        await prep(page);
        await scroll(page, false);
        await page.screenshot({ path: path.join(OUT, 'products-light.png') });
        await scroll(page, true);
        await page.screenshot({ path: path.join(OUT, 'products-light-bottom.png') });
        await page.evaluate(() => toggleDarkMode());
        await page.waitForTimeout(300);
        await scroll(page, false);
        await page.screenshot({ path: path.join(OUT, 'products-dark.png') });
        await scroll(page, true);
        await page.screenshot({ path: path.join(OUT, 'products-dark-bottom.png') });
    });
    const noOverflow = async (page, label) => {
        const o = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth,
            bad: [...document.querySelectorAll('#productsModal *')].filter(e => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').map(e => (e.className || e.tagName) + ':' + e.scrollWidth + '/' + e.clientWidth).slice(0, 5),
            body: (() => { const m = document.querySelector('#productsContent'); const sc = m.closest('.modal-body') || m; return [sc.scrollWidth, sc.clientWidth]; })()
        }));
        check(`${label}: no page horizontal scroll`, o.doc <= 390, String(o.doc));
        check(`${label}: no overflowing elements`, o.bad.length === 0, o.bad.join(','));
        check(`${label}: modal body fits`, o.body[0] <= o.body[1] + 1, o.body.join('/'));
    };
    await withPage({ width: 390, height: 844 }, async (page) => {
        await prep(page);
        await scroll(page, false);
        await page.screenshot({ path: path.join(OUT, 'products-phone.png') });
        await scroll(page, true);
        await page.screenshot({ path: path.join(OUT, 'products-phone-bottom.png') });
        await noOverflow(page, 'phone all');
        await page.locator('#productsTabs button', { hasText: 'Add many' }).click();
        await page.locator('#pasteBox').fill('Nova, 15, Snacks\nWinston, 12, Cigarettes\nChips, abc\nKopiko Blanca\t10\tHot Water\thw');
        await page.screenshot({ path: path.join(OUT, 'products-addmany-phone.png') });
        await noOverflow(page, 'phone add many');
    });
    finish();
})();
