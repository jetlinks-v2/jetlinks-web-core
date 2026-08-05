import type {
  ProjectOverviewActivityItem,
  ProjectOverviewServiceCard,
  ProjectOverviewStat,
} from '../types'

type Translate = (key: string, params?: Record<string, unknown>) => string

export const getText = (...values: unknown[]) => {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim() !== '')
  return value === undefined ? '--' : String(value)
}

export const createServiceCards = (t: Translate): ProjectOverviewServiceCard[] => [
  {
    id: 'device-access',
    name: t('Project.overview.mockServiceDevice'),
    code: 'device-access',
    specs: t('Project.overview.mockServiceBasicSpec'),
    state: t('Project.overview.stateRunning'),
    resourceCount: 128,
    usageText: t('Project.overview.usageTotal', { count: 24680 }),
  },
  {
    id: 'alarm-center',
    name: t('Project.overview.mockServiceAlarm'),
    code: 'alarm-center',
    specs: t('Project.overview.mockServiceStandardSpec'),
    state: t('Project.overview.stateRunning'),
    resourceCount: 36,
    usageText: t('Project.overview.usagePendingResources', { count: 3 }),
  },
  {
    id: 'visual-dashboard',
    name: t('Project.overview.mockServiceDashboard'),
    code: 'visual-dashboard',
    specs: t('Project.overview.mockServiceTrialSpec'),
    state: t('Project.overview.statePending'),
    resourceCount: 8,
    usageText: t('Project.overview.usageNone'),
  },
]

export const createOverviewStats = (t: Translate): ProjectOverviewStat[] => [
  {
    key: 'state',
    label: t('Project.overview.statProjectState'),
    value: t('Project.overview.stateRunning'),
    description: t('Project.overview.statProjectStateDesc'),
    status: 'normal',
  },
  {
    key: 'services',
    label: t('Project.overview.statServices'),
    value: '3',
    description: t('Project.overview.statServicesDesc'),
    status: 'normal',
  },
  {
    key: 'resources',
    label: t('Project.overview.statResources'),
    value: '172',
    description: t('Project.overview.statResourcesDesc'),
    status: 'normal',
  },
  {
    key: 'metrics',
    label: t('Project.overview.statMetrics'),
    value: '24',
    description: t('Project.overview.statMetricsDesc'),
    status: 'processing',
  },
]

export const createActivities = (
  projectName: string,
  t: Translate,
): ProjectOverviewActivityItem[] => [
  {
    key: 'project-ready',
    title: t('Project.overview.activityReadyTitle'),
    description: t('Project.overview.activityReadyDesc', { name: projectName }),
    status: 'normal',
  },
  {
    key: 'service-check',
    title: t('Project.overview.activityServicesSyncedTitle'),
    description: t('Project.overview.activityServicesSyncedDesc', { count: 3 }),
    status: 'normal',
  },
  {
    key: 'settings-check',
    title: t('Project.overview.activitySettingsTitle'),
    description: t('Project.overview.activitySettingsDesc'),
    status: 'processing',
  },
]
