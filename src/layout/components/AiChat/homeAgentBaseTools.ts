import i18n from '@jetlinks-web-core/locales'
import {
  defineAiClientToolContract,
  defineAiClientTools,
} from './clientTools'
import type { HomeAgentCapabilityContext } from './homeAgentContracts'
import {
  compactHomeAgentCapability,
  filterHomeAgentCapabilities,
} from './homeAgentCatalog'
import { clampLimit, isPlainRecord, uniqueStrings } from './homeAgentShared'

const HOME_AGENT_CONTEXT_CONTRACT = defineAiClientToolContract({
  routingKind: 'discovery',
  routing: {
    capabilities: ['session.context.read'],
    evidencePolicy: 'none',
    exposure: 'eager',
    cost: 'low',
  },
  outputs: [{
    kind: 'lookup',
    name: 'session-context',
    shape: 'session.context',
    path: '$',
  }],
})

const HOME_AGENT_CAPABILITY_SEARCH_CONTRACT = defineAiClientToolContract({
  routingKind: 'discovery',
  routing: {
    capabilities: ['client-capability.search'],
    accepts: ['natural-language-query'],
    evidencePolicy: 'none',
  },
  outputs: [{
    kind: 'lookup',
    name: 'client-capability-candidates',
    shape: 'capability.candidates',
    path: '$.items',
  }],
})

const HOME_AGENT_OPEN_MENU_CONTRACT = defineAiClientToolContract({
  routingKind: 'navigation',
  routing: {
    capabilities: ['navigation.menu.open'],
    accepts: ['menu-code'],
    exposure: 'auto',
  },
  outputs: [{
    kind: 'lookup',
    name: 'navigation-receipt',
    shape: 'navigation.receipt',
    path: '$',
  }],
})

export const createHomeAgentBaseTools = () => defineAiClientTools<HomeAgentCapabilityContext>([
  {
    id: 'home_agent_get_context',
    name: 'home_agent_get_context',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.context.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.context.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.context.description'),
    ...HOME_AGENT_CONTEXT_CONTRACT,
    inputs: [],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: (_args, context) => ({
      currentRoute: context.currentRoute,
      currentView: context.currentView,
      menuCount: context.menus.length,
      capabilityCount: context.capabilities.length,
      categories: uniqueStrings(context.capabilities.map(item => item.category)),
      capabilityKinds: uniqueStrings(context.capabilities.map(item => item.kind)),
    }),
  },
  {
    id: 'home_agent_search_capabilities',
    name: 'home_agent_search_capabilities',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.search.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.search.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.search.description'),
    ...HOME_AGENT_CAPABILITY_SEARCH_CONTRACT,
    inputs: [
      {
        id: 'keyword',
        name: 'keyword',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.keyword'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'kind',
        name: 'kind',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.kind'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'category',
        name: 'category',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.category'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: (args, context) => {
      const matches = filterHomeAgentCapabilities(context.capabilities, args)
      const limit = clampLimit(args.limit)
      return {
        keyword: args.keyword,
        kind: args.kind,
        category: args.category,
        total: matches.length,
        items: matches.slice(0, limit).map(compactHomeAgentCapability),
      }
    },
  },
  {
    id: 'home_agent_open_menu',
    name: 'home_agent_open_menu',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.description'),
    ...HOME_AGENT_OPEN_MENU_CONTRACT,
    confirm: {
      title: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmTitle'),
      content: (args, context) => {
        const menu = context.findMenu(String(args.menuCode || args.routeName || ''))
        return menu
          ? i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmContent', [menu.breadcrumb.join(' / ')])
          : i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmUnknown')
      },
      okText: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.okText'),
      cancelText: i18n.global.t('verify.cancel'),
    },
    inputs: [
      {
        id: 'menuCode',
        name: 'menuCode',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.menuCode'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'query',
        name: 'query',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.query'),
        required: false,
        valueType: { type: 'object' },
      },
      {
        id: 'params',
        name: 'params',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.params'),
        required: false,
        valueType: { type: 'object' },
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: false, idempotentHint: true },
    execute: (args, context) => {
      const menuCode = String(args.menuCode || args.routeName || '')
      const menu = context.findMenu(menuCode)
      const opened = context.navigateToMenu(menuCode, {
        query: isPlainRecord(args.query) ? args.query : {},
        params: isPlainRecord(args.params) ? args.params : {},
      })
      return {
        ok: opened,
        menu: menu ? {
          code: menu.code,
          title: menu.title,
          breadcrumb: menu.breadcrumb,
          path: menu.path,
          routeName: menu.routeName,
        } : undefined,
        error: opened ? undefined : i18n.global.t('components.AiChat.homeAgent.tools.openMenu.notFound'),
      }
    },
  },
])
