import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transformSync } from 'esbuild';

function fixture() {
    const scripts = [];
    const window = {};
    const document = {
        createElement: () => ({ remove() { this.removed = true; } }),
        body: { append: script => scripts.push(script) },
    };
    const source = readFileSync(new URL('../src/components/AMapComponent/utils.ts', import.meta.url), 'utf8');
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
    const module = { exports: {} };
    new Function('module', 'exports', 'window', 'document', code)(module, module.exports, window, document);
    return { window, scripts, load: module.exports.getAMapUiPromise };
}

test('concurrent maps reuse one AMapUI script and clear handlers after successful initialization', async () => {
    const f = fixture();
    const first = f.load('1.1');
    assert.equal(f.load('1.1'), first);
    assert.equal(f.scripts.length, 1);
    const script = f.scripts[0];
    assert.equal(script.src, 'https://webapi.amap.com/ui/1.1/main-async.js');
    f.window.initAMapUI = () => { f.window.AMapUI = {}; };
    script.onload();
    await first;
    assert.equal(script.onload, null);
    assert.equal(script.onerror, null);
    await f.load('1.1');
    assert.equal(f.scripts.length, 1);
});

test('AMapUI script errors reject all consumers and a later call may request it again', async () => {
    const f = fixture();
    const first = f.load();
    const second = f.load();
    const failure = new Event('error');
    const rejected = [first, second].map(promise => assert.rejects(promise, error => error === failure));
    f.scripts[0].onerror(failure);
    await Promise.all(rejected);
    assert.equal(f.scripts[0].removed, true);
    assert.equal(f.scripts[0].onload, null);
    assert.equal(f.scripts[0].onerror, null);
    const retry = f.load();
    assert.equal(f.scripts.length, 2);
    f.window.AMapUI = {};
    f.scripts[1].onload();
    await retry;
});

test('a loaded script without AMapUI and an initializer exception are treated as failures', async () => {
    for (const throwInInitializer of [false, true]) {
        const f = fixture();
        const error = new Error('initializer failed');
        if (throwInInitializer) f.window.initAMapUI = () => { throw error; };
        const pending = f.load();
        const rejected = assert.rejects(pending, failure => throwInInitializer ? failure === error : failure.type === 'error');
        f.scripts[0].onload();
        await rejected;
        assert.equal(f.scripts[0].removed, true);
    }
});
