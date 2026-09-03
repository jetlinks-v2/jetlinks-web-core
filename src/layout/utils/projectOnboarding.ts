export const PROJECT_ONBOARDING_MENU_CODES = {
  iotDeviceList: 'iot-user/device/list',
  videoResources: 'video/resources',
  alarmRules: 'alarm/ruleAssistant',
} as const

export const PROJECT_ONBOARDING_TARGETS = {
  welcome: '.project-layout__right-content',
  iotDeviceMenu: '.project-onboarding-target--iot-device-menu',
  iotDeviceCreate: '.project-onboarding-target--iot-device-create',
  videoResourcesMenu: '.project-onboarding-target--video-resources-menu',
  alarmRuleCreate: '.project-onboarding-target--alarm-rule-create',
} as const

export const PROJECT_ONBOARDING_MENU_TARGET_CLASSES: Record<string, string> = {
  [PROJECT_ONBOARDING_MENU_CODES.iotDeviceList]: 'project-onboarding-target--iot-device-menu',
  [PROJECT_ONBOARDING_MENU_CODES.videoResources]: 'project-onboarding-target--video-resources-menu',
}

export type ProjectOnboardingStepId = keyof typeof PROJECT_ONBOARDING_TARGETS

export type ProjectOnboardingAvailability = {
  hasIotDeviceList: boolean
  hasVideoResources: boolean
  hasAlarmRules: boolean
}

/**
 * 按当前用户实际可见菜单生成引导步骤，避免引导跳转到无权限页面。
 */
export function buildProjectOnboardingStepIds({
  hasIotDeviceList,
  hasVideoResources,
  hasAlarmRules,
}: ProjectOnboardingAvailability): ProjectOnboardingStepId[] {
  if (!hasIotDeviceList && !hasVideoResources) return []

  const steps: ProjectOnboardingStepId[] = ['welcome']

  if (hasIotDeviceList) {
    steps.push('iotDeviceMenu', 'iotDeviceCreate')
  }

  if (hasVideoResources) {
    steps.push('videoResourcesMenu')
    if (hasAlarmRules) steps.push('alarmRuleCreate')
  }

  return steps
}
