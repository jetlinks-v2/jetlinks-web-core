export const basicLayoutVariants = ['tenant', 'project', 'application'] as const

export type BasicLayoutVariant = typeof basicLayoutVariants[number]

export const normalizeBasicLayoutVariant = (value: unknown): BasicLayoutVariant | undefined => {
  return basicLayoutVariants.includes(value as BasicLayoutVariant)
    ? value as BasicLayoutVariant
    : undefined
}
