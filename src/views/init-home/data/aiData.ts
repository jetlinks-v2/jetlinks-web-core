import i18n from "@jetlinks-web-core/locales";

export const agentData = [
  {
    clientType: 'pagePoint',
    clientId: 'iotHome',
    name: i18n.global.t('data.aiData.iotHome.name'),
    description: i18n.global.t('data.aiData.iotHome.description'),
    searchCode: i18n.global.t('data.aiData.iotHome.searchCode'),
    maxAgentSize: 1,
    expands: {
      menuName: i18n.global.t('data.aiData.iotHome.menuName'),
      type: 'chatBubbles'
    },
    metadata: {
      menuCode: 'home',
      routeName: 'home',
      path: '/iot/home'
    }
  },
  {
    clientType: 'pagePoint',
    clientId: 'deviceDetailChat',
    name: i18n.global.t('data.aiData.deviceDetailChat.name'),
    description: i18n.global.t('data.aiData.deviceDetailChat.description'),
    searchCode: i18n.global.t('data.aiData.deviceDetailChat.searchCode'),
    maxAgentSize: 1,
    expands: {
      menuName: i18n.global.t('data.aiData.deviceDetailChat.menuName'),
      type: 'chatBubbles'
    },
    metadata: {
      menuCode: 'device/Instance',
      routeName: 'device/Instance',
      path: '/iot/device/Instance',
      params: [
        {
          valueType: {
            type: 'string'
          },
          id: 'deviceId',
          name: i18n.global.t('data.aiData.deviceDetailChat.params.deviceId.name'),
          description: i18n.global.t('data.aiData.deviceDetailChat.params.deviceId.description')
        }
      ]
    }
  },
  {
    clientType: 'pagePoint',
    clientId: 'productDetailChat',
    name: i18n.global.t('data.aiData.productDetailChat.name'),
    description: i18n.global.t('data.aiData.productDetailChat.description'),
    searchCode: i18n.global.t('data.aiData.productDetailChat.searchCode'),
    maxAgentSize: 1,
    expands: {
      menuName: i18n.global.t('data.aiData.productDetailChat.menuName'),
      type: 'chatBubbles'
    },
    metadata: {
      menuCode: 'device/Product',
      routeName: 'device/Product',
      path: '/iot/device/Product',
      params: [
        {
          valueType: {
            type: 'string'
          },
          id: 'productId',
          name: i18n.global.t('data.aiData.productDetailChat.params.productId.name'),
          description: i18n.global.t('data.aiData.productDetailChat.params.productId.description')
        }
      ]
    }
  },
  {
    clientType: 'pagePoint',
    clientId: 'viewBigScreen',
    name: i18n.global.t('data.aiData.viewBigScreen.name'),
    description: i18n.global.t('data.aiData.viewBigScreen.description'),
    searchCode: i18n.global.t('data.aiData.viewBigScreen.searchCode'),
    maxAgentSize: 1,
    expands: {
      menuName: i18n.global.t('data.aiData.viewBigScreen.menuName'),
      type: 'chatBubbles'
    },
    metadata: {
      menuCode: 'view/bigscreen',
      path: '/view/bigscreen'
    }
  },
  {
    clientType: 'pagePoint',
    clientId: 'viewDesigner',
    name: i18n.global.t('data.aiData.viewDesigner.name'),
    description: i18n.global.t('data.aiData.viewDesigner.description'),
    searchCode: i18n.global.t('data.aiData.viewDesigner.searchCode'),
    maxAgentSize: 1,
    expands: {
      menuName: i18n.global.t('data.aiData.viewDesigner.menuName'),
      type: 'chatBubbles'
    },
    metadata: {
      menuCode: 'view/bigscreen',
      path: '/view/bigscreen'
    }
  },
  {
    clientType: 'pagePoint',
    clientId: 'knowledgeAISearch',
    name: i18n.global.t('data.aiData.knowledgeAISearch.name'),
    description: i18n.global.t('data.aiData.knowledgeAISearch.description'),
    searchCode: i18n.global.t('data.aiData.knowledgeAISearch.searchCode'),
    maxAgentSize: -1,
    expands: {
      menuName: i18n.global.t('data.aiData.knowledgeAISearch.menuName'),
      type: 'button'
    },
    metadata: {
      menuCode: 'knowledgeManagement/intelligentSearch',
      path: '/agent/knowledgeManagement/intelligentSearch'
    }
  },
]
