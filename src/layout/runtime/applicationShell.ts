import { modules } from '@jetlinks-web-core/utils/modules'
import type {
  ApplicationShellContext,
  ApplicationShellDeclaration,
  ModuleDefinition,
} from '@jetlinks-web-core/types/module'

/**
 * 业务应用外壳的代码侧注册表。
 *
 * 绑定关系只写在模块自己的 `index.ts`（`getApplicationShell()`），不看应用模板、
 * `configuration` 或管理界面字段。收集方式与 `contentPanelOverrides.ts` 一致：
 * 首次解析时遍历 `modules()`，结果缓存，测试可显式重置。
 */
export interface ResolvedApplicationShell {
  moduleName: string
  priority: number
  declaration: ApplicationShellDeclaration
}

let collected: ResolvedApplicationShell[] | undefined
/** 每次运行只提醒一次，避免应用内导航时重复刷屏。 */
const reportedMisses = new Set<string>()

const getPriority = (definition: ModuleDefinition) => (
  typeof definition.priority === 'number' ? definition.priority : 0
)

const collect = (): ResolvedApplicationShell[] => {
  if (collected) return collected

  const shells: ResolvedApplicationShell[] = []

  Object.values(modules()).forEach((item) => {
    const definition = item.default
    const declaration = definition?.getApplicationShell?.()

    if (!declaration?.component) return

    shells.push({
      moduleName: item.name,
      priority: getPriority(definition),
      declaration,
    })
  })

  // 与 `globModules` / `resolveCoreRoutes` 的“后者覆盖前者”一致：priority 大的模块接管外壳。
  shells.sort((a, b) => b.priority - a.priority)
  collected = shells
  return collected
}

/** 当前所有声明了外壳的模块，按优先级降序。 */
export const listApplicationShells = () => collect()

/**
 * 按声明顺序解析命中的应用外壳。
 *
 * - 只考虑提供了 `match` 的声明；未声明 `match` 的模块不参与自动匹配。
 * - `match` 抛错时跳过该模块并告警，避免单个模块阻断整个应用入口。
 * - 多个模块同时命中时高优先级胜出，并对落败方告警，防止静默接管。
 */
export const resolveApplicationShell = (
  context: ApplicationShellContext,
): ResolvedApplicationShell | undefined => {
  const shells = collect()
  let matched: ResolvedApplicationShell | undefined

  for (const shell of shells) {
    const { match } = shell.declaration
    if (!match) continue

    let hit = false
    try {
      hit = match(context) === true
    } catch (error) {
      console.warn(`[Application Shell] Module "${shell.moduleName}" match failed:`, error)
      continue
    }
    if (!hit) continue

    if (matched) {
      console.warn(
        `[Application Shell] Module "${shell.moduleName}" also matched but `
        + `"${matched.moduleName}" wins by priority (${matched.priority} > ${shell.priority}).`,
      )
      continue
    }

    matched = shell
  }

  if (matched) return matched

  // 已声明但未命中：多为菜单 code 改名或应用未下发对应菜单，需要一条可查的线索。
  shells.forEach((shell) => {
    if (reportedMisses.has(shell.moduleName)) return
    reportedMisses.add(shell.moduleName)
    console.warn(
      `[Application Shell] Module "${shell.moduleName}" declared a shell but did not match `
      + 'the current application menus; falling back to the default layout.',
    )
  })

  return matched
}

/** 仅测试与热更新场景使用。 */
export const resetApplicationShellCache = () => {
  collected = undefined
  reportedMisses.clear()
}
