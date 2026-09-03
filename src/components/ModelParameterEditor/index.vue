<template>
  <div class="model-parameter-editor">
    <a-tabs v-model:activeKey="activeTab" class="model-parameter-editor__tabs">
      <a-tab-pane key="config" :tab="locale.parameterConfig" />
      <a-tab-pane key="targetInference" :tab="locale.targetInference" />
      <a-tab-pane key="realtime" :tab="locale.realtime" />
      <a-tab-pane key="image" :tab="locale.imageTest" />
      <a-tab-pane key="others" :tab="locale.others" />
    </a-tabs>

    <div class="model-parameter-editor__body">
      <div v-show="activeTab === 'config'">
        <ParameterConfigTable
          ref="parameterConfigTableRef"
          :definition="localDefinition"
          :properties="properties"
          :editing="editing"
          :locale="locale"
          @update:preview="commit"
        />
      </div>

      <div v-show="activeTab === 'targetInference'">
        <TargetInferenceEditor
          ref="targetInferenceEditorRef"
          :definition="localDefinition"
          :files="files"
          :locale="locale"
          :editing="editing"
          @update:target-inference="updateTargetInference"
        />
      </div>

      <div v-show="activeTab === 'realtime' || activeTab === 'image'">
        <ParameterScenePanel
          :scene="activeScene"
          :description="sceneDescription"
          :mode="sceneMode"
          :mode-options="sceneModeOptions"
          :properties="sceneProperties"
          :values="sceneParams(activeScene)"
          :default-text="sceneDefaultText"
          :default-invalid="sceneDefaultInvalid"
          :files="files"
          :locale="locale"
          :editing="editing"
          :invalid-properties="activeScene === 'processImage' ? imageUserInvalidProperties : []"
          @update:mode="setSceneMode"
          @update:value="updateSceneValue(activeScene, $event.property, $event.value)"
          @update:defaults="updateSceneDefaults(activeScene, $event)"
        />
      </div>

      <div v-show="activeTab === 'others'">
        <ParameterOthersPanel
          :text="othersText"
          :invalid="othersInvalid"
          :locale="locale"
          :editing="editing"
          @update:text="updateOthers"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { cloneDeep } from 'lodash-es'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import ParameterConfigTable from './ParameterConfigTable.vue'
import ParameterOthersPanel from './ParameterOthersPanel.vue'
import ParameterScenePanel from './ParameterScenePanel.vue'
import TargetInferenceEditor from './TargetInferenceEditor.vue'
import { defaultModelParameterLocale } from './defaultLocale'
import {
  asRecord,
  isTargetInferenceProperty,
  normalizeParameterProperties,
  removePath,
  stringifyJson,
  writePath,
  type ParameterRecord
} from './modelParameterUtils'
import {
  setTargetInference,
  type TargetInferenceEditorValue
} from './targetInferenceUtils'
import { validateImageUserParameters } from './sceneParameterValidation'
import { useSceneParameterDefaults } from './useSceneParameterDefaults'
import type {
  ModelParameterDefinitionSource,
  ModelParameterFile,
  ModelParameterLocale,
  ModelParameterProperty,
  ModelParameterScene,
  ModelParameterSceneMode
} from './types'

type ParameterTab = 'config' | 'realtime' | 'image' | 'targetInference' | 'others'

interface ParameterConfigTableExpose {
  prepareForSave: () => ParameterRecord | undefined
}

interface TargetInferenceEditorExpose {
  prepareForSave: () => TargetInferenceEditorValue | undefined
}

const props = defineProps({
  definition: {
    type: Object as PropType<ParameterRecord>,
    default: () => ({})
  },
  files: {
    type: Array as PropType<ModelParameterFile[]>,
    default: () => []
  },
  editing: {
    type: Boolean,
    default: false
  },
  locale: {
    type: Object as PropType<Partial<ModelParameterLocale>>,
    default: () => ({})
  }
})

const emit = defineEmits<{
  (event: 'update:definition', value: ParameterRecord): void
}>()

const activeTab = ref<ParameterTab>('config')
const parameterConfigTableRef = ref<ParameterConfigTableExpose>()
const targetInferenceEditorRef = ref<TargetInferenceEditorExpose>()
const localDefinition = ref<ParameterRecord>({})
const othersText = ref('{}')
const othersInvalid = ref(false)
const imageUserInvalidProperties = ref<string[]>([])

const locale = computed(() => ({ ...defaultModelParameterLocale, ...props.locale }))
const allProperties = computed(() => normalizeParameterProperties(localDefinition.value))
const properties = computed(() => allProperties.value.filter(property => (
  !isTargetInferenceProperty(property.property)
)))
const sceneDefaults = useSceneParameterDefaults(localDefinition, allProperties)
const activeScene = computed<ModelParameterScene>(() => activeTab.value === 'image' ? 'processImage' : 'setupTranscode')
const activeDefinitionSource = computed<ModelParameterDefinitionSource>(() => (
  activeTab.value === 'image' ? 'testParams' : 'params'
))
const sceneProperties = computed(() => properties.value.filter(property => (
  isApplicable(activeDefinitionSource.value, property)
)))
const sceneMode = computed(() => sceneDefaults.sceneModes.value[activeScene.value])
const sceneModeOptions = computed<Array<{ label: string; value: ModelParameterSceneMode }>>(() => [
  { label: locale.value.userParameters, value: 'user' },
  { label: locale.value.defaultParameters, value: 'default' }
])
const sceneDescription = computed(() => {
  if (activeScene.value === 'processImage') {
    return sceneMode.value === 'user'
      ? locale.value.imageUserDescription
      : locale.value.imageDefaultDescription
  }
  return sceneMode.value === 'user'
    ? locale.value.realtimeUserDescription
    : locale.value.realtimeDefaultDescription
})
const sceneDefaultText = computed(() => sceneDefaults.sceneDefaultTexts.value[activeScene.value])
const sceneDefaultInvalid = computed(() => sceneDefaults.sceneDefaultInvalids.value[activeScene.value])

watch(() => props.definition, value => {
  localDefinition.value = cloneDeep(value || {})
  sceneDefaults.resetSceneDefaultDrafts()
}, { immediate: true, deep: true })

watch(() => props.editing, () => {
  imageUserInvalidProperties.value = []
})

watch(() => localDefinition.value.others, value => {
  othersText.value = stringifyJson(value)
  othersInvalid.value = false
}, { immediate: true, deep: true })
function isApplicable(source: ModelParameterDefinitionSource, property: ModelParameterProperty) {
  return Boolean(source === 'params' ? property.paramsDefinition : property.testParamsDefinition)
}

function sceneParams(scene: ModelParameterScene) {
  return asRecord(localDefinition.value[scene]) || {}
}

function setSceneMode(value: unknown) {
  sceneDefaults.setSceneMode(activeScene.value, value)
}

function updateSceneDefaults(scene: ModelParameterScene, value: string) {
  const next = sceneDefaults.updateSceneDefaults(scene, value)
  if (next) commit(next)
}

function updateSceneValue(scene: ModelParameterScene, property: string, value: unknown) {
  const next = cloneDeep(localDefinition.value)
  const params = asRecord(next[scene]) || {}
  if (value === undefined) removePath(params, property)
  else writePath(params, property, cloneDeep(value))
  next[scene] = params
  if (scene === 'processImage') {
    imageUserInvalidProperties.value = validateImageUserParameters(next)
  }
  commit(next)
}

function updateOthers(value: string) {
  othersText.value = value
  if (!value.trim()) {
    othersInvalid.value = false
    commit({ ...cloneDeep(localDefinition.value), others: {} })
    return
  }
  try {
    othersInvalid.value = false
    commit({ ...cloneDeep(localDefinition.value), others: JSON.parse(value) })
  } catch {
    othersInvalid.value = true
  }
}

function updateTargetInference(value: TargetInferenceEditorValue) {
  commit(setTargetInference(
    localDefinition.value,
    value.targetInference,
    value.parameterDefinitions
  ))
}

// Keep validation navigation here so future scene validators can select their own tab and mode.
function activateValidationTab(
  tab: ParameterTab,
  scene?: ModelParameterScene,
  mode: ModelParameterSceneMode = 'default'
) {
  activeTab.value = tab
  if (scene) sceneDefaults.setSceneMode(scene, mode)
}

function prepareForSave() {
  const prepared = parameterConfigTableRef.value?.prepareForSave()
  if (prepared === undefined) {
    activateValidationTab('config')
    return undefined
  }
  const targetInference = targetInferenceEditorRef.value?.prepareForSave()
  if (targetInference === undefined) {
    activateValidationTab('targetInference')
    return undefined
  }
  const withTargetInference = setTargetInference(
    prepared,
    targetInference.targetInference,
    targetInference.parameterDefinitions
  )
  if (sceneDefaults.sceneDefaultInvalids.value.setupTranscode) {
    activateValidationTab('realtime', 'setupTranscode')
    return undefined
  }
  if (sceneDefaults.sceneDefaultInvalids.value.processImage) {
    activateValidationTab('image', 'processImage')
    return undefined
  }
  imageUserInvalidProperties.value = validateImageUserParameters(withTargetInference)
  if (imageUserInvalidProperties.value.length) {
    commit(withTargetInference)
    activateValidationTab('image', 'processImage', 'user')
    return undefined
  }
  const withSceneDefaults = sceneDefaults.applySceneDefaultTexts(withTargetInference)
  if (!withSceneDefaults) return undefined
  // Scene default JSON is merged independently; restore the shared target-inference
  // tree afterwards so default-enabled capabilities reach every execution scene.
  const finalDefinition = setTargetInference(
    withSceneDefaults,
    targetInference.targetInference,
    targetInference.parameterDefinitions
  )
  commit(finalDefinition)
  return finalDefinition
}

function commit(next: ParameterRecord) {
  // Keep parameter definitions and scene default values in the same definition draft without dropping unrelated keys.
  localDefinition.value = next
  sceneDefaults.syncSceneDefaultTexts()
  emit('update:definition', cloneDeep(next))
}

defineExpose({ prepareForSave })
</script>
<style src="./style.less" scoped lang="less"></style>
