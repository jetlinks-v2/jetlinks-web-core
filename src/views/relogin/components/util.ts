import i18n from '@jetlinks-web-core/locales';
export const rules = {
  username: [
    {
      validator(_: any, value: string) {
        if (!value) {
          return Promise.reject(i18n.global.t('login.right.419974-1'))
        }
        return Promise.resolve()
      },
      trigger: 'change'
    }
  ],
  password: [
    {
      validator(_: any, value: string) {
        if (!value) {
          return Promise.reject(i18n.global.t('login.right.419974-3'))
        }
        return Promise.resolve()
      },
      trigger: 'change'
    }
  ],
  verifyCode: [
    {
      validator(_: any, value: string) {
        if (!value) {
          return Promise.reject(i18n.global.t('login.right.419974-5'))
        }
        return Promise.resolve()
      },
      trigger: 'change'
    }
  ]
}

// provider → 图标映射已统一到 @jetlinks-web-core/utils/sso-icon，登录页与重登录弹窗共用一份。

