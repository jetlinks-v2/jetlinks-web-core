import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import { chromium } from 'playwright'

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlEXf8AAAAASUVORK5CYII=', 'base64')
const entry = fileURLToPath(new URL('../src/utils/edge-image-proxy.ts', import.meta.url))

const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'EdgeImageProxy',
  platform: 'browser',
  write: false,
  plugins: [{
    name: 'edge-image-proxy-browser-fixture',
    setup(builder) {
      builder.onResolve({ filter: /^@jetlinks-web\/(?:constants|utils)$/ }, (args) => ({
        path: args.path,
        namespace: 'fixture',
      }))
      builder.onResolve({ filter: /^\.\/request-context$/ }, () => ({
        path: 'request-context',
        namespace: 'fixture',
      }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path.endsWith('constants')
          ? "export const TOKEN_KEY_URL = ':X_Access_Token'"
          : path.endsWith('utils')
            ? "export const getToken = () => localStorage.getItem('X-Access-Token')"
            : "export const isFromCloud = () => ['cloud', 'cloud-pc'].includes(localStorage.getItem('terminal')) && location.href.includes('/ui/edge/cloud/default/'); export const getBaseApi = () => `${localStorage.getItem('proxy')}/edge/${localStorage.getItem('thingType')}/${localStorage.getItem('thingId')}/_`",
        loader: 'js',
      }))
    },
  }],
})

const script = bundle.outputFiles[0].text
const responses = []
let directEdgeRequests = 0
let browser

after(async () => {
  await browser?.close()
})

test('all native image assignment paths use the cloud proxy in a remote edge page', async () => {
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
  }

  const page = await browser.newPage()
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'edge.test') {
      directEdgeRequests += 1
      await route.fulfill({ contentType: 'image/png', body: image })
      return
    }
    if (url.pathname === '/api/ui/edge/cloud/default/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
      return
    }
    if (url.pathname === '/static.png'
      || url.pathname === '/cloud-api/edge/device/gateway-1/_proxy'
      || url.pathname === '/cloud-api/edge/device/gateway-1/_/file/picture.png') {
      responses.push(url)
      await route.fulfill({ contentType: 'image/png', body: image })
      return
    }
    await route.fulfill({ status: 404, body: '' })
  })
  await page.goto('http://cloud.test/api/ui/edge/cloud/default/#/login?terminal=cloud-pc&thingId=gateway-1&thingType=device&token=cloud-token')
  await page.evaluate(() => {
    localStorage.setItem('terminal', 'cloud-pc')
    localStorage.setItem('thingId', 'gateway-1')
    localStorage.setItem('thingType', 'device')
    localStorage.setItem('proxy', '/cloud-api')
    localStorage.setItem('X-Access-Token', 'cloud-token')
  })
  await page.addScriptTag({ content: script })

  const edgeUrl = 'http://edge.test'
  const result = await page.evaluate(async (base) => {
    window.EdgeImageProxy.installEdgeImageProxy()

    const load = (imageElement) => new Promise((resolve, reject) => {
      imageElement.onload = () => resolve(imageElement.src)
      imageElement.onerror = () => reject(new Error(`image failed: ${imageElement.src}`))
      document.body.append(imageElement)
    })

    const propertyImage = new Image()
    propertyImage.src = `${base}/snapshot.png?channel=1`
    const propertySrc = await load(propertyImage)

    const attributeImage = document.createElement('img')
    attributeImage.setAttribute('src', `${base}/other.png`)
    const attributeSrc = await load(attributeImage)

    const fileImage = new Image()
    fileImage.src = `${base}/api/file/picture.png?accessKey=abc&:X_Access_Token=edge-token`
    const fileSrc = await load(fileImage)

    const staticImage = new Image()
    staticImage.src = '/static.png'
    const staticSrc = await load(staticImage)

    const srcsetImage = new Image()
    srcsetImage.srcset = `${base}/small.png 1x, ${base}/large.png 2x`
    srcsetImage.src = `${base}/fallback.png`
    const srcsetSrc = await load(srcsetImage)

    const cloudImage = new Image()
    cloudImage.src = `${window.location.origin}/static.png`
    const cloudSrc = await load(cloudImage)

    return { propertySrc, attributeSrc, fileSrc, staticSrc, srcsetSrc, srcset: srcsetImage.srcset, cloudSrc }
  }, edgeUrl)

  assert.equal(directEdgeRequests, 0)
  assert.equal(new URL(result.propertySrc).pathname, '/cloud-api/edge/device/gateway-1/_proxy')
  assert.equal(new URL(result.attributeSrc).pathname, '/cloud-api/edge/device/gateway-1/_proxy')
  assert.equal(new URL(result.fileSrc).pathname, '/cloud-api/edge/device/gateway-1/_/file/picture.png')
  assert.equal(new URL(result.staticSrc).pathname, '/static.png')
  assert.equal(new URL(result.cloudSrc).pathname, '/static.png')
  assert.match(result.srcset, /\/cloud-api\/edge\/device\/gateway-1\/_proxy/)
  assert.ok(result.srcsetSrc)

  const proxyUrls = responses.filter((url) => url.pathname.endsWith('/_proxy'))
  assert.ok(proxyUrls.length >= 3)
  assert.equal(proxyUrls[0].searchParams.get('url'), `${edgeUrl}/snapshot.png?channel=1`)
  assert.ok(proxyUrls.every((url) => url.searchParams.get(':X_Access_Token') === 'cloud-token'))

  const fileUrl = responses.find((url) => url.pathname.endsWith('/file/picture.png'))
  assert.equal(fileUrl.searchParams.get('accessKey'), 'abc')
  assert.equal(fileUrl.searchParams.get(':X_Access_Token'), 'cloud-token')

  const inserted = await page.evaluate(async (base) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `<img src="${base}/inserted.png">`
    document.body.append(wrapper)
    const imageElement = wrapper.querySelector('img')
    await new Promise((resolve, reject) => {
      imageElement.onload = resolve
      imageElement.onerror = reject
    })
    return imageElement.src
  }, edgeUrl)
  assert.equal(new URL(inserted).pathname, '/cloud-api/edge/device/gateway-1/_proxy')

  await page.evaluate(() => window.history.replaceState(null, '', '/ordinary/#/'))
  const ordinarySrc = await page.evaluate(async (base) => {
    const imageElement = new Image()
    imageElement.src = `${base}/ordinary.png`
    await new Promise((resolve, reject) => {
      imageElement.onload = resolve
      imageElement.onerror = reject
      document.body.append(imageElement)
    })
    return imageElement.src
  }, edgeUrl)
  assert.equal(ordinarySrc, `${edgeUrl}/ordinary.png`)
  assert.ok(directEdgeRequests >= 1)
})
