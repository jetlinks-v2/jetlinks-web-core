import i18n from "@jetlinks-web-core/locales";

type KeyType = 'HomeView' | 'BindThirdAccount' | 'Subscribe' | 'PersonalToken';
export const tabList: { key: KeyType; title: string }[] = [
    {
        key: 'BindThirdAccount',
        title: i18n.global.t('center.data.accountInfo'),
    },
    // {
    //     key: 'HomeView',
    //     title: i18n.global.t('center.data.756829-2'),
    // },
    // {
    //     key: 'Subscribe',
    //     title: i18n.global.t('center.data.756829-0'),
    // },
    // {
    //   key: 'PersonalToken',
    //   title: i18n.global.t('center.data.756829-4'),
    // },
]
