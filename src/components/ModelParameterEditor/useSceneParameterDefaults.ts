import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import {
  asRecord,
  hasOwn,
  hasPath,
  isTargetInferenceProperty,
  normalizeParameterProperties,
  readPath,
  removePath,
  writePath,
  type ParameterRecord
} from './modelParameterUtils'
import type {
  ModelParameterProperty,
  ModelParameterScene,
  ModelParameterSceneMode
} from './types'

const sceneKeys: ModelParameterScene[] = ['setupTranscode', 'processImage']

export function useSceneParameterDefaults(
  localDefinition: Ref<ParameterRecord>,
  properties: ComputedRef<ModelParameterProperty[]>
) {
  const sceneModes = ref<Record<ModelParameterScene, ModelParameterSceneMode>>({
    setupTranscode: 'user',
    processImage: 'user'
  })
  const sceneDefaultTexts = ref<Record<ModelParameterScene, string>>({
    setupTranscode: '{}',
    processImage: '{}'
  })
  const sceneDefaultInvalids = ref<Record<ModelParameterScene, boolean>>({
    setupTranscode: false,
    processImage: false
  })

  const userParameterPaths = computed(() => properties.value.map(property => property.property))

  function getParameterPaths(definition: ParameterRecord) {
    return definition === localDefinition.value
      ? userParameterPaths.value
      : normalizeParameterProperties(definition).map(property => property.property)
  }

  function getSceneDefaultParams(scene: ModelParameterScene, definition = localDefinition.value) {
    const values = cloneDeep(asRecord(definition[scene]) || {})
    getParameterPaths(definition).forEach(property => removePath(values, property))
    Object.keys(values)
      .filter(isTargetInferenceProperty)
      .forEach(property => delete values[property])
    return values
  }

  function syncSceneDefaultTexts() {
    sceneKeys.forEach(scene => {
      if (!sceneDefaultInvalids.value[scene]) {
        sceneDefaultTexts.value[scene] = JSON.stringify(getSceneDefaultParams(scene), null, 2)
      }
    })
  }

  function resetSceneDefaultDrafts() {
    sceneDefaultInvalids.value = {
      setupTranscode: false,
      processImage: false
    }
    syncSceneDefaultTexts()
  }

  function parseSceneDefaultText(scene: ModelParameterScene) {
    const value = sceneDefaultTexts.value[scene].trim()
    if (!value) return {}
    try {
      const record = asRecord(JSON.parse(value))
      return record || undefined
    } catch {
      return undefined
    }
  }

  // User-configurable paths are protected when default JSON is edited or contains a copied value.
  function mergeSceneDefaults(
    definition: ParameterRecord,
    scene: ModelParameterScene,
    defaults: ParameterRecord,
    paths: string[]
  ) {
    const current = asRecord(definition[scene]) || {}
    const next = cloneDeep(defaults)
    Object.keys(next)
      .filter(isTargetInferenceProperty)
      .forEach(property => delete next[property])
    Object.entries(current)
      .filter(([property]) => isTargetInferenceProperty(property))
      .forEach(([property, value]) => {
        next[property] = cloneDeep(value)
      })
    paths.forEach(property => {
      if (!hasPath(current, property)) return
      const value = cloneDeep(readPath(current, property))
      removePath(next, property)
      if (hasOwn(current, property)) next[property] = value
      else writePath(next, property, value)
    })
    return next
  }

  function applySceneDefaultTexts(definition: ParameterRecord) {
    const paths = getParameterPaths(definition)
    const next = cloneDeep(definition)
    for (const scene of sceneKeys) {
      const defaults = parseSceneDefaultText(scene)
      if (!defaults) return undefined
      next[scene] = mergeSceneDefaults(next, scene, defaults, paths)
    }
    return next
  }

  function updateSceneDefaults(scene: ModelParameterScene, value: string) {
    sceneDefaultTexts.value[scene] = value
    const defaults = parseSceneDefaultText(scene)
    if (!defaults) {
      sceneDefaultInvalids.value[scene] = true
      return undefined
    }
    sceneDefaultInvalids.value[scene] = false
    const next = cloneDeep(localDefinition.value)
    next[scene] = mergeSceneDefaults(next, scene, defaults, userParameterPaths.value)
    return next
  }

  function setSceneMode(scene: ModelParameterScene, value: unknown) {
    if (value === 'user' || value === 'default') {
      sceneModes.value[scene] = value
    }
  }

  return {
    sceneModes,
    sceneDefaultTexts,
    sceneDefaultInvalids,
    resetSceneDefaultDrafts,
    syncSceneDefaultTexts,
    updateSceneDefaults,
    applySceneDefaultTexts,
    setSceneMode
  }
}
