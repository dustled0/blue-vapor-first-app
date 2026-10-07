const test = require('node:test');
const assert = require('node:assert/strict');
const Catalog = require('../catalog.js');

const base = {
    products: [
        { name: 'Winston', price: 11, category: 'Cigarettes' },
        { name: 'Milo', price: 10, category: 'Hot Water' },
        { name: 'Ajinomoto', price: 8, category: 'Other Products' },
        { name: 'C2', price: 15, category: 'Drinks' }
    ],
    hotWater: ['Milo']
};
const cats = list => [...new Set(list.map(p => p.category))];
const piattos = { name: 'Piattos', price: 15, category: 'Snacks', hotWater: false };

test('cleanName strips, collapses and truncates', () => {
    assert.equal(Catalog.cleanName("  Lola's   <b>Pan</b> "), "Lola's bPan/b");
    assert.equal(Catalog.cleanName('x'.repeat(50)).length, 40);
});

test('nameKey is case-insensitive and trimmed', () => {
    assert.equal(Catalog.nameKey('  WINSTON '), 'winston');
});

test('parsePrice', () => {
    assert.equal(Catalog.parsePrice('₱1,200'), 1200);
    assert.equal(Catalog.parsePrice('12.5'), 12.5);
    for (const bad of ['0', 'abc', '100000', '']) assert.equal(Catalog.parsePrice(bad), null);
});

test('titleCase', () => {
    assert.equal(Catalog.titleCase('snacks and chips'), 'Snacks And Chips');
});

test('build with no changes sorts categories, Other Products last', () => {
    const b = Catalog.build(base, Catalog.emptyChanges());
    assert.deepEqual(cats(b.products), ['Cigarettes', 'Hot Water', 'Drinks', 'Other Products']);
    assert.deepEqual(b.hotWater, ['Milo']);
    assert.deepEqual(b.info, {});
});

test('added product with new category sorts before Other Products', () => {
    const c = Catalog.addProducts(base, Catalog.emptyChanges(), [piattos]);
    const b = Catalog.build(base, c);
    assert.deepEqual(cats(b.products), ['Cigarettes', 'Hot Water', 'Drinks', 'Snacks', 'Other Products']);
    assert.equal(b.info.Piattos, 'added');
});

test('addProducts skips duplicates case-insensitively', () => {
    const c = Catalog.emptyChanges();
    const out = Catalog.addProducts(base, c, [{ name: ' winston', price: 5, category: 'Drinks', hotWater: false }]);
    assert.deepEqual(out, Catalog.emptyChanges());
});

test('editProduct stores only differing fields', () => {
    const c = Catalog.editProduct(base, Catalog.emptyChanges(), 'Winston', { price: 12 });
    assert.deepEqual(c.edited.Winston, { price: 12 });
    assert.equal(Catalog.build(base, c).info.Winston, 'edited');
    const c2 = Catalog.editProduct(base, c, 'Winston', { price: 11 });
    assert.equal('Winston' in c2.edited, false);
});

test('editProduct on added product edits inside added', () => {
    const c = Catalog.addProducts(base, Catalog.emptyChanges(), [piattos]);
    const c2 = Catalog.editProduct(base, c, 'Piattos', { price: 20 });
    assert.equal(c2.added[0].price, 20);
    assert.deepEqual(c2.edited, {});
    assert.equal(c.added[0].price, 15);
});

test('hotWater edit', () => {
    const c = Catalog.editProduct(base, Catalog.emptyChanges(), 'Milo', { hotWater: false });
    assert.deepEqual(Catalog.build(base, c).hotWater, []);
});

test('remove and restore a base product', () => {
    const c = Catalog.removeProduct(base, Catalog.emptyChanges(), 'C2');
    const b = Catalog.build(base, c);
    assert.equal(b.products.some(p => p.name === 'C2'), false);
    assert.deepEqual(b.removedBase.map(p => p.name), ['C2']);
    const b2 = Catalog.build(base, Catalog.restoreProduct(c, 'C2'));
    assert.equal(b2.products.some(p => p.name === 'C2'), true);
});

test('remove an added product only touches added', () => {
    const c = Catalog.addProducts(base, Catalog.emptyChanges(), [piattos]);
    const c2 = Catalog.removeProduct(base, c, 'Piattos');
    assert.deepEqual(c2, Catalog.emptyChanges());
});

test('resetProduct drops edits', () => {
    const c = Catalog.editProduct(base, Catalog.emptyChanges(), 'Winston', { price: 12 });
    assert.deepEqual(Catalog.resetProduct(c, 'Winston').edited, {});
});

test('build prunes redundant changes', () => {
    const b = Catalog.build(base, {
        added: [{ name: 'Winston', price: 11, category: 'Cigarettes', hotWater: false }],
        edited: { Milo: { price: 10 } },
        removed: ['Gone']
    });
    assert.deepEqual(b.changes, Catalog.emptyChanges());
});

test('added item now in base becomes an edit of the base product', () => {
    const b = Catalog.build(base, {
        added: [{ name: 'winston', price: 13, category: 'Cigarettes', hotWater: false }],
        edited: {}, removed: []
    });
    assert.equal(b.products.find(p => p.name === 'Winston').price, 13);
    assert.deepEqual(b.changes.edited, { Winston: { price: 13 } });
    assert.deepEqual(b.changes.added, []);
});

test('browser override wins over a later base value', () => {
    const newBase = { products: [...base.products, { name: 'Piattos', price: 14, category: 'Snacks' }], hotWater: base.hotWater };
    const b = Catalog.build(newBase, { added: [], edited: { Piattos: { price: 15 } }, removed: [] });
    assert.equal(b.products.find(p => p.name === 'Piattos').price, 15);
});

test('inputs are not mutated', () => {
    const snap = JSON.stringify(base);
    const c = Catalog.emptyChanges();
    Catalog.build(base, Catalog.editProduct(base, Catalog.addProducts(base, c, [piattos]), 'Milo', { price: 1 }));
    assert.equal(JSON.stringify(base), snap);
    assert.deepEqual(c, Catalog.emptyChanges());
});

test('changeCount', () => {
    assert.equal(Catalog.changeCount({ added: [{}], edited: { a: {} }, removed: ['b'] }), 3);
});

test('parsePaste parses lines, tabs, blanks and hot water flag', () => {
    const rows = Catalog.parsePaste('Piattos, 15, Snacks\r\nNova\t₱15\tsnacks\r\n\r\n  \r\nKopiko Blanca, 10, Hot Water, HW\r\n', base.products, base.hotWater);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => r.status), ['new', 'new', 'new']);
    assert.equal(rows[1].category, 'Snacks');
    assert.equal(rows[2].hotWater, true);
    assert.deepEqual(rows.map(r => r.line), [1, 2, 5]);
});

test('parsePaste defaults category to Other Products', () => {
    const [a, b] = Catalog.parsePaste('Chippy, 12\nChippy2, 12,', base.products, base.hotWater);
    assert.equal(a.category, 'Other Products');
    assert.equal(b.category, 'Other Products');
    assert.equal(b.status, 'new');
});

test('parsePaste detects existing and same products', () => {
    const [a] = Catalog.parsePaste('winston, 12, Cigarettes', base.products, base.hotWater);
    const [b] = Catalog.parsePaste('WINSTON, 11, cigarettes', base.products, base.hotWater);
    assert.equal(a.status, 'exists');
    assert.deepEqual(a.diff, { price: 12 });
    assert.equal(b.status, 'same');
});

test('parsePaste compares hot water against the base list', () => {
    const [a] = Catalog.parsePaste('Milo, 10, Hot Water', base.products, base.hotWater);
    assert.equal(a.status, 'exists');
    assert.deepEqual(a.diff, { hotWater: false });
});

test('parsePaste reports problems', () => {
    const rows = Catalog.parsePaste(', 10, Snacks\nChips, abc\nChips\nDup, 5\ndup, 6', base.products, base.hotWater);
    assert.deepEqual(rows.map(r => r.status), ['problem', 'problem', 'problem', 'new', 'problem']);
    assert.equal(rows[0].reason, 'Missing name');
    assert.equal(rows[1].reason, 'Price must be a number above 0');
    assert.equal(rows[2].reason, 'Price must be a number above 0');
    assert.equal(rows[4].reason, 'Listed twice');
});

test('toDataJs round-trips and keeps layout', () => {
    const input = {
        products: [
            { name: 'Piattos', price: 15.5, category: 'Snacks' },
            { name: "Mang Tomas's", price: 10, category: 'Other Products' },
            { name: 'Winston', price: 11, category: 'Cigarettes' },
            { name: 'Milo', price: 10, category: 'Hot Water' }
        ],
        hotWater: ['Milo'], customers: ['Ana', "O'Neil"], fee: 5, overrides: { Milo: 2 }
    };
    const src = Catalog.toDataJs(input);
    assert.ok(src.startsWith('// ============ DATA ============'));
    assert.ok(src.includes('// Snacks (A-Z)'));
    assert.ok(src.includes('const PRODUCTS'));
    const out = new Function(src + '; return {PRODUCTS, HOT_WATER_PRODUCTS, CUSTOMERS, HOT_WATER_FEE, HOT_WATER_FEE_OVERRIDES};')();
    assert.deepEqual(out.PRODUCTS, Catalog.sortProducts(input.products));
    assert.deepEqual(out.HOT_WATER_PRODUCTS, ['Milo']);
    assert.deepEqual(out.CUSTOMERS, input.customers);
    assert.equal(out.HOT_WATER_FEE, 5);
    assert.deepEqual(out.HOT_WATER_FEE_OVERRIDES, { Milo: 2 });
});

test('toDataJs round-trips the real data.js category order', () => {
    const fs = require('node:fs');
    const text = fs.readFileSync(require('node:path').join(__dirname, '..', 'data.js'), 'utf8');
    const d = new Function(text + '; return {products: PRODUCTS, hotWater: HOT_WATER_PRODUCTS, customers: CUSTOMERS, fee: HOT_WATER_FEE, overrides: HOT_WATER_FEE_OVERRIDES};')();
    const src = Catalog.toDataJs(d);
    const out = new Function(src + '; return {PRODUCTS, HOT_WATER_PRODUCTS, CUSTOMERS, HOT_WATER_FEE, HOT_WATER_FEE_OVERRIDES};')();
    assert.deepEqual(cats(out.PRODUCTS), cats(d.products));
    assert.deepEqual(cats(out.PRODUCTS)[0], 'Cigarettes');
    assert.equal(cats(out.PRODUCTS).at(-1), 'Other Products');
    assert.deepEqual(out.HOT_WATER_PRODUCTS, d.hotWater);
    assert.deepEqual(out.CUSTOMERS, d.customers);
});

test('new categories go after base categories, before Other Products', () => {
    const sorted = Catalog.sortProducts([
        { name: 'x', price: 1, category: 'Zed' }, { name: 'y', price: 1, category: 'Other Products' },
        { name: 'z', price: 1, category: 'Alpha' }, { name: 'w', price: 1, category: 'drinks' }
    ], ['Cigarettes', 'Drinks']);
    assert.deepEqual(sorted.map(p => p.name), ['w', 'z', 'x', 'y']);
});

const cobraBase = {
    products: [
        { name: 'Cobra', price: 18, category: 'Drinks' },
        { name: 'C2', price: 15, category: 'Drinks' },
        { name: 'Bbq Chips', price: 5, category: 'BBQ' }
    ],
    hotWater: []
};

test('addProducts restores a removed base product instead of adding', () => {
    const removed = Catalog.removeProduct(cobraBase, Catalog.emptyChanges(), 'Cobra');
    const out = Catalog.addProducts(cobraBase, removed, [{ name: 'cobra', price: 20, category: 'Drinks', hotWater: false }]);
    const b = Catalog.build(cobraBase, out);
    assert.equal(b.products.find(p => p.name === 'Cobra').price, 20);
    assert.deepEqual(out.removed, []);
    assert.deepEqual(out.added, []);
    assert.deepEqual(out.edited, { Cobra: { price: 20 } });
});

test('restoring with identical fields records no edit', () => {
    const removed = Catalog.removeProduct(cobraBase, Catalog.emptyChanges(), 'Cobra');
    const out = Catalog.addProducts(cobraBase, removed, [{ name: 'Cobra', price: 18, category: 'drinks', hotWater: false }]);
    assert.deepEqual(out, Catalog.emptyChanges());
});

test('parsePaste strips HTML characters from the category', () => {
    const rows = Catalog.parsePaste('Foo, 5, <img src=x onerror=alert(1)>', base.products, base.hotWater);
    assert.ok(!/[<>]/.test(rows[0].category), rows[0].category);
});

test('addProducts and editProduct clean the category', () => {
    const a = Catalog.addProducts(base, Catalog.emptyChanges(), [{ name: 'Foo', price: 5, category: '<b>snacks</b>', hotWater: false }]);
    assert.ok(!/[<>]/.test(a.added[0].category));
    const e = Catalog.editProduct(base, Catalog.emptyChanges(), 'Winston', { category: '<i>x</i>' });
    assert.ok(!/[<>]/.test(e.edited.Winston.category));
});

test('existing categories keep their spelling (case-insensitive match)', () => {
    const rows = Catalog.parsePaste('X, 5, bbq', cobraBase.products, []);
    assert.equal(rows[0].category, 'BBQ');
    const a = Catalog.addProducts(cobraBase, Catalog.emptyChanges(), [{ name: 'X', price: 5, category: 'bbq', hotWater: false }]);
    assert.equal(a.added[0].category, 'BBQ');
});

test('parsePaste flags a thousands separator in comma lines', () => {
    for (const line of ['Item, 1,200, Cat', 'Item, 1,200, Cat, hw']) {
        const r = Catalog.parsePaste(line, base.products, base.hotWater)[0];
        assert.equal(r.status, 'problem', line);
        assert.equal(r.reason, 'Use tabs when a price has commas');
    }
    assert.equal(Catalog.parsePaste('Item\t1,200\tCat', base.products, base.hotWater)[0].price, 1200);
});

test('parsePaste marks rows matching removed base products as restore', () => {
    const removed = [{ name: 'Cobra', price: 18, category: 'Drinks' }];
    const rows = Catalog.parsePaste('cobra, 20, Drinks\nZed, 5', base.products, [], removed);
    assert.equal(rows[0].status, 'new');
    assert.equal(rows[0].restore, true);
    assert.equal(rows[1].restore, undefined);
});
