import type { PropType } from 'vue'
import type { PlatformSettingsSectionProps } from './types'

export const sectionProps = {
  model: { type: Object as PropType<PlatformSettingsSectionProps['model']>, required: true as const },
  saved: { type: Object as PropType<PlatformSettingsSectionProps['saved']>, required: true as const },
  mode: { type: String as PropType<PlatformSettingsSectionProps['mode']>, required: true as const },
  submit: { type: Function as PropType<PlatformSettingsSectionProps['submit']>, required: true as const },
  busy: Boolean,
  disabled: Boolean,
  errors: Object as PropType<PlatformSettingsSectionProps['errors']>,
  hidden: Array as PropType<PlatformSettingsSectionProps['hidden']>,
}
