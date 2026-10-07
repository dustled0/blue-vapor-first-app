// Shared e2e helpers. Run via tests/e2e/run.sh (Windows Node + Chrome over CDP).
const { chromium } = require('playwright');

const URL = 'http://localhost:8765/index.html';
let failures = 0;

function check(name, cond, detail = '') {
    if (cond) console.log(`PASS ${name}`);
    else { failures++; console.log(`FAIL ${name}${detail ? ': ' + detail : ''}`); }
}

// Opens a fresh context + page with empty localStorage; fn(page, errors) runs the checks.
async function withPage(viewport, fn) {
    const browser = await chromium.connectOverCDP('http://localhost:9333');
    const context = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(URL);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await fn(page, errors);
    } catch (e) {
        failures++;
        console.log(`FAIL exception: ${e.message}`);
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await context.close();
    await browser.close();
}

function finish() {
    process.exit(failures ? 1 : 0);
}

module.exports = { withPage, check, finish, URL };
