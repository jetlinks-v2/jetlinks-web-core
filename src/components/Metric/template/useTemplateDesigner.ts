import { computed, ref, watch, type Ref } from 'vue'
import { copy } from '../service'
import { nextNodeId, nodeKey, nodeList, type TemplateNode } from './designer'
import type { MetricTemplate } from '../types'

/** 一次抽屉会话共享快照；切换对象不提交，完成才替换父级模板。 */
export function useTemplateDesigner(template: Ref<MetricTemplate>, disabled: Ref<boolean>, commit: (value: MetricTemplate) => void) {
  const session = ref<MetricTemplate>()
  const selection = ref<TemplateNode>()
  const invalid = ref(false)
  const view = computed(() => session.value || template.value)
  const nodes = computed(() => nodeList(view.value))
  const position = computed(() => nodes.value.findIndex(node => selection.value && nodeKey(node) === nodeKey(selection.value)))
  function cancel() { session.value = undefined; selection.value = undefined; invalid.value = false }
  function select(node: TemplateNode) {
    if (invalid.value) return
    if (!session.value) session.value = copy(template.value)
    selection.value = node
  }
  function move(offset: number) { const node = nodes.value[position.value + offset]; if (node) select(node) }
  function finish() {
    if (invalid.value) return
    const value = session.value
    cancel()
    if (value && !disabled.value) commit(copy(value))
  }
  function patch(fields: Record<string, unknown>) {
    if (!session.value || !selection.value || disabled.value) return
    const { kind, index } = selection.value
    const key = kind === 'input' ? 'inputDefinitions' : kind === 'rule' ? 'definitions' : 'outputs'
    Object.assign(session.value[key][index], fields)
  }
  function add(kind: TemplateNode['kind']) {
    if (disabled.value || invalid.value) return
    if (!session.value) session.value = copy(template.value)
    const value = session.value
    if (kind === 'input') {
      value.inputDefinitions.push({ id: nextNodeId(value, 'input'), presence: 'required' })
      selection.value = { kind, index: value.inputDefinitions.length - 1 }
    } else if (kind === 'rule') {
      value.definitions.push({ id: nextNodeId(value, 'result'), type: 'composite', dependsOn: [], expression: '' })
      selection.value = { kind, index: value.definitions.length - 1 }
    } else {
      const id = value.definitions.at(-1)?.id || value.inputDefinitions.at(-1)?.id || ''
      value.outputs.push({ metricId: String(id), persist: true, publish: false })
      selection.value = { kind, index: value.outputs.length - 1 }
    }
  }
  function remove() {
    if (!session.value || !selection.value || disabled.value || invalid.value) return
    const previousPosition = position.value
    const { kind, index } = selection.value
    const key = kind === 'input' ? 'inputDefinitions' : kind === 'rule' ? 'definitions' : 'outputs'
    session.value[key].splice(index, 1)
    selection.value = nodes.value[Math.min(previousPosition, nodes.value.length - 1)]
    // 删除不静默级联改写引用；服务端编译会报告仍被引用的标识。
    if (!selection.value) finish()
  }
  watch(template, cancel, { flush: 'sync' })
  watch(disabled, cancel, { flush: 'sync' })
  return { session, selection, invalid, view, nodes, position, select, move, cancel, finish, patch, add, remove }
}
