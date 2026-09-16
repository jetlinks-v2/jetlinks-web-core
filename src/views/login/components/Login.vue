<template>
  <section class="login-workspace">
      <LoginPanelHeader
          :title="panelTitle"
          :description="panelDescription"
          :back-text="t('Login.backDefault')"
          :show-back="activeMode !== defaultMode"
          @back="resetToDefault"
      />

      <div class="login-panel-body">
          <PasswordLogin
              v-if="activeMode === 'password'"
              :loading="loading"
              :image="imageUrl"
              @getCode="getCode"
              @submit="onPasswordSubmit"
              @forgot="onForgotPassword"
              @subAccount="switchMode('subAccount')"
          />

          <div v-else-if="activeMode === 'wechat'" class="wechat-panel">
              <WechatScanLogin :record="wechatRecord" />
          </div>

          <template v-else-if="activeMode === 'mobile' || activeMode === 'email'">
              <CodeLogin
                  :type="activeMode"
                  :loading="loading"
                  :countdown="countdown"
                  @sendCode="onSendCode"
                  @submit="onCodeSubmit"
              />
              <div class="agreement-row">
                  <Checkbox v-model:checked="agreePrivacy">
                      {{ t('Login.agreementPrefix') }}
                      <a @click="onOpen('/platform-service-agreement')">{{ t('Login.platformService') }}</a>
                      {{ t('Login.agreementSeparator') }}
                      <a @click="onOpen('/privacy-agreement')">{{ t('Login.privacyAgreement') }}</a>
                  </Checkbox>
              </div>
          </template>
      </div>

      <MobileWechatLogin
          :record="wechatLoginRecord"
          :is-mobile="isMobile"
      />

      <LoginMethodActions
          v-if="activeMode !== 'subAccount'"
          :title="t('Login.otherMethods')"
          :methods="availableMethods"
          :active-mode="activeMode"
          @change="switchMode"
      />

      <SsoLoginMethods
          :title="t('Login.ssoMethods')"
          :bindings="thirdPartyBindings"
          @select="onSsoSelect"
      />

    <Captcha
      v-model:open="captchaOpen"
      :config="captchaConfigData?.tianai"
      @success="onCaptchaSuccess"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Checkbox, message } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import Captcha from '@jetlinks-web-core/components/Captcha'
import { isProjectStorageEnabled } from '@jetlinks-web-core/utils'
import { getProjectCodeFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { captchaConfig } from '@jetlinks-web-core/api/login'
import { useRequest } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { useLogin } from '../hooks/useLogin'
import { useSsoLogin, type SsoBinding } from '../hooks/useSsoLogin'
import { clearLoginRedirect, toHashHref } from '../utils/redirect'
import CodeLogin from './CodeLogin.vue'
import LoginMethodActions from './LoginMethodActions.vue'
import LoginPanelHeader from './LoginPanelHeader.vue'
import MobileWechatLogin from './MobileWechatLogin.vue'
import PasswordLogin from './PasswordLogin.vue'
import SsoLoginMethods from './SsoLoginMethods.vue'
import SubAccountLogin from './SubAccountLogin.vue'
import WechatScanLogin from './WechatScanLogin.vue'

type LoginMode = 'password' | 'wechat' | 'mobile' | 'email' | 'subAccount'
type LoginMethodAction = {
  key: LoginMode
  label: string
  icon: string
}

const router = useRouter()
const t = i18n.global.t
const defaultMode: LoginMode = 'password'
// 子账号登录与 project storage 共用同一开关，避免独立包进入 SaaS 登录链路。
const subAccountLoginEnabled = isProjectStorageEnabled()

const { data: captchaConfigData } = useRequest(captchaConfig)
const agreePrivacy = ref(true)
const activeMode = ref<LoginMode>(defaultMode)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
const skipDefaultModeVerifyCode = ref(
  subAccountLoginEnabled && !!getProjectCodeFromLocation()
)
const {
  wechatRecord: wechatLoginRecord,
  thirdPartyBindings,
  ensureLoaded: ensureBindInfoLoaded,
  openSsoLogin
} = useSsoLogin()
const {
  loading,
  formData,
  countdown,
  captchaOpen,
  providers,
  imageUrl,
  getCode,
  onCaptchaSuccess,
  handleSendCode,
  handleLogin
} = useLogin(captchaConfigData, {
  shouldAutoLoadVerifyCode: () => !skipDefaultModeVerifyCode.value
})

const showPhone = computed(() => providers.value.some(item => item.id === 'mobile'))
const showEmail = computed(() => providers.value.some(item => item.id === 'email'))
const showWechatLogin = computed(() => !!wechatLoginRecord.value)
const wechatRecord = computed(() => wechatLoginRecord.value || undefined)

const panelMeta = computed<Record<LoginMode, { title: string; description: string }>>(() => ({
  password: {
    title: t('Login.passwordTitle'),
    description: t('Login.passwordDescription')
  },
  wechat: {
    title: t('Login.wechatTitle'),
    description: t('Login.wechatDescription')
  },
  mobile: {
    title: t('Login.mobileTitle'),
    description: t('Login.mobileDescription')
  },
  email: {
    title: t('Login.emailTitle'),
    description: t('Login.emailDescription')
  },
  subAccount: {
    title: t('Login.subAccountTitle'),
    description: t('Login.subAccountDescription')
  }
}))

const panelTitle = computed(() => panelMeta.value[activeMode.value].title)
const panelDescription = computed(() => activeMode.value === 'password' && !subAccountLoginEnabled
  ? ''
  : panelMeta.value[activeMode.value].description)

const availableMethods = computed<LoginMethodAction[]>(() => {
  const methods: LoginMethodAction[] = []

  if (showWechatLogin.value) {
    methods.push({ key: 'wechat', label: t('Login.wechatMethod'), icon: 'WechatOutlined' })
  }
  if (showPhone.value) {
    methods.push({ key: 'mobile', label: t('Login.mobileMethod'), icon: 'MobileOutlined' })
  }
  if (showEmail.value) {
    methods.push({ key: 'email', label: t('Login.emailMethod'), icon: 'MailOutlined' })
  }
  if (activeMode.value !== 'password') {
    methods.push({ key: 'password', label: t('Login.passwordMethod'), icon: 'UserOutlined' })
  }

  return methods.filter(item => item.key !== activeMode.value)
})

const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 768
  }
}

const onSsoSelect = (item: SsoBinding) => {
  openSsoLogin(item)
}

const switchMode = (mode: string) => {
  const nextMode = mode as LoginMode
  if (nextMode === 'subAccount' && !subAccountLoginEnabled) {
    return
  }
  if (nextMode === 'wechat' && !showWechatLogin.value) {
    return
  }
  if (nextMode === 'mobile' && !showPhone.value) {
    return
  }
  if (nextMode === 'email' && !showEmail.value) {
    return
  }

  if (nextMode === defaultMode && !skipDefaultModeVerifyCode.value && !imageUrl.value) {
    getCode()
  }
  activeMode.value = nextMode
  if (nextMode !== defaultMode) {
    skipDefaultModeVerifyCode.value = false
  }
}

const resetToDefault = () => {
  if (subAccountLoginEnabled && getProjectCodeFromLocation()) {
    // 切换为普通登录必须重建根路由，否则 useRoute 仍会保留项目 redirect。
    clearLoginRedirect()
    window.location.replace(toHashHref('/login'))
    return
  }

  activeMode.value = defaultMode
}

const onOpen = (url: string) => {
  window.open(`#${url}`)
}

const onSendCode = (identity: string) => {
  formData.identity = identity
  handleSendCode(activeMode.value)
}

const onCodeSubmit = (values: any) => {
  formData.identity = values.identity
  formData.code = values.code
  formData.type = activeMode.value
  if (agreePrivacy.value) {
    handleLogin('code')
  } else {
    onlyMessage(t('Login.agreementRequired'), 'error')
  }
}

const onPasswordSubmit = (values: any) => {
  formData.username = values.username
  formData.password = values.password
  formData.remember = values.remember
  formData.verifyCode = values.verifyCode
  handleLogin('password')
}

const onForgotPassword = () => {
  message.info(t('Login.forgotPasswordTip'))
}

const syncProjectSubAccountMode = () => {
  const projectCode = subAccountLoginEnabled ? getProjectCodeFromLocation() : ''
  if (projectCode && activeMode.value !== 'subAccount') {
    activeMode.value = 'subAccount'
    skipDefaultModeVerifyCode.value = true
  } else if (!projectCode && activeMode.value === 'subAccount') {
    resetToDefault()
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  ensureBindInfoLoaded()
  syncProjectSubAccountMode()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})

watch(() => router.currentRoute.value.fullPath, () => {
  ensureBindInfoLoaded()
  syncProjectSubAccountMode()
})
</script>
<style scoped lang="less" src="./Login.less"></style>
