import type { MetricTemplate } from '../types'
import type { TemplateRule } from './designer'

/** The visual editor supports numeric formulas; other SpEL stays in the advanced editor. */
export interface FormulaReference { key: string; label: string; expression: string; metricId?: string; group?: 'data' | 'parameter' }
export const formulaFunctions = ['abs', 'min', 'max', 'round', 'sqrt'] as const
type FunctionName = typeof formulaFunctions[number]
type Node = { kind: 'number'; value: string } | { kind: 'reference'; reference: FormulaReference }
  | { kind: 'unary'; operator: string; value: Node }
  | { kind: 'binary'; operator: string; left: Node; right: Node }
  | { kind: 'function'; name: FunctionName; args: Node[] }
type Token = string | Node
const precedence: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6 }
const latexOperators: Record<string, string> = { '*': '\\times ', '||': '\\lor ', '&&': '\\land ', '==': '=', '!=': '\\ne ', '<=': '\\le ', '>=': '\\ge ' }

export function ruleDataReferences(template: MetricTemplate, rule: TemplateRule) {
  return [
    ...template.inputDefinitions.map(item => ({ id: item.id, label: item.name || item.id })),
    ...template.definitions.slice(0, template.definitions.findIndex(item => item.id === rule.id)).map(item => ({ id: String(item.id), label: template.outputs.find(output => output.metricId === item.id)?.label || String(item.id) })),
  ]
}

/** Editing and read-only display use the same backend input aliases and parameter paths. */
export function ruleFormulaReferences(template: MetricTemplate, rule: TemplateRule): FormulaReference[] {
  const dataAlias = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_')
  return [
    ...ruleDataReferences(template, rule).map(item => ({ key: item.id, label: item.label, metricId: item.id, group: 'data' as const,
      expression: dataAlias(rule.inputs?.find(input => !input.source && input.metricId === item.id)?.id || item.id) })),
    ...(rule.inputs || []).flatMap(item => item.source && item.id ? [{ key: `source:${item.id}`, label: item.id, group: 'data' as const, expression: dataAlias(item.id) }] : []),
    ...template.parameterDefinitions.map(item => ({ key: `parameter:${item.id}`, label: item.name || item.id, group: 'parameter' as const,
      expression: /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(item.id) ? `params.${item.id}` : `params['${item.id.replaceAll("'", "''")}']` })),
  ]
}

// Alphabetic macro names survive MathLive serialization and never depend on display labels.
export function referenceMacro(index: number): string {
  let letters = ''
  do { letters = String.fromCharCode(97 + index % 26) + letters; index = Math.floor(index / 26) - 1 } while (index >= 0)
  return `JL${letters}`
}
export function formulaMacros(references: FormulaReference[]) {
  return Object.fromEntries(references.map((item, index) => [referenceMacro(index), {
    def: `\\text{${item.label.replace(/[\\{}%$&#_^~]/g, ' ')}}`, captureSelection: true, expand: false,
  }]))
}

function parse(tokens: Token[]): Node {
  let cursor = 0
  function primary(): Node {
    const token = tokens[cursor++]
    if (typeof token === 'object') return token
    if (token === '+' || token === '-' || token === '!') return { kind: 'unary', operator: token, value: primary() }
    if (token === '(' || token === '{') {
      const node = expression(0)
      if (tokens[cursor++] !== (token === '(' ? ')' : '}')) throw new Error('group')
      return node
    }
    if (formulaFunctions.includes(token as FunctionName)) {
      if (tokens[cursor++] !== '(') throw new Error('function')
      const args = [expression(0)]
      while (tokens[cursor] === ',') { cursor++; args.push(expression(0)) }
      if (tokens[cursor++] !== ')') throw new Error('function')
      const name = token as FunctionName
      if ((name === 'abs' || name === 'sqrt') && args.length !== 1 || name === 'round' && args.length > 2) throw new Error('arity')
      return { kind: 'function', name, args }
    }
    throw new Error('operand')
  }
  function expression(minimum: number): Node {
    let left = primary()
    while (typeof tokens[cursor] === 'string' && (precedence[tokens[cursor] as string] || 0) > minimum) {
      const operator = tokens[cursor++] as string
      left = { kind: 'binary', operator, left, right: expression(precedence[operator]) }
    }
    return left
  }
  const result = expression(0)
  if (cursor !== tokens.length) throw new Error('trailing')
  return result
}

function sourceTokens(source: string, references: FormulaReference[], conditions = false): Token[] {
  const tokens: Token[] = []
  // SpEL supports both root properties and #variables. Match either without rewriting source text.
  const ordered = references.flatMap(reference => [reference.expression,
    reference.expression.startsWith('#') ? reference.expression.slice(1) : `#${reference.expression}`,
  ].map(expression => ({ reference, expression }))).sort((a, b) => b.expression.length - a.expression.length)
  let rest = source.trim()
  while (rest) {
    const reference = ordered.find(item => rest.startsWith(item.expression) && !/[\w$]/.test(rest[item.expression.length] || ''))
    if (reference) { tokens.push({ kind: 'reference', reference: reference.reference }); rest = rest.slice(reference.expression.length).trimStart(); continue }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    const fn = rest.match(/^\$math\.(abs|min|max|round|sqrt)\b/)
    const condition = conditions && rest.match(/^(?:&&|\|\||==|!=|<=|>=|[!<>])/)
    if (number) { tokens.push({ kind: 'number', value: number[0] }); rest = rest.slice(number[0].length) }
    else if (fn) { tokens.push(fn[1]); rest = rest.slice(fn[0].length) }
    else if (condition) { tokens.push(condition[0]); rest = rest.slice(condition[0].length) }
    else if (/^[()+\-*/,]/.test(rest)) { tokens.push(rest[0]); rest = rest.slice(1) }
    else throw new Error('unsupported')
    rest = rest.trimStart()
  }
  return tokens
}

function latexTokens(latex: string, references: FormulaReference[]): Token[] {
  let rest = latex.trim()
  const tokens: Token[] = []
  function group(): Token[] {
    rest = rest.trimStart()
    if (rest[0] !== '{') throw new Error('group')
    let depth = 1; let end = 1
    while (end < rest.length && depth) { if (rest[end] === '{') depth++; if (rest[end] === '}') depth--; end++ }
    if (depth) throw new Error('group')
    const content = rest.slice(1, end - 1); rest = rest.slice(end)
    return latexTokens(content, references)
  }
  while (rest) {
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    const command = rest.match(/^\\([a-zA-Z]+|[,;! ])/)
    if (number) { tokens.push({ kind: 'number', value: number[0] }); rest = rest.slice(number[0].length) }
    else if (command) {
      const name = command[1]; rest = rest.slice(command[0].length)
      const index = references.findIndex((_item, i) => referenceMacro(i) === name)
      if (index >= 0) tokens.push({ kind: 'reference', reference: references[index] })
      else if (['left', 'right', ',', ';', '!', ' '].includes(name)) { /* Presentation only. */ }
      else if (name === 'times' || name === 'cdot') tokens.push('*')
      else if (name === 'div') tokens.push('/')
      else if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const numerator = group(); const denominator = group()
        tokens.push('(', ...numerator, ')', '/', '(', ...denominator, ')')
      } else if (name === 'sqrt') tokens.push('sqrt', '(', ...group(), ')')
      else if (name === 'mathord') tokens.push('(', ...group(), ')')
      else if (name === 'operatorname' || name === 'mathrm') {
        // MathLive normalizes inserted function names to operatorname{mathrm{name}}.
        const fn = rest.match(/^\{(?:(abs|min|max|round|sqrt)|\\mathrm\{(abs|min|max|round|sqrt)\})\}/)
        if (!fn) throw new Error('unsupported')
        tokens.push(fn[1] || fn[2]); rest = rest.slice(fn[0].length)
      } else if (formulaFunctions.includes(name as FunctionName)) tokens.push(name)
      else throw new Error('unsupported')
    } else if (/^[{}()+\-*/,]/.test(rest)) { tokens.push(rest[0]); rest = rest.slice(1) }
    else throw new Error('unsupported')
    rest = rest.trimStart()
  }
  return tokens
}

function toLatex(node: Node, references: FormulaReference[], parentPrecedence = 0): string {
  switch (node.kind) {
    case 'number': return node.value
    case 'reference': return `\\mathord{\\${referenceMacro(references.indexOf(node.reference))}}`
    case 'unary': return `${node.operator === '!' ? '\\lnot ' : node.operator}${toLatex(node.value, references, 7)}`
    case 'function': return node.name === 'sqrt' ? `\\sqrt{${toLatex(node.args[0], references)}}`
      : `\\operatorname{${node.name}}\\left(${node.args.map(item => toLatex(item, references)).join(',')}\\right)`
    case 'binary': {
      if (node.operator === '/') return `\\frac{${toLatex(node.left, references)}}{${toLatex(node.right, references)}}`
      const level = precedence[node.operator]
      const content = `${toLatex(node.left, references, level)}${latexOperators[node.operator] || node.operator}${toLatex(node.right, references, level + 1)}`
      return level < parentPrecedence ? `\\left(${content}\\right)` : content
    }
  }
}
function toSource(node: Node): string {
  switch (node.kind) {
    case 'number': return node.value
    case 'reference': return node.reference.expression
    case 'unary': return `${node.operator}(${toSource(node.value)})`
    case 'function': return `$math.${node.name}(${node.args.map(toSource).join(', ')})`
    case 'binary': return `(${toSource(node.left)} ${node.operator} ${toSource(node.right)})`
  }
}

/** undefined selects advanced mode without altering the original expression. */
export function expressionToFormula(source: string, references: FormulaReference[]): string | undefined {
  if (!source.trim()) return ''
  try { return toLatex(parse(sourceTokens(source, references)), references) } catch { return undefined }
}

/** Read-only conditions share the numeric AST without broadening the formula editor. */
export function expressionToDisplayFormula(source: string, references: FormulaReference[]): string | undefined {
  if (!source.trim()) return ''
  try { return toLatex(parse(sourceTokens(source, references, true)), references) } catch { return undefined }
}

/** Incomplete visual drafts throw and must not overwrite the last valid rule. */
export function formulaToExpression(latex: string, references: FormulaReference[]): { expression: string; metricIds: string[] } {
  const node = parse(latexTokens(latex, references))
  const ids = new Set<string>()
  function visit(item: Node) {
    if (item.kind === 'reference' && item.reference.metricId) ids.add(item.reference.metricId)
    else if (item.kind === 'binary') { visit(item.left); visit(item.right) }
    else if (item.kind === 'unary') visit(item.value)
    else if (item.kind === 'function') item.args.forEach(visit)
  }
  visit(node)
  return { expression: toSource(node), metricIds: [...ids] }
}
