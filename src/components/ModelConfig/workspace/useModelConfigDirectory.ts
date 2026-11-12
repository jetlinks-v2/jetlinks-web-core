import { computed, watch } from 'vue'
import type { ModelFile, TreeNode } from '../modelFileDirectory'
import type { FormatDetail, ModelConfigEmits, ModelConfigProps } from './types'
import type { ModelConfigState } from './useModelConfigState'

export function useModelConfigDirectory(props: ModelConfigProps, emit: ModelConfigEmits, state: ModelConfigState) {
  const { text, localFormatDetails, selectedFormat, modelId, files } = state
  const formatOptions = computed(() => {
    const options = localFormatDetails.value
      .flat()
      .filter(item => item?.id)
      .map(item => ({
        label: item.local ? `${item.name || item.id} (${item.id})` : item.name || item.id,
        value: item.id
      }))
    return [
      { label: text.value.allFormats, value: '' },
      ...options
    ]
  })

  const formatNameMap = computed(() => props.availableFormats.reduce<Map<string, string>>((map, item) => {
    if (item?.id) {
      map.set(item.id, item.name || item.id)
    }
    return map
  }, new Map()))

  const treeData = computed<TreeNode[]>(() => buildTree(files.value))

  watch(formatOptions, (options) => {
    const values = options.map(item => item.value)
    if (!values.includes(selectedFormat.value)) {
      selectedFormat.value = options[0]?.value as string || ''
      return
    }
  }, { immediate: true })

  watch(() => props.formatDetails, (formatDetails) => {
    localFormatDetails.value = cloneFormatDetails(formatDetails)
  }, { deep: true, immediate: true })

  watch([modelId, selectedFormat], () => {
    requestFiles()
  }, { immediate: true })

  function requestFiles() {
    if (!modelId.value) {
      files.value = []
      return
    }
    emit('load-files', {
      modelId: modelId.value,
      format: selectedFormat.value
    })
  }

  function buildTree(source: ModelFile[]): TreeNode[] {
    const fixedFolders = [
      { path: 'models', title: text.value.modelFiles },
      { path: 'python', title: text.value.codeFiles },
      { path: 'skill', title: text.value.skillFiles }
    ]
    const roots: TreeNode[] = fixedFolders.map(folder => ({
      title: formatRootFolderTitle(folder.title, folder.path),
      key: `folder:${folder.path}`,
      path: folder.path,
      children: []
    }))
    const folderMap = new Map<string, TreeNode>()
    roots.forEach(node => {
      if (node.path) {
        folderMap.set(node.path, node)
      }
    })
    source.forEach(file => {
      const segments = file.path?.split('/').filter(Boolean) || []
      let current = roots
      let pathKey = ''
      segments.forEach(segment => {
        pathKey = pathKey ? `${pathKey}/${segment}` : segment
        if (!folderMap.has(pathKey)) {
          const node: TreeNode = {
            title: segment,
            key: `folder:${pathKey}`,
            path: pathKey,
            children: []
          }
          folderMap.set(pathKey, node)
          current.push(node)
        }
        current = folderMap.get(pathKey)!.children!
      })
      current.push({
        title: file.name,
        key: file.id || `${file.path || ''}/${file.name}`,
        isFile: true,
        shared: !file.format?.length,
        file
      })
    })
    return roots
  }

  function formatRootFolderTitle(title: string, path: string) {
    return title && title !== path ? `${title}(${path})` : path
  }

  function cloneFormatDetails(formatDetails: FormatDetail[][]) {
    return (formatDetails || []).map(group => group.map(item => ({ ...item })))
  }

  return { formatOptions, formatNameMap, treeData, requestFiles }
}
