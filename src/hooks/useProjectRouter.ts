import { computed } from 'vue'
import {
  useRoute,
  useRouter,
  type LocationQueryRaw,
  type RouteLocationNormalizedLoaded,
  type RouteLocationRaw,
} from 'vue-router'
import {
  createProjectRuntimeHref,
  getProjectIdFromLocation,
  normalizeProjectRuntimePath,
} from '@jetlinks-web-core/utils/project-runtime'

const PROJECT_PATH_RE = /\/project\/([^/?#]+)/

type QueryPreserveOptions = boolean | string[]

export interface ProjectRouteOptions {
  projectId?: string
  query?: LocationQueryRaw
  preserveQuery?: QueryPreserveOptions
}

const normalizeProjectId = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const next = value.trim()
    return next || undefined
  }

  if (Array.isArray(value)) {
    return normalizeProjectId(value[0])
  }

  return undefined
}

const getProjectIdFromPath = (path?: string) => {
  return normalizeProjectId(path?.match(PROJECT_PATH_RE)?.[1])
}

export const resolveProjectId = (
  route?: Pick<RouteLocationNormalizedLoaded, 'params' | 'query' | 'path' | 'fullPath'>,
  projectId?: string,
) => {
  return normalizeProjectId(projectId)
    || getProjectIdFromLocation()
    || normalizeProjectId(route?.params?.projectId)
    || getProjectIdFromPath(route?.path)
    || getProjectIdFromPath(route?.fullPath)
    || normalizeProjectId(route?.query?.projectId)
}

export const resolveProjectPath = (path = '', projectId?: string) => {
  if (!projectId) {
    return path
  }

  const targetPath = path.trim()

  if (!targetPath || targetPath === '/') {
    return '/'
  }

  if (/^(https?:)?\/\//.test(targetPath)) {
    return targetPath
  }

  return normalizeProjectRuntimePath(targetPath)
}

const pickQuery = (
  source: RouteLocationNormalizedLoaded['query'],
  preserveQuery?: QueryPreserveOptions,
) => {
  if (!preserveQuery) {
    return {}
  }

  if (preserveQuery === true) {
    return { ...source }
  }

  return preserveQuery.reduce<LocationQueryRaw>((result, key) => {
    const value = source[key]

    if (value !== undefined) {
      result[key] = value
    }

    return result
  }, {})
}

export const useProjectRouter = () => {
  const route = useRoute()
  const router = useRouter()
  const projectId = computed(() => resolveProjectId(route))

  const resolveRoute = (to: RouteLocationRaw, options: ProjectRouteOptions = {}): RouteLocationRaw => {
    const currentProjectId = resolveProjectId(route, options.projectId)
    const query = {
      ...pickQuery(route.query, options.preserveQuery),
      ...options.query,
    }

    if (typeof to === 'string') {
      return Object.keys(query).length
        ? { path: resolveProjectPath(to, currentProjectId), query }
        : resolveProjectPath(to, currentProjectId)
    }

    const target = { ...to } as Record<string, any>

    if (target.path) {
      target.path = resolveProjectPath(target.path, currentProjectId)
    } else if (currentProjectId) {
      target.params = {
        ...target.params,
        projectId: target.params?.projectId || currentProjectId,
      }
    }

    target.query = {
      ...query,
      ...target.query,
    }

    return target as RouteLocationRaw
  }

  const push = (to: RouteLocationRaw, options?: ProjectRouteOptions) => {
    return router.push(resolveRoute(to, options))
  }

  const replace = (to: RouteLocationRaw, options?: ProjectRouteOptions) => {
    return router.replace(resolveRoute(to, options))
  }

  return {
    projectId,
    resolveRoute,
    resolveProjectPath: (path?: string, id?: string) => resolveProjectPath(path, id || projectId.value),
    createProjectHref: (path?: string, id?: string) => createProjectRuntimeHref(id || projectId.value || '', path),
    push,
    replace,
  }
}
