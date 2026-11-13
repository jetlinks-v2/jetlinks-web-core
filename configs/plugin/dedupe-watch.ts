import { lstatSync } from 'node:fs'
import * as path from 'node:path'
import type { FSWatcher, Plugin } from 'vite'

type WatchPaths = Parameters<FSWatcher['add']>[0]

/**
 * Vite 会反复 add root 外的文件，chokidar 3 的 FSEvents 后端却为每次 add 新建回调。
 * 只合并普通文件的显式注册，保留该后端对删除、原子替换及重建的持续监听。
 */
export function dedupeWatchPlugin(): Plugin {
  return {
    name: 'jetlinks-dedupe-watch',
    apply: 'serve',
    enforce: 'pre',
    configureServer({ watcher }) {
      // 其他后端已有文件去重。启用 glob 或动态忽略回调时，保留原生匹配语义。
      const ignored = [watcher.options.ignored].flat()
      if (!watcher.options.useFsEvents || !watcher.options.disableGlobbing
        || ignored.some(pattern => typeof pattern === 'function')) return

      const registered = new Set<string>()
      const cwd = watcher.options.cwd || process.cwd()
      const absolute = (file: string) => path.resolve(cwd, file)
      const add = watcher.add
      const unwatch = watcher.unwatch
      const close = watcher.close
      const list = (paths: WatchPaths) => typeof paths === 'string' ? [paths] : [...paths]

      /** 只失效实际关闭的显式文件；FSEvents 取消目录会忽略子文件，但保留其注册。 */
      const forget = (files: readonly string[]) => {
        const removed = files.map(absolute).filter(file => registered.has(file))
        if (removed.length) {
          unwatch.call(watcher, removed)
          for (const file of removed) registered.delete(file)
        }
      }

      watcher.add = function (paths, ...internal: unknown[]) {
        // chokidar 内部递归调用携带额外参数，不能把它当成一次用户注册。
        if (internal.length) return Reflect.apply(add, this, [paths, ...internal])
        const inputs = list(paths)
        if (inputs.some(input => input.startsWith('!'))) {
          // 原生 add 先处理整批否定路径；不能拆开重排这一批输入。
          forget(inputs.map(input => input.startsWith('!') ? input.slice(1) : input))
          return Reflect.apply(add, this, [paths])
        }
        const additions: string[] = []
        const forwarded: string[] = []
        try {
          for (const input of inputs) {
            if (input.includes('\0')) {
              forwarded.push(input)
              continue
            }
            const file = absolute(input)
            let regular = false
            try {
              regular = lstatSync(file).isFile()
            } catch {
              // FSEvents 的既有注册会继续监视删除后的重建；首次缺失仍交给原生实现。
              if (!registered.has(file)) forwarded.push(input)
              continue
            }
            if (!regular) {
              forget([file])
              forwarded.push(input)
              continue
            }
            if (registered.has(file)) continue
            // 在异步原生注册前占位，同一批次及并发转换均只注册一次。
            registered.add(file)
            additions.push(file)
            forwarded.push(file)
          }
          if (forwarded.length) Reflect.apply(add, this, [forwarded])
          return this
        } catch (error) {
          for (const file of additions) registered.delete(file)
          throw error
        }
      }

      watcher.unwatch = function (paths) {
        forget(list(paths))
        return unwatch.call(this, paths)
      }
      watcher.close = function () {
        registered.clear()
        return close.call(this)
      }
      // 原生注册异步报错时允许重试；错误仍由 Vite 原有监听器报告。
      watcher.on('error', (error: NodeJS.ErrnoException) => {
        if (error.path) forget([error.path])
        const watched = watcher.getWatched()
        for (const file of registered) {
          const directory = watcher.options.cwd ? path.relative(cwd, path.dirname(file)) || '.' : path.dirname(file)
          if (watched[directory]?.includes(path.basename(file))) continue
          // 不移除已删除文件的持续监听，只释放仍存在却未成功纳入监听的尝试。
          try {
            if (lstatSync(file).isFile()) registered.delete(file)
          } catch { /* 删除后的注册仍有效。 */ }
        }
      })
    },
  }
}
