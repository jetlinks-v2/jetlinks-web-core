<template>
  <div v-if="subAccountLoginEnabled" class="sub-account-login">
    <Form
      :model="formState"
      :rules="rules"
      layout="vertical"
      @finish="handleFinish"
    >
      <div v-if="showHeader" class="title-row">
        <span class="title">{{ t('Login.subAccountTitle') }}</span>
        <a class="back-link" @click.prevent="$emit('close')">{{ t('Login.backDefault') }}</a>
      </div>

      <div class="divider"></div>

      <FormItem name="username" style="margin-bottom: 1.25rem">
        <div class="combined-account-input">
          <Input
            ref="usernameInputRef"
            v-model:value="formState.username"
            class="modern-input account-input username-input"
            :placeholder="t('Login.usernamePlaceholder')"
            :bordered="false"
            @input="handleUsernameInput"
          />
          <span class="at-sign">@</span>
          <Input
            ref="projectCodeInputRef"
            v-model:value="formState.projectCode"
            class="modern-input account-input code-input"
            :placeholder="t('Login.projectCodePlaceholder')"
            :bordered="false"
          />
        </div>
      </FormItem>

      <FormItem name="password" style="margin-bottom: 0.5rem">
        <InputPassword
          v-model:value="formState.password"
          :placeholder="t('Login.passwordPlaceholder')"
          allow-clear
          class="modern-input password-input"
        />
      </FormItem>

      <div class="form-actions">
        <Checkbox v-model:checked="formState.remember">{{ t('Login.rememberMe') }}</Checkbox>
      </div>

      <FormItem style="margin-top: 0.875rem; margin-bottom: 0">
        <Button
          type="primary"
          html-type="submit"
          block
          size="large"
          :loading="loading"
          class="submit-button"
        >
          {{ t('Login.loginButton') }}
        </Button>
      </FormItem>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Form, FormItem, Input, InputPassword, Checkbox, Button } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'

import { subAccountLogin, type SubAccountLoginResponse } from '@jetlinks-web-core/api/login'
import { onlyMessage, setToken } from '@jetlinks-web/utils'
import { isProjectStorageEnabled, setProjectStorage } from '@jetlinks-web-core/utils'
import { useBusinessApplicationStore } from '@jetlinks-web-core/store/businessApplication'
import {
  createProjectRuntimeHref,
  getProjectCodeFromLocation,
} from '@jetlinks-web-core/utils/project-runtime'

defineEmits(['close'])
withDefaults(
  defineProps<{
    showHeader?: boolean
  }>(),
  {
    showHeader: true
  }
)
const t = i18n.global.t
const subAccountLoginEnabled = isProjectStorageEnabled()
const businessApplicationStore = useBusinessApplicationStore()

const loading = ref(false)
const usernameInputRef = ref()
const projectCodeInputRef = ref()

const formState = reactive({
  username: '',
  projectCode: '',
  password: '',
  remember: true,
})

const rules = {
  username: [{ required: true, message: t('Login.usernameRequired'), trigger: 'blur' }],
  projectCode: [{ required: true, message: t('Login.projectCodeRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('Login.passwordRequired'), trigger: 'blur' }],
}

const resolveRedirectPath = () => {
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return '/'

  const searchParams = new URLSearchParams(hash.slice(queryIndex + 1))
  return searchParams.get('redirect') || '/'
}

const resolveLoginToken = (response: SubAccountLoginResponse) => (
  // resp.token 仅用于少量历史兼容场景；新结构统一从 result.token 读取。
  response?.result?.token || response?.token
)

onMounted(() => {
  const code = subAccountLoginEnabled ? getProjectCodeFromLocation() : ''
  if (code) {
    formState.projectCode = code
  }
})

const handleUsernameInput = (e: Event) => {
  const value = (e.target as HTMLInputElement | null)?.value || ''
  if (value.includes('@')) {
    const [username, ...projectCodeParts] = value.split('@')
    formState.username = username
    const projectCode = projectCodeParts.join('@')
    if (projectCode) {
      formState.projectCode = projectCode
    }
    // 延迟聚焦，确保 v-model 更新完成
    setTimeout(() => {
      projectCodeInputRef.value?.focus()
    }, 0)
  }
}

const handleFinish = async () => {
  if (!subAccountLoginEnabled || !formState.username || !formState.projectCode || !formState.password) return
  loading.value = true

  try {
    const expires = formState.remember ? 12 * 60 * 60 * 1000 : 3600000
    const code = formState.projectCode
    const resp = await subAccountLogin({
      username: formState.username,
      password: formState.password,
      projectCode: code,
      expires,
    })

    // 后端统一包装为 { result: SubAccountLoginResult, status: 200 }
    const token = resolveLoginToken(resp)
    const result = resp?.result
    if (token && result?.access) {
      setToken(token)
      const projectId = result.project?.id || ''
      const projectName = result.project?.name || code
      setProjectStorage(code, {
        domain: code,
        apiUrl: result.access.apiUrl,
        token: result.access.token,
        name: projectName,
        projectName,
        runtime: projectId,
        id: projectId,
      })

      const redirectPath = resolveRedirectPath()

      businessApplicationStore.init()
      const enteredApplication = await businessApplicationStore.enterFirstApplication({
        currentProjectCode: code,
        fallbackPath: redirectPath,
        silent: true,
      })
      if (enteredApplication) return

      window.location.href = createProjectRuntimeHref(code, redirectPath)
      return
    }

    // 兼容旧结构：success=true 但不返回 token 的场景
    //（新结构通常没有 success 字段）
    if (resp?.success) {
      onlyMessage(t('Login.loginSuccess'), 'success')
      window.location.reload()
      return
    }

    // 新结构错误信息可能仍在 message 字段
    onlyMessage(resp?.message || t('Login.loginFailed'), 'error')
  } catch {
    // 统一请求组件已处理错误提示，这里不再重复显示
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="less" src="./SubAccountLogin.less"></style>
