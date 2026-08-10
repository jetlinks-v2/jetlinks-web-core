import i18n from '@jetlinks-web-core/locales'
import {
  clientToolOutput,
  defineClientTool,
  defineClientTools,
  type ClientToolDefinition,
} from './clientToolApi'
import type { HomeAgentCapabilityContext } from './homeAgentContracts'
import {
  compactHomeAgentCapability,
  filterHomeAgentCapabilities,
} from './homeAgentCatalog'
import { clampLimit, isPlainRecord, uniqueStrings } from './homeAgentShared'

const defineHomeClientTool = (
  definition: ClientToolDefinition<Record<string, any>, HomeAgentCapabilityContext, any>,
) => defineClientTool(definition)

export const createHomeAgentBaseTools = () => defineClientTools<HomeAgentCapabilityContext>([
  defineHomeClientTool({
    id: 'home_agent_get_context',
    description: {
      text: i18n.global.t('components.AiChat.homeAgent.tools.context.description'),
      capabilities: ['session.context.read'],
      activation: 'BOOTSTRAP',
    },
    presentation: {
      displayName: i18n.global.t('components.AiChat.homeAgent.tools.context.displayName'),
      progressText: i18n.global.t('components.AiChat.homeAgent.tools.context.progressText'),
    },
    inputs: [],
    effect: { kind: 'READ' },
    output: clientToolOutput.lookup({
      name: 'session-context',
      shape: 'session.context',
    }),
    owner: { module: 'jetlinks-web-core', group: 'home-agent' },
    execute: (_args, context) => ({
      currentRoute: context.currentRoute,
      currentView: context.currentView,
      menuCount: context.menus.length,
      capabilityCount: context.capabilities.length,
      categories: uniqueStrings(context.capabilities.map(item => item.category)),
      capabilityKinds: uniqueStrings(context.capabilities.map(item => item.kind)),
    }),
  }),
  defineHomeClientTool({
    id: 'home_agent_search_capabilities',
    description: {
      text: i18n.global.t('components.AiChat.homeAgent.tools.search.description'),
      capabilities: ['client-capability.search'],
      intents: [
        '查询当前会话、页面或菜单提供了哪些能力和功能入口',
        'find capabilities, features, menus, or page entries available in the current session',
      ],
      notFor: [
        '使用已声明业务工具查询或分析平台数据',
        'query or analyze business data with an already declared tool',
      ],
      activation: 'ON_DEMAND',
    },
    presentation: {
      displayName: i18n.global.t('components.AiChat.homeAgent.tools.search.displayName'),
      progressText: i18n.global.t('components.AiChat.homeAgent.tools.search.progressText'),
    },
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
    consumes: [{
      name: 'natural-language-query', type: 'structured-data', mediaType: 'text/plain',
      shape: 'query.natural-language', required: false, sourcePolicy: 'CONTEXT',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.lookup<any>({
      name: 'client-capability-candidates',
      shape: 'capability.candidates',
      select: result => result.items,
    }),
    owner: { module: 'jetlinks-web-core', group: 'home-agent' },
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
  }),
  defineHomeClientTool({
    id: 'home_agent_open_menu',
    description: {
      text: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.description'),
      capabilities: ['navigation.menu.open'],
    },
    presentation: {
      displayName: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.displayName'),
      progressText: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.progressText'),
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
    consumes: [{
      name: 'menu-code', type: 'structured-data', mediaType: 'text/plain',
      shape: 'navigation.menu-code', required: false, sourcePolicy: 'EITHER',
    }],
    effect: {
      kind: 'EXTERNAL_ACTION',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: {
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
    },
    output: clientToolOutput.stateChange({
      name: 'navigation-receipt',
      shape: 'navigation.receipt',
      transition: 'NAVIGATION',
    }),
    owner: { module: 'jetlinks-web-core', group: 'home-agent' },
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
  }),
])
