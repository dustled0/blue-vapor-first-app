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
    assert.deepEqual(cats(b.products), ['Cigarettes', 'Drinks', 'Hot Water', 'Other Products']);
    assert.deepEqual(b.hotWater, ['Milo']);
    assert.deepEqual(b.info, {});
});

test('added product with new category sorts before Other Products', () => {
    const c = Catalog.addProducts(base, Catalog.emptyChanges(), [piattos]);
    const b = Catalog.build(base, c);
    assert.deepEqual(cats(b.products), ['Cigarettes', 'Drinks', 'Hot Water', 'Snacks', 'Other Products']);
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
