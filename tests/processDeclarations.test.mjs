import assert from 'node:assert/strict'
import test from 'node:test'
import { createComponentLoader, createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

test('编辑语义类型保留原身份及角色，错误角色来源仍不能满足输入声明', () => {
  const load = createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '../ObjectOverview/ObjectInputValue.vue': { __esModule: true, default: { render: () => null } }
  })
  const component = load('components/Process/ProcessDeclarations.vue').default
  const { sourceMatchesSemantics } = load('data-capability/sourceSchema.ts')
  const semantics = { semanticId: 'urn:actual-temperature', semanticTypes: ['urn:temperature'], semanticRole: 'observed' }
  const template = { inputs: { value: { name: 'Value', type: 'number', semantics } }, actions: {}, parameters: {} }
  const wrongSource = { semanticId: semantics.semanticId, semanticTypes: ['urn:temperature', 'urn:quantity'], semanticRole: 'setpoint' }
  const { renderer, root } = createComponentRenderer()
  let emitted
  const app = renderer.createApp(component, { modelValue: template, 'onUpdate:modelValue': value => { emitted = value } })
  app.config.warnHandler = () => {}
  app.mount(root)
  try {
    const selector = walk(root, node => node.type === 'a-select' && node.props.mode === 'tags')[0]
    selector.props['onUpdate:value'](['urn:temperature', 'urn:quantity'])
    assert.deepEqual(emitted.inputs.value.semantics, { ...semantics, semanticTypes: ['urn:temperature', 'urn:quantity'] })
    assert.equal(sourceMatchesSemantics(emitted.inputs.value.semantics, wrongSource), false)
    assert.equal(sourceMatchesSemantics(emitted.inputs.value.semantics, { ...wrongSource, semanticRole: 'observed' }), true)
    assert.equal(sourceMatchesSemantics(emitted.inputs.value.semantics, { ...wrongSource, semanticRole: 'observed', semanticId: 'urn:other' }), false)
    assert.deepEqual(template.inputs.value.semantics, semantics)
  } finally { app.unmount() }
})
