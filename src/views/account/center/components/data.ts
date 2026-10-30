import { useMenuStore } from '@jetlinks-web-core/store/menu';
import i18n from '@jetlinks-web-core/locales';
const systemNotice = () => [
    {
        provider: 'alarm',
        name: i18n.global.t('components.data.091431-0'),
        children: [
            {
                provider: 'alarm-product',
                name: i18n.global.t('components.data.091431-1'),
                description:
                    i18n.global.t('components.data.091431-2'),
            },
            {
                provider: 'alarm-device',
                name: i18n.global.t('components.data.091431-3'),
                description:
                    i18n.global.t('components.data.091431-4'),
            },
            {
                provider: 'alarm-org',
                name: i18n.global.t('components.data.091431-5'),
                description:
                    i18n.global.t('components.data.091431-6'),
            },
            {
                provider: 'alarm-other',
                name: i18n.global.t('components.data.091431-7'),
                description:
                    i18n.global.t('components.data.091431-8'),
            },
        ],
    },
    {
        provider: 'system-monitor',
        name: i18n.global.t('components.data.091431-9'),
        children: [
            {
                provider: 'system-event',
                name: i18n.global.t('components.data.091431-10'),
            },
        ],
    },
    {
        provider: 'system-business',
        name: i18n.global.t('components.data.091431-11'),
        children: [
            {
                provider: 'device-transparent-codec',
                name: i18n.global.t('components.data.091431-12'),
            },
        ],
    },
];
const workflowNotice = () => [
    {
        provider: 'workflow-notification',
        name: i18n.global.t('components.data.091431-13'),
        children: [
            {
                provider: 'workflow-task-todo',
                name: i18n.global.t('components.data.091431-14'),
            },
            {
                provider: 'workflow-task-reject',
                name: i18n.global.t('components.data.091431-15'),
            },
            {
                provider: 'workflow-task-cc',
                name: i18n.global.t('components.data.091431-16'),
            },
            {
                provider: 'workflow-process-finish',
                name: i18n.global.t('components.data.091431-17'),
            },
            {
                provider: 'workflow-process-repealed',
                name: i18n.global.t('components.data.091431-18'),
            },
            {
                provider: 'workflow-task-transfer-todo',
                name: i18n.global.t('components.data.091431-19')
            }
        ],
    },
]
/** 内置通知类型按稳定 provider 标识本地化，未知业务类型保留接口名称。 */
export const resolveNotificationProviderName = (provider: string, fallback: string): string => {
    for (const group of [...systemNotice(), ...workflowNotice()]) {
        if (group.provider === provider) return group.name
        const item = group.children.find(child => child.provider === provider)
        if (item) return item.name
    }
    return fallback
}

export const getInitData = () => {
    // 仅旧目录入口需要菜单权限；名称解析不在模块初始化时读取全局 Store。
    const menuStore = useMenuStore()
    return menuStore.hasMenu('process') ? [...systemNotice(), ...workflowNotice()] : systemNotice()
}
