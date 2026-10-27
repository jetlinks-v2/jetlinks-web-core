import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { transformSync } from 'esbuild';
import { compileScript, compileStyle, parse } from 'vue/compiler-sfc';
import { createSSRApp, h, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createI18n } from 'vue-i18n';

const require = createRequire(import.meta.url);
const filename = new URL('../src/components/AMapComponent/AMap.vue', import.meta.url);
const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname });
assert.deepEqual(errors, []);
const script = compileScript(descriptor, { id: 'amap-feedback', inlineTemplate: true });
const { code } = transformSync(script.content, { loader: 'ts', format: 'cjs' });
const messages = Object.fromEntries(['zh', 'en'].map(locale => [locale,
    JSON.parse(readFileSync(new URL(`../src/locales/lang/${locale}.json`, import.meta.url), 'utf8')),
]));

async function render(error, { locale = 'zh', key = 'test', loading = false, mapProps = {}, onUiOption = () => {} } = {}) {
    const module = { exports: {} };
    const state = {
        error: ref(error), loading: ref(loading), amapKey: ref(key), sdkReady: ref(false),
        loadId: ref(1), mapEvents: ref({}), canRenderLayers: ref(false), setBounds() {},
    };
    new Function('require', 'module', 'exports', code)(id => {
        if (id.endsWith('.css')) return {};
        if (id === './useAMapLifecycle') return { useAMapLifecycle: ui => { onUiOption(ui()); return state; } };
        return require(id);
    }, module, module.exports);
    const app = createSSRApp(module.exports.default, { style: { height: '320px' }, ...mapProps });
    app.use(createI18n({ legacy: false, locale, messages, flatJson: true, missingWarn: false }));
    app.component('ElAmap', { setup: (_, { slots }) => () => h('div', slots.default?.()) });
    app.component('CloudEmpty', { props: ['description'], setup: props => () => h('div', props.description) });
    return renderToString(app);
}

test('centered feedback puts the actual info below the error code without a refresh button', async () => {
    const html = await render({ kind: 'map', code: '1013', info: 'INVALID_REQUEST' });
    assert.match(html, /role="alert"/);
    assert.ok(html.indexOf('错误码：1013') < html.indexOf('info：INVALID_REQUEST'));
    assert.ok(html.indexOf('info：INVALID_REQUEST') < html.indexOf('请前往高德地图官网查看错误码说明。'));
    assert.doesNotMatch(html, /刷新页面|<button/);
});

test('empty info is hidden and unknown errors and timeouts receive distinct feedback', async () => {
    const unknown = await render({ kind: 'map' });
    assert.doesNotMatch(unknown, /info：/);
    assert.match(unknown, /未能获取详细错误信息/);
    const timeout = await render({ kind: 'timeout' });
    assert.match(timeout, /高德地图加载超时/);
    assert.match(timeout, /长时间未能完成地图加载/);
    assert.doesNotMatch(timeout, /错误码：/);
});

test('SDK text is escaped, repeated messages are omitted, and both locales translate feedback', async () => {
    const info = '<script>alert("map")</script>';
    const html = await render({ kind: 'map', code: '1013', info, message: info });
    assert.doesNotMatch(html, /<script>/);
    assert.equal((html.match(/&lt;script&gt;/g) || []).length, 1);
    const english = await render({ kind: 'map', code: '1013', info: 'INVALID_REQUEST' }, { locale: 'en' });
    assert.match(english, /Error code: 1013/);
    assert.match(english, /Please visit the AMap website for error code details/);
});

test('loading and missing configuration keep distinct states and component styles compile', async () => {
    const loading = await render(undefined, { loading: true });
    assert.match(loading, /role="status"/);
    assert.match(loading, /地图加载中/);
    const empty = await render(undefined, { key: '' });
    assert.match(empty, /请配置高德地图key/);
    assert.doesNotMatch(empty, /role="alert"|role="status"/);
    const style = compileStyle({ source: descriptor.styles[0].content, filename: filename.pathname, id: 'amap-feedback', scoped: true });
    assert.deepEqual(style.errors, []);
});

test('existing trajectory callers retain default AMapUI loading and explicit false opts out', async () => {
    const values = [];
    await render(undefined, { onUiOption: value => values.push(value) });
    await render(undefined, { mapProps: { AMapUI: false }, onUiOption: value => values.push(value) });
    assert.deepEqual(values, [true, false]);
});
