import type { CapabilityKind } from '@jetlinks-web-core/data-capability'

export interface LabCapabilityItem {
  id: string
  kind: CapabilityKind
  name: string
  owner: { moduleId: string; providerId: string }
  availability: { executable: boolean }
  definition: Record<string, unknown>
}
