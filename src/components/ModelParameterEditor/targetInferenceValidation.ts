import { isTargetInferenceOperationActive } from './targetInferenceUtils'
import type {
  TargetInferenceGroupDraft,
  TargetInferenceOperationDraft,
  TargetInferenceOperationErrors,
  TargetInferenceOperationKind,
  TargetInferencePartErrors,
  TargetInferenceGroupErrors,
  TargetInferenceValidationErrors
} from './targetInferenceUtils'

function validateOperation(
  operation: TargetInferenceOperationDraft,
  kind: TargetInferenceOperationKind
): TargetInferenceOperationErrors | undefined {
  const errors: TargetInferenceOperationErrors = {}
  const capabilityActive = isTargetInferenceOperationActive(operation)
  if (operation.paramsInvalid) errors.params = 'invalidJson'
  if (operation.userSelectable && !operation.parameterName.trim()) {
    errors.parameterName = 'targetParameterNameRequired'
  }
  if (capabilityActive && !operation.model.trim()) errors.model = 'modelRequired'
  if (kind === 'vector' && capabilityActive && !operation.vectorProfile.trim()) {
    errors.vectorProfile = 'vectorProfileRequired'
  }
  return Object.keys(errors).length ? errors : undefined
}

export function validateTargetInference(
  groups: TargetInferenceGroupDraft[]
): TargetInferenceValidationErrors {
  const errors: TargetInferenceValidationErrors = {}
  const labels = new Set<string>()

  groups.forEach(group => {
    const groupErrors: TargetInferenceGroupErrors = {}
    const label = group.label.trim()
    if (!label) groupErrors.label = 'targetLabelRequired'
    else if (labels.has(label)) groupErrors.label = 'targetLabelDuplicate'
    else labels.add(label)

    const vectorErrors = validateOperation(group.vector, 'vector')
    const featuresErrors = validateOperation(group.features, 'features')
    if (vectorErrors) groupErrors.vector = vectorErrors
    if (featuresErrors) groupErrors.features = featuresErrors

    const partLabels = new Set<string>()
    const partErrors: Record<string, TargetInferencePartErrors> = {}
    let hasEnabledCapability = isTargetInferenceOperationActive(group.vector)
      || isTargetInferenceOperationActive(group.features)

    group.parts.forEach(part => {
      const currentErrors: TargetInferencePartErrors = {}
      const partLabel = part.label.trim()
      if (!partLabel) currentErrors.label = 'partLabelRequired'
      else if (partLabels.has(partLabel)) currentErrors.label = 'partLabelDuplicate'
      else partLabels.add(partLabel)

      const detectorErrors = validateOperation(part.detector, 'parts')
      const vectorPartErrors = validateOperation(part.vector, 'vector')
      const featurePartErrors = validateOperation(part.features, 'features')
      if (detectorErrors) currentErrors.detector = detectorErrors
      if (vectorPartErrors) currentErrors.vector = vectorPartErrors
      if (featurePartErrors) currentErrors.features = featurePartErrors

      const hasPartCapability = isTargetInferenceOperationActive(part.detector)
        || isTargetInferenceOperationActive(part.vector)
        || isTargetInferenceOperationActive(part.features)
      hasEnabledCapability = hasEnabledCapability || hasPartCapability
      if (part.created && !hasPartCapability) currentErrors.capability = 'capabilityRequired'

      if (Object.keys(currentErrors).length) partErrors[part.id] = currentErrors
    })

    if (Object.keys(partErrors).length) groupErrors.parts = partErrors
    if (group.created && !hasEnabledCapability) groupErrors.capability = 'capabilityRequired'
    if (Object.keys(groupErrors).length) errors[group.id] = groupErrors
  })

  return errors
}
