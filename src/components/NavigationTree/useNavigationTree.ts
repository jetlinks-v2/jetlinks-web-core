import { computed, ref, watch } from 'vue'
import { navigationTreeModel } from './model'
import type { NavigationTreeKey, NavigationTreeProps } from './types'

/** 持有目录交互；受控展开键仍由宿主持久化，搜索展开不会覆盖宿主偏好。 */
export function useNavigationTree(
  props: Readonly<NavigationTreeProps>,
  onExpandedChange: (keys: NavigationTreeKey[]) => void,
  onSearchChange: (value: string) => void,
) {
  const model = computed(() => navigationTreeModel(props.fieldNames))
  const localExpanded = ref<NavigationTreeKey[]>([])
  const userExpanded = computed(() => props.expandedKeys ?? localExpanded.value)
  const localSearch = ref('')
  const searchValue = computed({
    get: () => props.searchValue ?? localSearch.value,
    set: value => { localSearch.value = value; onSearchChange(value) },
  })
  const searching = computed(() => Boolean(searchValue.value.trim()))
  const filtered = computed(() => model.value.filter(props.treeData ?? [], searchValue.value, props.searchNodeKey, props.getSearchText))
  const expandedKeys = computed(() => searching.value ? model.value.branchKeys(filtered.value.nodes) : userExpanded.value)
  let initialized = false
  let lastSelection = ''
  let lastRoot = props.searchNodeKey
  function updateExpanded(keys: NavigationTreeKey[]) {
    localExpanded.value = keys
    onExpandedChange(keys)
  }
  const selectionKeys = () => props.selectedKeys ?? props.defaultSelectedKeys ?? []
  watch([() => props.treeData, selectionKeys, () => props.searchNodeKey, () => props.fieldNames], () => {
    if (lastRoot !== props.searchNodeKey) {
      initialized = false
      lastSelection = ''
      lastRoot = props.searchNodeKey
      if (props.expandedKeys === undefined) localExpanded.value = []
    }
    const nodes = props.treeData ?? []
    if (!nodes.length) return
    let keys = userExpanded.value
    const first = !initialized
    if (first) {
      initialized = true
      keys = props.expandedKeys ?? props.defaultExpandedKeys ?? (props.defaultExpandAll
        ? model.value.branchKeys(nodes)
        : model.value.initialKeys(nodes, props.defaultExpandDepth ?? 2, props.searchNodeKey))
    }
    const paths = selectionKeys().map(key => model.value.ancestors(nodes, key))
    const selection = JSON.stringify([selectionKeys(), paths])
    if (first || selection !== lastSelection) {
      keys = [...new Set([...keys, ...paths.flatMap(path => path ?? [])])]
      lastSelection = selection
    }
    if (first || keys.some(key => !userExpanded.value.includes(key))) updateExpanded(keys)
  }, { immediate: true, deep: true })
  function setExpandedKeys(keys: NavigationTreeKey[]) {
    if (!searching.value) updateExpanded(keys)
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !searchValue.value) return
    event.preventDefault()
    event.stopPropagation()
    searchValue.value = ''
  }
  watch(() => props.searchNodeKey, () => { searchValue.value = '' })
  return { model, filtered, expandedKeys, setExpandedKeys, searchValue, searching, onSearchKeydown }
}
