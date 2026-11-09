import type { Slots, UnwrapNestedRefs } from 'vue'
import type { ModelConfigEmits, ModelConfigProps } from './types'
import { useModelConfigState } from './useModelConfigState'
import { useModelConfigDirectory } from './useModelConfigDirectory'
import { useModelConfigEditor } from './useModelConfigEditor'
import { useModelConfigFiles } from './useModelConfigFiles'
import { useModelConfigNavigation } from './useModelConfigNavigation'
import { useModelConfigResize } from './useModelConfigResize'

/** 共享工作区只编排原有状态和事件；业务请求继续由各宿主处理。 */
export function useModelConfigWorkspace(props: ModelConfigProps, emit: ModelConfigEmits, slots: Slots) {
  const state = useModelConfigState(props)
  const directory = useModelConfigDirectory(props, emit, state)
  const editor = useModelConfigEditor(props, emit, state, directory.requestFiles)
  const navigation = useModelConfigNavigation(props, state, editor)
  const resize = useModelConfigResize(state)
  const files = useModelConfigFiles(
    props, emit, slots, state, directory.requestFiles, editor.selectFile, resize.layoutEditor
  )
  return { props, ...state, ...directory, ...editor, ...navigation, ...files, ...resize }
}

export type ModelConfigWorkspace = UnwrapNestedRefs<ReturnType<typeof useModelConfigWorkspace>>
