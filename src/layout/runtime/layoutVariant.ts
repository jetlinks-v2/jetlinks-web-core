export const basicLayoutVariants = ['tenant', 'project', 'application'] as const

export type BasicLayoutVariant = typeof basicLayoutVariants[number]

export interface BasicLayoutRuntimeContext {
  projectScope: boolean
  applicationScope: boolean
  projectRuntime: boolean
}

export const normalizeBasicLayoutVariant = (value: unknown): BasicLayoutVariant | undefined => {
  return basicLayoutVariants.includes(value as BasicLayoutVariant)
    ? value as BasicLayoutVariant
    : undefined
}

/**
 * 显式系统配置优先；缺少配置时按当前请求 Scope 和项目运行态回退，最终默认应用端。
 */
export const resolveBasicLayoutVariant = (
  configuredVariant: unknown,
  context: BasicLayoutRuntimeContext,
): BasicLayoutVariant => {
  const normalizedVariant = normalizeBasicLayoutVariant(configuredVariant)

  if (context.projectScope) return 'project'
  if (context.applicationScope) return 'application'
  if (context.projectRuntime) return 'project'
  if (normalizedVariant) return normalizedVariant
  return 'application'
}
