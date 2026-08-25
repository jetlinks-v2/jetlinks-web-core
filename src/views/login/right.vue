<template>
  <div class="content">
    <div class="top">
      请登录账号
    </div>
    <div class="main">
      <Form
        ref="formRef"
        layout="vertical"
        :model="formData"
        :rules="rules"
        @finish="submit"
      >
        <FormItem :label="$t('login.right.419974-0')" name="username">
          <Input
            v-model:value="formData.username"
            :placeholder="$t('login.right.419974-1')"
            :maxlength="64"
            autocomplete="off"
          />
        </FormItem>
        <FormItem :label="$t('login.right.419974-2')" name="password">
          <InputPassword
            v-model:value="formData.password"
            :placeholder="$t('login.right.419974-3')"
            :maxlength="64"
            autocomplete="off"
          />
        </FormItem>
        <FormItem
          v-if="showCode"
          :label="$t('login.right.419974-4')"
          name="verifyCode"
        >
          <Input
            v-model:value="formData.verifyCode"
            autocomplete="off"
            :maxlength="64"
            :placeholder="$t('login.right.419974-5')"
            @keyup.enter="handleEnterSubmit"
          >
            <template #addonAfter>
              <img :src="url.base64" @click="getVerifyCode" />
            </template>
          </Input>
        </FormItem>
        <FormItem>
          <Remember
            v-model:value="formData.remember"
            v-model:expires="formData.expires"
          />
        </FormItem>
        <FormItem>
          <Button
            :loading="loading"
            type="primary"
            html-type="submit"
            class="login-form-button"
            block
            size="large"
          >
            {{ $t('login.right.419974-6') }}
          </Button>
        </FormItem>
      </Form>
      <SsoLogin
        :bindings="bindings"
        @select="handleClickOther"
      />
    </div>
  </div>
</template>
<script setup name="LoginRight">
import Remember from './remember.vue'
import SsoLogin from './sso-login.vue'
import { encrypt, onlyMessage, setToken } from '@jetlinks-web/utils'
import { useRequest } from '@jetlinks-web/hooks'
import {
  captchaConfig,
  codeUrl,
  encryptionConfig,
  getInitSet,
  login
} from '@jetlinks-web-core/api/login'
import { rules } from './util'
import { useUserStore } from '@jetlinks-web-core/store'
import { LocalStore } from '@jetlinks-web/utils'
import { Form, FormItem, Button, Input, InputPassword } from 'ant-design-vue'

import { initPackages } from '@jetlinks-web-core/package'
import i18n from '@jetlinks-web-core/locales'
import { resetSessionStores } from '@jetlinks-web-core/router/startup'
import { request } from '@jetlinks-web/core'

const BASE_API_PATH = import.meta.env.VITE_APP_BASE_API
const DEFAULT_LOGIN_REDIRECT = '/'

const $t = i18n.global.t

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  bindings: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'login' // 'login' 'relogin'
  }
})

const emit = defineEmits(['submit', 'update:loading'])
const userStore = useUserStore()
const formRef = ref()

const warmupWorkflowSession = () => {
  request.post('/park/workflow/session/warmup').catch((error) => {
    console.warn('mldong session warmup failed; workflow will retry on demand', error)
  })
}

const getLoginRedirect = () => {
  const query = window.location.hash.split('?')[1]
  const redirect = query ? new URLSearchParams(query).get('redirect') : null

  if (!redirect) {
    return DEFAULT_LOGIN_REDIRECT
  }

  try {
    const path = decodeURIComponent(redirect)
    return path.startsWith('/') && !path.startsWith('//')
      ? path
      : DEFAULT_LOGIN_REDIRECT
  } catch {
    return DEFAULT_LOGIN_REDIRECT
  }
}

const formData = reactive({
  username: '',
  password: '',
  expires: 3600000,
  remember: false,
  verifyCode: undefined,
  verifyKey: undefined,
  encryptId: undefined,
  'captcha-id': undefined
})

let timer = null
const { data: encryption, run: reloadEncryption } = useRequest(
  encryptionConfig,
  {
    onSuccess() {
      if (timer) {
        window.clearTimeout(timer)
        timer = null
      }

      timer = setTimeout(
        () => {
          reloadEncryption()
        },
        3 * 60 * 1000
      )
    }
  }
)

const getVerifyCode = (record) => {
  const _config = config.value || record
  if (_config && _config.enabled && !_config.loginWithVerify && _config.type === 'image') {
    getCode()
  }
}

const { data: config } = useRequest(captchaConfig, {
  onSuccess(resp) {
    getVerifyCode(resp.result)

    return resp.result
  }
})

const { data: url, run: getCode } = useRequest(codeUrl, {
  immediate: false,
  onSuccess(resp) {
    if (config.value && resp.result?.key) {
      formData.verifyKey = resp.result?.key
    }
  }
})

const { loading, run } = useRequest(login, {
  immediate: false,
  async onSuccess(res) {
    if (res.success) {
      setToken(res.result.token)
      // 预热失败不影响 Detainer 主登录，流程页面打开时仍会按需换取会话。
      warmupWorkflowSession()
      // 登录成功后，直接关闭模态弹窗，停留在当前页面//若使用另外账号登录,直接跳转默认首页
      const flag = LocalStore.get('userId') === res.result.userId
      if (props.type === 'relogin') {
        // 处理websocket
        initPackages()
        if (flag) {
          emit('submit')
          return
        } else {
          // 重登录换账号时必须清掉上一账号的会话态，否则 bootstrapSession 会跳过用户信息请求。
          resetSessionStores()
          onlyMessage($t('login.right.419974-8'))
        }
      }
      await userStore.getUserInfo()
      if (userStore.isAdmin) {
        const initResp = await getInitSet()
        if (initResp.success && !initResp.result?.length) {
          window.location.href = '/#/init-home'
          return
        }
      }
      window.location.href = `/#${getLoginRedirect()}`
    }
  },
  onWarn: () => {
    formData.verifyCode = undefined
    getVerifyCode()
    if (encryption.value?.encrypt?.enabled) {
      reloadEncryption()
    }
  }
})

const showCode = computed(() => {
  return !!url?.value?.base64 && config.value.enabled && !config.value.loginWithVerify
})

const submit = (data) => {

  const _formData = { ...toRaw(formData) }
  if (encryption.value?.encrypt?.enabled) {
    const _encrypt = encryption.value?.encrypt
    _formData.password = encrypt(data.password, _encrypt.publicKey)
    _formData.encryptId = _encrypt.id
  }

  run(_formData)
}

const handleEnterSubmit = () => {
  formRef.value?.submit()
}

const handleClickOther = (item) => {
  LocalStore.set('onLogin', 'no')
  window.open(`${BASE_API_PATH}/application/sso/${item.id}/login`)
  window.onstorage = (event) => {
    if (event.newValue) {
      window.location.href = `/#${getLoginRedirect()}`
    }
  }
}

watch(
  () => loading.value,
  () => {
    emit('update:loading', loading.value)
  }
)
</script>
<style lang="less" scoped>
.content {
  padding: 3rem;

  .top {
    color: #1F2021;
    font-size: 24px;
    font-weight: 500;
    text-align: center;
    margin-bottom: 40px;
  }

  .main {
    :deep(.ant-form-item) {
      margin-bottom: 24px !important;

      .ant-form-item-label {
        label {
          color: #1D2129;
          font-size: 16px;
        }
      }

      .ant-form-item-control-input {
        .ant-input, .ant-input-affix-wrapper {
          border-radius: 6px;
          border: 1px solid #DDE0E8;
          background: #FFF;
          padding: 8px 16px;
          font-size: 1rem;
        }

        .ant-input-password {
          .ant-input {
            padding: 0;
            border: none;
          }
        }
      }

      .ant-checkbox-wrapper {
        span {
          color: #4E5969;
        }
      }
    }

  }
}
</style>
