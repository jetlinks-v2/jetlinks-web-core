import type { allocationRanking, formatAllocationBytes } from './allocationPresentation'
import type { threadStackDepth } from './utils'
import type { escapeFlameHtml } from './flameGraph'
import type { JvmDiagnosticExport } from './jvmDiagnosticReport'

export interface DiagnosticHtmlLabels {
  live: string; snapshots: string; offline: string; details: string; allocationSearch: string; threadSearch: string
  allocations: string; allocationHint: string; thread: string; state: string; stackDepth: string
  name: string; bytes: string; share: string; all: string; noMatches: string; noStack: string; loadMore: string
  notCollected: string; unavailable: string; noExecutionSamples: string; noAllocationSamples: string; noThreads: string; scriptRequired: string
  threadFields: Record<'lock' | 'lockOwner' | 'blockedCount' | 'blockedTime' | 'waitedCount' | 'waitedTime' | 'inNative' | 'suspended', string>
}
export interface DiagnosticHtmlHelpers {
  allocationRanking: typeof allocationRanking; formatAllocationBytes: typeof formatAllocationBytes
  threadStackDepth: typeof threadStackDepth; escape: typeof escapeFlameHtml
}

/** 内嵌到离线文件；只访问本报告 DOM 和冻结证据，不捕获模块变量或调用平台服务。 */
export function mountDiagnosticHtml(data: JvmDiagnosticExport, labels: DiagnosticHtmlLabels, helpers: DiagnosticHtmlHelpers) {
  const root = document.getElementById('diagnostic-report')!
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!
  const e = helpers.escape, number = (value: number) => value.toLocaleString()
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  function selectTab(index: number, focus = false) {
    tabs.forEach((tab, position) => {
      const selected = index === position
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1
      get(tab.getAttribute('aria-controls')!).hidden = !selected
    })
    if (focus) tabs[index]?.focus()
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => selectTab(index)
    tab.onkeydown = event => {
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : undefined
      if (target !== undefined) { event.preventDefault(); selectTab(target, true) }
    }
  })

  const allocations = helpers.allocationRanking(data.snapshot?.objectAllocations)
  const allocationList = get('allocation-rows'), allocationSearch = get<HTMLInputElement>('allocation-search')
  const allocationCount = get('allocation-count'), allocationMore = get<HTMLButtonElement>('allocation-more')
  const allocationSort = get<HTMLButtonElement>('allocation-sort')
  let allocationAscending = false, allocationLimit = 100
  function renderAllocations(reset = false) {
    if (reset) { allocationLimit = 100; allocationList.scrollTop = 0 }
    const keyword = allocationSearch.value.trim().toLocaleLowerCase()
    const rows = allocations.rows.filter(row => row.className.toLocaleLowerCase().includes(keyword))
    if (allocationAscending) rows.reverse()
    allocationCount.textContent = `${helpers.formatAllocationBytes(allocations.totalBytes)} · ${number(rows.length)} / ${number(allocations.classCount)}`
    allocationList.innerHTML = rows.slice(0, allocationLimit).map(row => `<li class="diagnostic-allocation-row"><span class="diagnostic-rank">${row.rank}</span><div><div class="diagnostic-allocation-line"><code>${e(row.className)}</code><span title="${e(`${number(row.allocationSize)} B`)}"><strong>${e(helpers.formatAllocationBytes(row.allocationSize))}</strong><small>${row.share > 0 && row.share < 0.1 ? '&lt;0.1' : row.share.toFixed(1)}%</small></span></div><progress max="100" value="${row.share}" aria-label="${e(labels.share)}"></progress></div></li>`).join('')
      || `<li class="diagnostic-empty">${e(allocations.classCount ? labels.noMatches : data.snapshot ? labels.noAllocationSamples : labels.notCollected)}</li>`
    allocationMore.hidden = rows.length <= allocationLimit
    allocationSort.classList.toggle('is-ascending', allocationAscending)
    allocationSort.setAttribute('aria-label', `${labels.bytes} · ${allocationAscending ? '↑' : '↓'}`)
  }
  allocationSearch.oninput = () => renderAllocations(true)
  allocationSort.onclick = () => { allocationAscending = !allocationAscending; renderAllocations(true) }
  allocationMore.onclick = () => { const top = allocationList.scrollTop; allocationLimit += 100; renderAllocations(); allocationList.scrollTop = top }
  renderAllocations()

  const threads = data.threads.map((thread, index) => ({ ...thread, key: String(index), depth: helpers.threadStackDepth(thread.stack) }))
    .sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name))
  const threadList = get('thread-rows'), threadSearch = get<HTMLInputElement>('thread-search'), threadMore = get<HTMLButtonElement>('thread-more')
  const threadCount = get('thread-count'), threadSort = get<HTMLButtonElement>('thread-sort'), states = get('thread-states')
  const expanded = new Set<string>(), groups = new Map<string, number>()
  threads.forEach(thread => groups.set(thread.state, (groups.get(thread.state) ?? 0) + 1))
  let selectedState: string | undefined, threadAscending = false, threadLimit = 60
  const stateButtons: HTMLButtonElement[] = []
  for (const [state, count] of [[undefined, threads.length] as const, ...Array.from(groups)]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'diagnostic-state-filter'
    button.textContent = `${state ?? labels.all} ${number(count)}`
    button.onclick = () => { selectedState = state; renderThreads(true) }
    button.dataset.state = state ?? ''; states.append(button); stateButtons.push(button)
  }
  function renderThreads(reset = false) {
    if (reset) { threadLimit = 60; threadList.scrollTop = 0 }
    const keyword = threadSearch.value.trim().toLocaleLowerCase()
    const rows = threads.filter(thread => (selectedState === undefined || thread.state === selectedState)
      && `${thread.name} ${thread.id} ${thread.lock ?? ''} ${thread.lockOwner?.name ?? ''}`.toLocaleLowerCase().includes(keyword))
    if (threadAscending) rows.reverse()
    threadCount.textContent = `${number(rows.length)} / ${number(threads.length)}`
    threadList.innerHTML = rows.slice(0, threadLimit).map(thread => `<details class="diagnostic-thread" data-key="${thread.key}"${expanded.has(thread.key) ? ' open' : ''}><summary><span class="diagnostic-thread-name"><strong>${e(thread.name)}</strong><small>#${e(thread.id)}</small></span><span class="diagnostic-state${thread.state === 'BLOCKED' ? ' is-blocked' : thread.state === 'RUNNABLE' ? ' is-runnable' : ''}">${e(thread.state)}</span><span class="diagnostic-depth">${thread.depth}</span></summary><div class="diagnostic-thread-evidence"><dl>${(Object.keys(labels.threadFields) as Array<keyof typeof labels.threadFields>).flatMap(key => {
      const value = thread[key]
      if (value === undefined) return []
      const text = key === 'lockOwner' ? [thread.lockOwner?.name, thread.lockOwner?.id === undefined ? undefined : `#${thread.lockOwner.id}`].filter(Boolean).join(' ')
        : key === 'blockedTime' || key === 'waitedTime' ? Number(value) < 0 ? labels.notCollected : `${value} ms` : String(value)
      return [`<div><dt>${e(labels.threadFields[key])}</dt><dd>${e(text)}</dd></div>`]
    }).join('')}</dl><pre>${e(thread.stack || labels.noStack)}</pre></div></details>`).join('')
      || `<p class="diagnostic-empty">${e(threads.length ? labels.noMatches : ['forbidden', 'unsupported', 'error'].includes(data.threadState.status) ? labels.unavailable : data.threadState.status === 'empty' ? labels.noThreads : labels.notCollected)}</p>`
    threadMore.hidden = rows.length <= threadLimit
    threadSort.classList.toggle('is-ascending', threadAscending)
    stateButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.state === (selectedState ?? ''))))
    threadList.querySelectorAll<HTMLDetailsElement>('details[data-key]').forEach(details => {
      details.ontoggle = () => { if (!details.isConnected) return; if (details.open) expanded.add(details.dataset.key!); else expanded.delete(details.dataset.key!) }
    })
  }
  threadSearch.oninput = () => renderThreads(true)
  threadSort.onclick = () => { threadAscending = !threadAscending; renderThreads(true) }
  threadMore.onclick = () => { const top = threadList.scrollTop; threadLimit += 60; renderThreads(); threadList.scrollTop = top }
  renderThreads()
  selectTab(data.snapshot ? 0 : 1)
}
