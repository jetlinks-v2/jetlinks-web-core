import { computed, inject, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { expressionLabel, type TemplateRule } from '../designer'
import { expressionToDisplayFormula, formulaMacros, ruleFormulaReferences } from '../formula'
import type { MetricCalculatorDescriptor, MetricTemplate } from '../../types'
import { metricCalculatorsKey } from '../../calculatorContext'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../../messages'
import { expressionStory } from './semantic'

export function useFormulaDisplay(props: { template: MetricTemplate; rule: TemplateRule; expression: string; calculators?: MetricCalculatorDescriptor[]; semanticOnly?: boolean }) {
  const shared = inject(metricCalculatorsKey, undefined)
  const { t, locale } = useI18n({ useScope:'local', messages:metricMessages })
  const story = computed(() => expressionStory(props.template, props.rule, props.expression, props.calculators || shared?.value || [], String(locale.value), t))
  const references = computed(() => ruleFormulaReferences(props.template, props.rule, props.calculators || shared?.value))
  const label = computed(() => expressionLabel(props.template, props.expression,
    new Map(references.value.filter(item => item.group === 'data').map(item => [item.expression, item.label]))))
  const latex = computed(() => props.semanticOnly ? undefined : expressionToDisplayFormula(props.expression, references.value))
  const render = shallowRef<typeof import('mathlive').convertLatexToMarkup>()
  let loading = false
  let disposed = false
  onBeforeUnmount(() => { disposed = true })
  onMounted(() => watch(latex, async value => {
    if (!value || loading || render.value) return
    loading = true
    try {
      const [mathlive] = await Promise.all([import('mathlive'), import('mathlive/static.css')])
      if (!disposed) render.value = mathlive.convertLatexToMarkup
    } catch { /* The readable expression remains available if resources fail to load. */ }
  }, { immediate: true }))
  const markup = computed(() => {
    if (!latex.value || !render.value) return ''
    // Only the restricted AST and escaped reference macros reach the HTML renderer.
    try { return render.value(latex.value, { macros: formulaMacros(references.value), defaultMode: 'math' }) }
    catch { return '' }
  })
  return { label, markup, story, t }
}
