import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BusinessApplicationEntity } from '@jetlinks-web-core/api/application'

type BusinessApplicationRuntimeType = 'application' | 'project'

export type BusinessApplicationEntry = BusinessApplicationEntity & {
  runtimeType?: BusinessApplicationRuntimeType
  projectCode?: string
}

/** Shared active application state, independent of navigation and menu loading. */
export const useBusinessApplicationContext = defineStore('business-application-context', () => ({
  currentApplication: ref<BusinessApplicationEntry>(),
}))
