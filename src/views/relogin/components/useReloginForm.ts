import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'
import { encrypt, onlyMessage, setToken, LocalStore } from '@jetlinks-web/utils'
import { useRequest } from '@jetlinks-web/hooks'
import { captchaConfig, codeUrl, encryptionConfig, getInitSet, login } from '@jetlinks-web-core/api/login'
import { useUserStore } from '@jetlinks-web-core/store'
import { initPackages } from '@jetlinks-web-core/package'
import i18n from '@jetlinks-web-core/locales'
import { resetSessionStores } from '@jetlinks-web-core/router/startup'

type CaptchaSettings = { enabled?: boolean; loginWithVerify?: boolean; type?: string }
type EncryptionSettings = { encrypt?: { enabled: boolean; publicKey: string; id: string } }
type ReloginCredentials = {
  username: string; password: string; expires: number; remember: boolean
  verifyCode?: string; verifyKey?: string; encryptId?: string; 'captcha-id'?: string
}
type ReloginEvents = { (event: 'submit'): void; (event: 'update:loading', loading: boolean): void }

/** 登录弹窗的验证码、加密和会话恢复；输入表单通过原生 submit 统一触发校验。 */
export function useReloginForm(props: { type: string }, emit: ReloginEvents) {
  const BASE_API_PATH = import.meta.env.VITE_APP_BASE_API
  const $t = i18n.global.t
  const moreVisible = ref(false);
  const userStore = useUserStore();

  const formData = reactive<ReloginCredentials>({
    username: "",
    password: "",
    expires: 3600000,
    remember: false,
    verifyCode: undefined,
    verifyKey: undefined,
    encryptId: undefined,
    'captcha-id': undefined
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const { data: encryption, run: reloadEncryption } = useRequest<EncryptionSettings, EncryptionSettings>(
    encryptionConfig,
    {
      onSuccess() {
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }

        timer = setTimeout(
          () => {
            reloadEncryption();
          },
          3 * 60 * 1000,
        );
      },
    },
  );

  const getVerifyCode = (record?: CaptchaSettings) => {
    const _config = config.value || record;
    if (_config && _config.enabled && !_config.loginWithVerify && _config.type === 'image') {
      getCode();
    }
  }

  const { data: config } = useRequest(captchaConfig, {
    onSuccess(resp) {
      getVerifyCode(resp.result)

      return resp.result;
    },
  });

  const { data: url, run: getCode } = useRequest(codeUrl, {
    immediate: false,
    onSuccess(resp) {
      if (config.value && resp.result?.key) {
        formData.verifyKey = resp.result?.key;
      }
    },
  });

  const { loading, run } = useRequest(login, {
    immediate: false,
    async onSuccess(res) {
      if (res.success) {
        setToken(res.result.token);
        // 登录成功后，直接关闭模态弹窗，停留在当前页面//若使用另外账号登录,直接跳转默认首页
        const flag = LocalStore.get('userId') === res.result.userId
        if(props.type === 'relogin'){
          // 处理websocket
          initPackages()
          if(flag){
            emit('submit')
            return
          } else {
            // 重登录换账号时必须清掉上一账号的会话态，否则 bootstrapSession 会跳过用户信息请求。
            resetSessionStores()
            onlyMessage($t("login.right.419974-8"))
          }
        }
        await userStore.getUserInfo();
        localStorage.removeItem('pFrom') // 清掉来源地址
        if (userStore.isAdmin) {
          const initResp = await getInitSet();
          if (initResp.success && !initResp.result?.length) {
            window.location.href = "/#/init-home";
            return;
          }
        }
        window.location.href = "/";
      }
    },
    onWarn: () => {
      formData.verifyCode = undefined;
      getVerifyCode()
      if (encryption.value?.encrypt?.enabled) {
        reloadEncryption();
      }
    },
  });

  const showCode = computed(() => {
    return !!url?.value?.base64 && config.value.enabled && !config.value.loginWithVerify;
  });

  const submit = (data: Pick<ReloginCredentials, "password">) => {

    const _formData = { ...toRaw(formData) };
    if (encryption.value?.encrypt?.enabled) {
      const _encrypt = encryption.value?.encrypt;
      _formData.password = encrypt(data.password, _encrypt.publicKey);
      _formData.encryptId = _encrypt.id;
    }

    run(_formData);
  };

  const handleClickOther = (item: { id: string }) => {
    LocalStore.set("onLogin", "no");
    window.open(`${BASE_API_PATH}/application/sso/${item.id}/login`);
    window.onstorage = (e) => {
      if (e.newValue) {
        window.location.href = "/";
      }
    };
  };

  watch(
    () => loading.value,
    () => {
      emit("update:loading", loading.value);
    },
  );

  onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
  return { moreVisible, formData, loading, url, showCode, getVerifyCode, submit, handleClickOther }
}
