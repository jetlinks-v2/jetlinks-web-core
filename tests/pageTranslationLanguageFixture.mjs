import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** 为连续翻译回归恢复两个额外语种，生产配置仍使用默认语言清单。 */
export const extraLanguagesFixture = {
  name: 'page-translation-extra-languages',
  setup(builder) {
    builder.onLoad({ filter: /[/\\]translation[/\\]languages\.ts$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8')
      const declaration = /const machineLanguages: readonly string\[\] = \[[^\]\n]*\]/
      assert.match(source, declaration)
      return {
        contents: source.replace(declaration, "const machineLanguages: readonly string[] = ['ko', 'zh-Hant']"),
        resolveDir: dirname(path),
        loader: 'ts',
      }
    })
  },
}
