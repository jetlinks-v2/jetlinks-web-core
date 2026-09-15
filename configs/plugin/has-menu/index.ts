import type { Plugin } from 'vite'
import { babelParse, MagicString, parse, type SFCTemplateBlock } from 'vue/compiler-sfc'

type TemplateNode = NonNullable<SFCTemplateBlock['ast']>['children'][number]
type ElementNode = Extract<TemplateNode, { type: 1 }>
type DirectiveNode = Extract<ElementNode['props'][number], { type: 7 }>

const incompatibleDirectives = new Set(['for', 'else', 'else-if', 'slot'])

/** 将表达式放回双引号 HTML 属性，保留实体与换行的原始语义。 */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;')
}

/** 把菜单判断变成结构条件，避免普通自定义指令执行时组件已初始化。 */
export function transformHasMenu(source: string, filename: string) {
  if (!source.includes('v-has-menu')) return null
  const { descriptor, errors } = parse(source, { filename })
  const template = descriptor.template
  if (!template || template.src || (template.lang && template.lang !== 'html')) return null
  if (errors.length) {
    const error = errors[0]
    const location = typeof error === 'object' && 'loc' in error ? error.loc?.start : undefined
    throw new Error(`[v-has-menu] ${filename}:${location?.line || 1}:${location?.column || 1} ${
      typeof error === 'string' ? error : error.message}`)
  }
  if (!template.ast) return null
  const output = new MagicString(source)

  /** 编译错误包含源位置，避免错误用法静默退化为无条件挂载。 */
  function fail(directive: DirectiveNode, message: string): never {
    const { line, column } = directive.loc.start
    throw new Error(`[v-has-menu] ${filename}:${line}:${column} ${message}`)
  }

  /** 校验单 code 表达式；变量的实际类型由模板类型检查和运行时保护负责。 */
  function getMenuExpression(directive: DirectiveNode): string {
    if (directive.arg || directive.modifiers.length) {
      fail(directive, '不支持参数或修饰符，请使用 v-has-menu="menuCode"。')
    }
    if (!directive.exp || directive.exp.type !== 4 || !directive.exp.content.trim()) {
      fail(directive, '必须提供单个菜单 code 表达式。')
    }
    const expression = directive.exp.content
    let statement
    try {
      statement = babelParse(`(${expression})`, { plugins: ['typescript'] }).program.body[0]
    } catch {
      fail(directive, '菜单 code 必须是有效的 JavaScript / TypeScript 表达式。')
    }
    if (statement.type === 'ExpressionStatement') {
      let value = statement.expression
      // TypeScript 断言不能把数组字面量伪装成单 code 参数。
      while (value.type === 'TSAsExpression' || value.type === 'TSSatisfiesExpression'
        || value.type === 'TSNonNullExpression' || value.type === 'TSTypeAssertion') {
        value = value.expression
      }
      if (value.type === 'ArrayExpression') fail(directive, '不支持菜单 code 数组，请传入单个字符串。')
    }
    return expression
  }

  /** 只编辑模板属性的源位置，保留 script、style、注释及原有模板结构。 */
  function visit(nodes: TemplateNode[]): void {
    for (const node of nodes) {
      if (node.type !== 1) continue
      const directives = node.props.filter((prop): prop is DirectiveNode => prop.type === 7)
      const menuDirectives = directives.filter(prop => prop.name === 'has-menu')
      const menuDirective = menuDirectives[0]
      if (menuDirective) {
        if (menuDirectives.length > 1) fail(menuDirective, '同一节点只能声明一次 v-has-menu。')
        const incompatible = directives.find(prop => incompatibleDirectives.has(prop.name))
        if (incompatible) {
          fail(menuDirective, `不能与 v-${incompatible.name} 放在同一节点，请将菜单条件放在独立的模板层级。`)
        }
        const expression = getMenuExpression(menuDirective)
        const condition = directives.find(prop => prop.name === 'if')
        let test = `$hasMenu((${expression}))`
        if (condition) {
          if (!condition.exp || condition.exp.type !== 4 || !condition.exp.content.trim()) {
            fail(condition, '同节点的 v-if 必须提供条件表达式。')
          }
          test = `(${condition.exp.content}) && ${test}`
          output.remove(condition.loc.start.offset, condition.loc.end.offset)
        }
        output.overwrite(menuDirective.loc.start.offset, menuDirective.loc.end.offset,
          `v-if="${escapeAttribute(test)}"`)
      }
      visit(node.children)
    }
  }

  visit(template.ast.children)
  if (!output.hasChanged()) return null
  return {
    code: output.toString(),
    map: output.generateMap({ source: filename, includeContent: true, hires: true }),
  }
}

/** 开发及所有构建模式共用转换，仅处理原始 SFC，避免重复处理虚拟子模块。 */
export function hasMenuPlugin(): Plugin {
  return {
    name: 'jetlinks:has-menu',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('.vue') || id.includes('?') || /[/\\]node_modules[/\\]/.test(id)) return null
      return transformHasMenu(source, id)
    },
  }
}
