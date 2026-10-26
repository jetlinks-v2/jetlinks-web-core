import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { transformSync } from 'esbuild';
import { effectScope, nextTick, reactive, ref } from 'vue';

const require = createRequire(import.meta.url);
function load(name, dependencies = {}, globals = {}) {
    const source = readFileSync(new URL(`../src/components/AMapComponent/${name}.ts`, import.meta.url), 'utf8');
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
        id => dependencies[id] ?? require(id), module, module.exports, ...Object.values(globals),
    );
    return module.exports;
}
const errors = load('errors');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = async () => { await Promise.resolve(); await nextTick(); };

function fixture({ key = 'test-key', ui = false, sdk = deferred(), uiResult = deferred(), initError } = {}) {
    const store = reactive({ systemInfo: { amap: { apiKey: key, secretKey: 'test-secret' } } });
    const uiOption = ref(ui);
    const calls = [], uiCalls = [], initialized = [];
    const timers = new Map();
    let timerId = 0;
    const { useAMapLifecycle } = load('useAMapLifecycle', {
        '@jetlinks-web-core/store/system': { useSystemStore: () => store },
        '@vuemap/vue-amap': {
            lazyAMapApiLoaderInstance: sdk.promise,
            initAMapApiLoader: config => { calls.push(config); if (initError) throw initError; },
        },
        './utils': { getAMapUiPromise: version => { uiCalls.push(version); return uiResult.promise; } },
        './errors': errors,
    }, {
        setTimeout: (handler, delay) => { timers.set(++timerId, { handler, delay }); return timerId; },
        clearTimeout: id => timers.delete(id),
    });
    const scope = effectScope();
    const hook = scope.run(() => useAMapLifecycle(uiOption, map => initialized.push(map)));
    return { hook, scope, store, sdk, uiResult, uiOption, calls, uiCalls, initialized, timers };
}

test('missing configuration keeps the existing empty state and does not load SDK', async () => {
    const f = fixture({ key: '' });
    try {
        assert.equal(f.hook.amapKey.value, '');
        assert.equal(f.hook.loading.value, false);
        assert.equal(f.calls.length, 0);
        assert.equal(f.timers.size, 0);
        f.store.systemInfo.amap.apiKey = 'configured';
        await nextTick();
        assert.equal(f.calls.length, 1);
        assert.equal(f.hook.loading.value, true);
    } finally { f.scope.stop(); }
});

test('normal loading waits for map completion and preserves init, layers and setBounds', async () => {
    const f = fixture();
    try {
        assert.equal(f.hook.sdkReady.value, false);
        assert.equal(f.hook.loading.value, true);
        f.sdk.resolve();
        await flush();
        assert.equal(f.hook.sdkReady.value, true);
        assert.equal(f.hook.loading.value, true);
        const bounds = [];
        const map = { setBounds: value => bounds.push(value) };
        f.hook.mapEvents.value.init(map);
        f.hook.setBounds('bounds');
        assert.deepEqual(f.initialized, [map]);
        assert.deepEqual(bounds, ['bounds']);
        assert.equal(f.hook.canRenderLayers.value, true);
        assert.equal(f.uiCalls.length, 0);
        f.hook.mapEvents.value.complete();
        assert.equal(f.hook.loading.value, false);
        assert.equal(f.hook.error.value, undefined);
        assert.equal(f.timers.size, 0);
    } finally { f.scope.stop(); }
});

test('map errors retain actual 1013 and info, including after a complete event', () => {
    const f = fixture();
    try {
        f.hook.mapEvents.value.error({ code: 1013, info: 'INVALID_REQUEST' });
        assert.equal(f.hook.error.value.code, '1013');
        assert.equal(f.hook.error.value.info, 'INVALID_REQUEST');
        assert.equal(f.hook.error.value.kind, 'map');
        assert.equal(f.hook.loading.value, false);
        f.hook.mapEvents.value.complete();
        assert.equal(f.hook.error.value.info, 'INVALID_REQUEST');
        assert.equal(f.timers.size, 0);
    } finally { f.scope.stop(); }
});

test('SDK rejection and synchronous initialization errors become visible failures', async () => {
    const f = fixture();
    const sync = fixture({ initError: new Error('SDK unavailable') });
    try {
        f.sdk.reject({ infocode: '10001', info: 'INVALID_USER_KEY' });
        await flush();
        assert.equal(f.hook.sdkReady.value, false);
        assert.equal(f.hook.error.value.kind, 'sdk');
        assert.equal(f.hook.error.value.code, '10001');
        assert.equal(f.hook.error.value.info, 'INVALID_USER_KEY');
        assert.equal(sync.hook.error.value.message, 'SDK unavailable');
        assert.equal(f.timers.size + sync.timers.size, 0);
    } finally { f.scope.stop(); sync.scope.stop(); }
});

test('AMapUI readiness controls layers and extends loading until both stages complete', async () => {
    const f = fixture({ ui: '1.1' });
    try {
        f.sdk.resolve();
        await flush();
        f.hook.mapEvents.value.init({ setBounds() {} });
        f.hook.mapEvents.value.complete();
        assert.equal(f.hook.canRenderLayers.value, false);
        assert.equal(f.hook.loading.value, true);
        assert.deepEqual(f.uiCalls, ['1.1']);
        f.uiResult.resolve();
        await flush();
        assert.equal(f.hook.canRenderLayers.value, true);
        assert.equal(f.hook.loading.value, false);
        assert.equal(f.timers.size, 0);
    } finally { f.scope.stop(); }
});

test('AMapUI failure does not leave a blank map or an infinite loading state', async () => {
    const f = fixture({ ui: true });
    try {
        f.hook.mapEvents.value.init({ setBounds() {} });
        f.uiResult.reject(new Event('error'));
        await flush();
        assert.equal(f.hook.error.value.kind, 'ui');
        assert.equal(f.hook.loading.value, false);
        assert.equal(f.hook.canRenderLayers.value, false);
        assert.equal(f.timers.size, 0);
    } finally { f.scope.stop(); }
});

test('a map that never completes times out, and a late successful load can recover', () => {
    const f = fixture();
    try {
        f.hook.mapEvents.value.init({ setBounds() {} });
        const timer = [...f.timers.values()][0];
        assert.equal(timer.delay, 15_000);
        timer.handler();
        assert.equal(f.hook.error.value.kind, 'timeout');
        assert.equal(f.hook.error.value.code, undefined);
        assert.equal(f.hook.loading.value, false);
        f.hook.mapEvents.value.complete();
        assert.equal(f.hook.error.value, undefined);
    } finally { f.scope.stop(); }
});

test('configuration changes ignore callbacks and UI results from the old map', async () => {
    const f = fixture({ ui: true });
    try {
        const old = f.hook.mapEvents.value;
        old.init({ setBounds() {} });
        f.uiOption.value = false;
        await nextTick();
        const current = f.hook.mapEvents.value;
        assert.notEqual(old, current);
        f.uiResult.reject({ info: 'OLD_UI_ERROR' });
        old.error({ info: 'OLD_MAP_ERROR' });
        old.complete();
        old.init({ setBounds() {} });
        await flush();
        assert.equal(f.hook.error.value, undefined);
        assert.equal(f.hook.loading.value, true);
        assert.equal(f.initialized.length, 1);
        current.complete();
        assert.equal(f.hook.loading.value, false);
    } finally { f.scope.stop(); }
});

test('disposal cancels timers and ignores outstanding SDK and map callbacks', async () => {
    const f = fixture();
    const events = f.hook.mapEvents.value;
    f.scope.stop();
    assert.equal(f.timers.size, 0);
    f.sdk.resolve();
    events.init({ setBounds() {} });
    events.error({ code: 1013, info: 'INVALID_REQUEST' });
    events.complete();
    await flush();
    assert.equal(f.hook.sdkReady.value, false);
    assert.equal(f.hook.error.value, undefined);
    assert.equal(f.initialized.length, 0);
});

test('two maps share SDK readiness while keeping errors and lifecycle independent', async () => {
    const sdk = deferred();
    const first = fixture({ sdk });
    const second = fixture({ sdk });
    try {
        sdk.resolve();
        await flush();
        first.hook.mapEvents.value.error({ code: 1013, info: 'INVALID_REQUEST' });
        second.hook.mapEvents.value.complete();
        first.scope.stop();
        assert.equal(second.hook.sdkReady.value, true);
        assert.equal(second.hook.error.value, undefined);
        assert.equal(second.hook.loading.value, false);
    } finally { first.scope.stop(); second.scope.stop(); }
});

test('normalization keeps response fields, handles unknown errors and never invents info', () => {
    const { normalizeAMapError } = errors;
    assert.deepEqual(normalizeAMapError({ data: { infocode: 1013, info: 'INVALID_REQUEST' } }, 'map'), {
        kind: 'map', code: '1013', info: 'INVALID_REQUEST', message: undefined,
    });
    assert.equal(normalizeAMapError('INVALID_USER_KEY', 'sdk').info, 'INVALID_USER_KEY');
    assert.equal(normalizeAMapError({ code: 1013 }, 'map').info, undefined);
    for (const value of [undefined, null, {}, { info: '', code: NaN }]) {
        const error = normalizeAMapError(value, 'map');
        assert.equal(error.code, undefined);
        assert.equal(error.info, undefined);
        assert.equal(error.message, undefined);
    }
});
