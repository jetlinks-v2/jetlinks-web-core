import {modules} from '@jetlinks-web-core/utils/modules'

type ExtraRoute = {
    code?: string
    mode?: string
    [key: string]: any
}

type ExtraRouteConfig = ExtraRoute[] | {
    mode?: string
    children?: ExtraRoute[]
    [key: string]: any
}

type ExtraRoutesMap = Record<string, ExtraRouteConfig>

const normalizeChildren = (route: ExtraRouteConfig) => {
    return Array.isArray(route) ? route : route.children || []
}

const isReplaceChildrenMode = (route: ExtraRouteConfig) => {
    return !Array.isArray(route) && route.mode === 'replace'
}

const mergeChildrenByCode = (source: ExtraRoute[], target: ExtraRoute[]) => {
    const children = [...source]

    target.forEach(item => {
        const codeIndex = item.code
            ? children.findIndex(child => child.code === item.code)
            : -1

        if (codeIndex > -1) {
            children[codeIndex] = item
        } else {
            children.push(item)
        }
    })

    return children
}

const mergeExtraRoute = (
    source: ExtraRouteConfig | undefined,
    target: ExtraRouteConfig
): ExtraRouteConfig => {
    if (!source || isReplaceChildrenMode(target)) {
        return target
    }

    const children = mergeChildrenByCode(
        normalizeChildren(source),
        normalizeChildren(target)
    )

    const sourceConfig = Array.isArray(source) ? {} : source

    return Array.isArray(target)
        ? children
        : {
            ...sourceConfig,
            ...target,
            children
        }
}

export const getExtraRouters = async () => {
    const extraMenu: ExtraRoutesMap = {}

    const modulesFiles = modules()
    Object.values(modulesFiles).forEach((item: any) => {
        const routes: ExtraRoutesMap = item.default.getExtraRoutesMap?.() || {}

        Object.entries(routes).forEach(([code, route]) => {
            extraMenu[code] = mergeExtraRoute(extraMenu[code], route)
        })
    })

    return extraMenu
}
