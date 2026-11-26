import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = fileURLToPath(new URL('../', import.meta.url))

// 对照真实站内信页面和独立分页，仅替换通知数据源，不需要登录或启动服务。
test('standalone and station-message pagination share defaults and change page/size once', async t => {
  const fixture = `
    import { createApp, h, reactive } from 'vue'
    import ConfigProvider from '@jetlinks-web/components/es/ConfigProvider'
    import { paginationThemeComponents, runtimeTableConfig } from './src/components/CorePagination/defaults'
    import zh from 'ant-design-vue/es/locale/zh_CN'
    import ProTable from '@jetlinks-web/components/es/ProTable/ProTable.js'
    import CorePagination from './src/components/CorePagination/index.vue'
    import NotificationRecord from './src/views/account/center/components/StationMessage/components/NotificationRecord/index.vue'
    const rows = Array.from({length: 46}, (_, id) => ({id}))
    const state = window.pager = reactive({current: 1, pageSize: 12, total: 46, disabled: false, showSizeChanger: true, totalKnown: true, changes: [], queries: []})
    window.queryNotifications = async ({pageIndex, pageSize}) => {
      state.queries.push([pageIndex, pageSize])
      return {success: true, result: {data: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), total: rows.length, pageIndex, pageSize}}
    }
    const app = createApp({render: () => h(ConfigProvider, {locale: zh, TableConfig: runtimeTableConfig, theme: {token: {controlHeight: 36}, components: paginationThemeComponents(36)}, getPopupContainer: trigger => trigger.parentElement}, {default: () => [
      h('section', {id: 'table'}, h(NotificationRecord, {category: 'notification', children: []})),
      h('section', {id: 'pager'}, h(CorePagination, {
        // Even legacy consumers supplying old appearance attributes cannot re-enable the jumper or mini size.
        size: 'small', current: state.current, pageSize: state.pageSize, total: state.total, disabled: state.disabled,
        showSizeChanger: state.showSizeChanger, showQuickJumper: true, totalKnown: state.totalKnown,
        'onUpdate:current': value => state.current = value,
        'onUpdate:pageSize': value => state.pageSize = value,
        onChange: (page, size) => state.changes.push([page, size, state.current, state.pageSize])
      }))
    ]})})
    app.component('j-pro-table', ProTable)
    app.config.globalProperties.$t = key => key
    app.mount('#app')`
  const entry = root + 'pagination-fixture.js'
  const result = await build({root, configFile: false, logLevel: 'error', plugins: [vue(), {
    name: 'pager-fixture', enforce: 'pre',
    resolveId(id, importer) {
      if (id === entry) return entry
      if (importer?.includes('/StationMessage/components/NotificationRecord/')) {
        if (id === './useNotificationRecords') return '\0test-notifications'
        if (id === './components/ViewDialog.vue') return '\0test-dialog'
      }
    },
    load(id) {
      if (id === entry) return fixture
      if (id === '\0test-dialog') return 'export default {}'
      if (id === '\0test-notifications') return `import {ref} from 'vue'; export const useNotificationRecords = () => ({
        tableRef: ref(), queryParams: {terms: []}, columns: [{dataIndex: 'id', title: 'ID'}], requestNotifications: window.queryNotifications,
      })`
    },
  }], build: {write: false, minify: false, lib: {entry, formats: ['iife'], name: 'PagerTest'}, rollupOptions: {output: {inlineDynamicImports: true}}},
    define: {'process.env.NODE_ENV': '"production"'}})
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output)
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH})
  t.after(() => browser.close())
  const page = await browser.newPage()
  await page.route('http://pager.test/', route => route.fulfill({contentType: 'text/html', body: '<div id="app"></div>'}))
  await page.goto('http://pager.test/')
  for (const item of outputs.filter(x => x.type === 'asset' && x.fileName.endsWith('.css'))) await page.addStyleTag({content: item.source})
  await page.addScriptTag({content: outputs.find(x => x.type === 'chunk' && x.isEntry).code})
  const standalone = page.locator('#pager'), table = page.locator('#table')
  const summary = pane => pane.locator('.ant-pagination-total-text')
  for (const pane of [table, standalone]) {
    await expect(summary(pane)).toHaveText(/第\s*1\s*-\s*12\s*条\/总共\s*46\s*条/)
    await expect(pane.locator('.ant-pagination-item:visible, .ant-pagination-options-quick-jumper, .ant-pagination-mini')).toHaveCount(0)
    await expect(pane.locator('.ant-pagination-next')).toHaveCSS('height', '36px')
    await expect(pane.locator('.ant-pagination-prev button')).toBeDisabled()
  }
  assert.deepEqual(await page.evaluate(() => window.pager.queries), [[0,12]])
  await table.locator('.ant-pagination-next').click()
  await expect(summary(table)).toHaveText(/13\s*-\s*24/)
  await table.locator('.ant-select-selector').click()
  const tableOptions = table.locator('.ant-select-item-option:visible')
  await expect(tableOptions).toHaveCount(4)
  await tableOptions.nth(1).click()
  await expect(summary(table)).toHaveText(/1\s*-\s*24/)
  assert.deepEqual(await page.evaluate(() => window.pager.queries), [[0,12],[1,12],[0,24]])
  for (let pageNumber = 2; pageNumber <= 4; pageNumber++) await standalone.locator('.ant-pagination-next').click()
  await expect(summary(standalone)).toHaveText(/37\s*-\s*46/)
  await expect(standalone.locator('.ant-pagination-next button')).toBeDisabled()
  await standalone.locator('.ant-pagination-prev').click()
  await expect(summary(standalone)).toHaveText(/25\s*-\s*36/)
  await standalone.locator('.ant-select-selector').click()
  const options = standalone.locator('.ant-select-item-option:visible')
  await expect(options).toHaveCount(4)
  assert.deepEqual((await options.allTextContents()).map(s => Number(s.match(/\d+/)[0])), [12,24,48,96])
  await options.nth(1).click()
  await expect(summary(standalone)).toHaveText(/1\s*-\s*24/)
  assert.deepEqual(await page.evaluate(() => window.pager.changes), [[2,12,2,12],[3,12,3,12],[4,12,4,12],[3,12,3,12],[1,24,1,24]])
  await expect(standalone.locator('.ant-pagination-options-quick-jumper')).toHaveCount(0)
  await expect(summary(standalone)).toHaveText(/1\s*-\s*24.*46/)
  await page.setViewportSize({width: 360, height: 720})
  await standalone.evaluate(el => { el.style.width = '280px' })
  assert.ok(await standalone.evaluate(el => el.scrollWidth <= el.clientWidth), 'compact pager wraps instead of overflowing')
  await page.evaluate(() => Object.assign(window.pager, {disabled: true, showSizeChanger: false}))
  await expect(standalone.locator('.ant-select')).toHaveCount(0)
  await standalone.locator('.ant-pagination-next').click({force: true})
  assert.equal(await page.evaluate(() => window.pager.changes.length), 5)
  await page.evaluate(() => { window.pager.totalKnown = false })
  await expect(summary(standalone)).toBeHidden()
  await expect(standalone.locator('.ant-pagination-options-quick-jumper')).toHaveCount(0)
  await page.evaluate(() => Object.assign(window.pager, {totalKnown: true, total: 7}))
  await expect(summary(standalone)).toHaveText(/1\s*-\s*7/)
  await expect(standalone.locator('.ant-pagination-options-quick-jumper')).toHaveCount(0)
  await page.evaluate(() => { window.pager.total = 0 })
  await expect(standalone.locator('.jtable-pagination')).toHaveCount(0)
})
