import i18n from "@jetlinks-web-core/locales";

type KeyType = 'AccountInfo' | 'BindThirdAccount';
export const tabList: { key: KeyType; title: string }[] = [
    {
        key: 'AccountInfo',
        title: i18n.global.t('center.data.accountInfo'),
    },
    {
        key: 'BindThirdAccount',
        title: i18n.global.t('center.data.756829-3'),
    },
]
