// Pure product-catalog logic (no DOM). Browser: window.Catalog; Node: module.exports.
(function () {
    const FIELDS = ['price', 'category', 'hotWater'];
    const OTHER = 'Other Products';

    function cleanName(raw) {
        return String(raw == null ? '' : raw)
            .replace(/[<>"`\\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40)
            .trim();
    }

    function nameKey(name) {
        return cleanName(name).toLowerCase();
    }

    function parsePrice(raw) {
        const s = String(raw == null ? '' : raw).replace(/[₱,\s]/g, '');
        if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
        const n = Number(s);
        return n > 0 && n <= 99999 ? n : null;
    }

    function titleCase(s) {
        return String(s).trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
    }

    function emptyChanges() {
        return { added: [], edited: {}, removed: [] };
    }

    function compareCategory(a, b) {
        if (a === b) return 0;
        if (a === OTHER) return 1;
        if (b === OTHER) return -1;
        return titleCase(a).localeCompare(titleCase(b));
    }

    function sortProducts(list) {
        return list.slice().sort((a, b) =>
            compareCategory(a.category, b.category) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    }

    function clone(changes) {
        const edited = {};
        Object.keys(changes.edited).forEach(k => { edited[k] = Object.assign({}, changes.edited[k]); });
        return { added: changes.added.map(a => Object.assign({}, a)), edited, removed: changes.removed.slice() };
    }

    function baseState(base) {
        const hw = new Set(base.hotWater);
        const byKey = new Map();
        base.products.forEach(p => byKey.set(nameKey(p.name), { name: p.name, price: p.price, category: p.category, hotWater: hw.has(p.name) }));
        return byKey;
    }

    function pickDiff(fields, baseItem) {
        const out = {};
        FIELDS.forEach(f => {
            if (fields[f] !== undefined && fields[f] !== baseItem[f]) out[f] = fields[f];
        });
        return out;
    }

    function prune(base, changes) {
        const byKey = baseState(base);
        const out = emptyChanges();
        const seen = new Set();
        out.removed = changes.removed.filter(n => byKey.has(nameKey(n)))
            .map(n => byKey.get(nameKey(n)).name);
        const removedKeys = new Set(out.removed.map(nameKey));
        Object.keys(changes.edited).forEach(k => {
            const b = byKey.get(nameKey(k));
            if (!b || removedKeys.has(nameKey(k))) return;
            const diff = pickDiff(changes.edited[k], b);
            if (Object.keys(diff).length) out.edited[b.name] = diff;
        });
        changes.added.forEach(a => {
            const key = nameKey(a.name);
            if (seen.has(key)) return;
            seen.add(key);
            const b = byKey.get(key);
            if (!b) { out.added.push(Object.assign({}, a)); return; }
            // Now in the base catalog: keep only what still differs, as an edit
            if (removedKeys.has(key)) return;
            const diff = pickDiff(a, b);
            if (Object.keys(diff).length) out.edited[b.name] = Object.assign({}, out.edited[b.name], diff);
        });
        return out;
    }

    function build(base, changes) {
        const pruned = prune(base, changes);
        const hw = new Set(base.hotWater);
        const removed = new Set(pruned.removed);
        const products = [];
        const hotWater = [];
        const info = {};
        const removedBase = [];
        const put = (item) => {
            products.push({ name: item.name, price: item.price, category: item.category });
            if (item.hotWater) hotWater.push(item.name);
        };
        base.products.forEach(p => {
            if (removed.has(p.name)) { removedBase.push({ name: p.name, price: p.price, category: p.category }); return; }
            const e = pruned.edited[p.name];
            put(Object.assign({ hotWater: hw.has(p.name) }, p, e));
            if (e) info[p.name] = 'edited';
        });
        pruned.added.forEach(a => { put(a); info[a.name] = 'added'; });
        const sorted = sortProducts(products);
        const hwSet = new Set(hotWater);
        return {
            products: sorted,
            hotWater: sorted.map(p => p.name).filter(n => hwSet.has(n)),
            changes: pruned,
            info,
            removedBase
        };
    }

    function addProducts(base, changes, items) {
        const out = clone(changes);
        const keys = new Set(build(base, changes).products.map(p => nameKey(p.name)));
        items.forEach(it => {
            const key = nameKey(it.name);
            if (keys.has(key)) return;
            keys.add(key);
            out.added.push({ name: cleanName(it.name), price: it.price, category: it.category, hotWater: !!it.hotWater });
        });
        return out;
    }

    function editProduct(base, changes, name, fields) {
        const out = clone(changes);
        const key = nameKey(name);
        const a = out.added.find(x => nameKey(x.name) === key);
        if (a) {
            FIELDS.forEach(f => { if (fields[f] !== undefined) a[f] = fields[f]; });
            return out;
        }
        const b = baseState(base).get(key);
        if (!b) return out;
        const merged = Object.assign({}, out.edited[b.name], fields);
        const diff = pickDiff(merged, b);
        if (Object.keys(diff).length) out.edited[b.name] = diff;
        else delete out.edited[b.name];
        return out;
    }

    function removeProduct(base, changes, name) {
        const out = clone(changes);
        const key = nameKey(name);
        const n = out.added.length;
        out.added = out.added.filter(x => nameKey(x.name) !== key);
        if (out.added.length !== n) return out;
        const b = baseState(base).get(key);
        if (!b) return out;
        delete out.edited[b.name];
        if (!out.removed.includes(b.name)) out.removed.push(b.name);
        return out;
    }

    function restoreProduct(changes, name) {
        const out = clone(changes);
        const key = nameKey(name);
        out.removed = out.removed.filter(n => nameKey(n) !== key);
        return out;
    }

    function resetProduct(changes, name) {
        const out = clone(changes);
        delete out.edited[name];
        return out;
    }

    function changeCount(changes) {
        return changes.added.length + Object.keys(changes.edited).length + changes.removed.length;
    }

    const Catalog = {
        cleanName, nameKey, parsePrice, titleCase, emptyChanges, sortProducts,
        build, addProducts, editProduct, removeProduct, restoreProduct, resetProduct, changeCount
    };
    if (typeof module !== 'undefined') module.exports = Catalog;
    else window.Catalog = Catalog;
})();
