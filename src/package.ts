import {getToken, LocalStore, setToken} from "@jetlinks-web/utils";
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { crateAxios, router, wsClient } from '@jetlinks-web/core'
import {jumpLogin} from '@jetlinks-web-core/router'
import {notification} from 'ant-design-vue'
import { isSubApp, langKey, PersonalToken, PersonalUrlKey } from '@jetlinks-web-core/utils/consts'
import Relogin from '@jetlinks-web-core/views/relogin/index.vue'
import { getPackageConfig, registerModule, getBaseApi, routerFallback } from '@jetlinks-web-core/utils'
import microApp from '@micro-zoe/micro-app'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

/**
 * 初始化package
 */
export const initPackages = () => {

    /**
     * 初始化websocket
     */
    let token = getToken();
    let tokenKey = TOKEN_KEY_URL

    if (!token) return

    if (PersonalToken.value) {
        token = PersonalToken.value
        tokenKey = PersonalUrlKey
    }

    const protocol = window.location.protocol.replace('http', 'ws');
    const host = document.location.host;
    const filterHost = host.endsWith('/') ? host.substring(0, host.length - 1) : host;
    const url = `${protocol}${filterHost}${getBaseApi()}/messaging/${token}?${tokenKey}=${token}`;
    // wsClient.setOptions({
    //     onError(message) {
    //         notification.error({
    //             key: 'ws-error',
    //             message: message.message,
    //             style: {
    //                 zIndex: 1090
    //             },
    //         });
    //     }
    // })
    wsClient.initWebSocket(url);
    wsClient.connect()
};

const _handleReconnect = async () => {
    // 如何监听弹窗是否关闭
    const modalWrapper = document.createElement('div');
    const modalApp = createApp(Relogin).mount(modalWrapper);
    document.body.appendChild(modalWrapper);
    return await modalApp?.open?.();
}
export const initAxios = () => {
    const config = getPackageConfig()

    let settings = {
          langKey: langKey,
          isCreateTokenRefresh: true,
          tokenExpiration: () => {
              const token = getToken();
              if(!token){
                  jumpLogin()
              }
          },
          handleReconnect: _handleReconnect,
          filter_url: [
              '/system/version',
              '/system/config/front',
              '/authorize/captcha/config',
              '/authorize/captcha/image',
              '/application/sso/bind-code',
              '/authorize/login',
              '/application/',
              '/application/sso/_all',
              '/personal/token/',
          ],
          handleError: (description, key, err) => {
              if (!err.config?.hiddenError) {
                  notification.error({
                      style: {
                          zIndex: 1040
                      },
                      key: key as string,
                      message: '',
                      description
                  })
              }
          }
      }

      if (isSubApp) { // 获取基座传过来的
          const parentData = (window as any).microApp.getGlobalData()
          console.log('isSubApp', parentData)
          if (parentData.axiosSettings) {
              settings = {
                  ...settings,
                  ...parentData.axiosSettings
              }
          }
      }

      if(Object.keys(config?.axiosSettings || {}).length) {
          settings = {
              ...settings,
              ...config.axiosSettings
          }
      }
    crateAxios(settings)
}


export const loadMicroApp = () => {
    (window as any).microApp?.addDataListener((data: any) => {

        if (data.token) {
            setToken(data.token)
        }

        if (data.appId) {
            LocalStore.set('appId', data.appId)
        }
    }, true)

    if (!isSubApp) { // 不是子应用
        microApp.setGlobalData({
            api: {
                moduleRegistry,
                onTabSaveSuccess: (id: string, url: string, options?: Record<string, any>) => {
                    const tabInstance = window.open(url) as WindowProxy
                    (tabInstance as any).onTabSaveSuccess = (_sourceId: string, value: any) => {
                        if (_sourceId === id) {
                            options?.onSuccess?.(value)
                        }
                    }
                },
                onTabSaveSuccessBack: (id: string,data?: any) => {
                    (window as any).onTabSaveSuccess(id, data)
                    setTimeout(() => window.close(), 300)
                },
                routerFallback: routerFallback
            }
        })
    }
}

// 支持多模块注册
registerModule()
