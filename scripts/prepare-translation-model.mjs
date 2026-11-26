import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import pack from '../src/locales/translation/local/pack.json' with { type: 'json' }

const repository = process.env.TRANSLATION_MODEL_ORIGIN || 'https://huggingface.co'
const root = fileURLToPath(new URL(`../public/local-translation/${pack.version}/`, import.meta.url))
const engine = dirname(fileURLToPath(import.meta.resolve('@huggingface/transformers')))
const readyFile = join(root, 'pack.json')
await mkdir(root, { recursive: true })
await rm(readyFile, { force: true })

async function verify(path, file) {
  if ((await stat(path)).size !== file.size) return false
  if (!file.sha256) return true
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex') === file.sha256
}

async function download(file) {
  const target = join(root, 'model', file.path)
  if (await verify(target, file).catch(() => false)) return
  await mkdir(dirname(target), { recursive: true })
  const url = new URL(`/${pack.repository}/resolve/${pack.revision}/${file.path}`, repository)
  const temporary = `${target}.${process.pid}.part`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15 * 60_000) })
    if (!response.ok || !response.body) throw new Error(`${file.path} HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
    if (!await verify(temporary, file)) throw new Error(`Model file verification failed: ${file.path}`)
    await rename(temporary, target)
    console.log(`${file.path}: ${file.size} bytes`)
  } finally {
    await rm(temporary, { force: true })
  }
}

const downloads = await Promise.allSettled(pack.modelFiles.map(download))
for (const outcome of downloads) if (outcome.status === 'rejected') throw outcome.reason
for (const file of pack.runtimeFiles) {
  const target = join(root, file.path)
  await copyFile(join(engine, file.path), target)
  if (!await verify(target, file)) throw new Error(`Runtime version mismatch: ${file.path}`)
}
const attribution = await readFile(new URL('../src/locales/translation/local/model-LICENSE.txt', import.meta.url))
await writeFile(join(root, 'LICENSE.txt'), attribution)
await writeFile(readyFile, JSON.stringify({ version: pack.version }))
console.log(`Firefox model pack: ${[...pack.modelFiles, ...pack.runtimeFiles].reduce((sum, file) => sum + file.size, 0)} bytes`)
