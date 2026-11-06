import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { compileScript, parse } from 'vue/compiler-sfc';
const require = createRequire(import.meta.url);
function compileComponent(path, dependencies) {
    const file = new URL(path, import.meta.url);
    const parsed = parse(readFileSync(file, 'utf8'), { filename: file.pathname });
    assert.deepEqual(parsed.errors, []);
    const compiled = compileScript(parsed.descriptor, { id: path, inlineTemplate: true });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code)(id => dependencies[id] ?? require(id), module, module.exports);
    return module.exports.default;
}
export function makeAction(menuAllowed = true, calls = []) {
    const source = readFileSync(new URL('../src/components/AMapComponent/useAMapConfigNavigation.ts', import.meta.url), 'utf8');
    const navigation = { exports: {} };
    const menu = { hasMenu: code => menuAllowed && code === 'system/Basis', jumpPage: code => calls.push(code) };
    new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(id => id === '@jetlinks-web-core/store/menu' ? { useMenuStore: () => menu } : require(id), navigation, navigation.exports);
    const action = compileComponent('../src/components/AMapComponent/AMapConfigAction.vue', { './useAMapConfigNavigation': navigation.exports });
    return { action, navigation: navigation.exports, menu };
}
export function makeCloudEmpty() {
    const source = readFileSync(new URL('../src/hooks/useEmptyCreateState.ts', import.meta.url), 'utf8');
    const state = { exports: {} };
    new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(require, state, state.exports);
    return compileComponent('../src/components/CloudEmpty/index.vue', { '../../hooks/useEmptyCreateState': state.exports, '@jetlinks-web-core/assets/components/empty.svg': '', '@jetlinks-web-core/assets/components/big-empty.svg': '' });
}
