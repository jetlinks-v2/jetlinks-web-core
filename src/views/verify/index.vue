<template>
  <Modal
    v-model:open="visible"
    :title="title"
    :maskClosable="false"
    :width="type === 'identity' ? 420 : 400"
    @cancel="onCancel"
    @ok="onSubmit"
    :okButtonProps="{ loading: submitting }"
    :okText="submitText"
    :cancelText="t('verify.cancel')"
  >
    <!-- 验证码 -->
    <template v-if="type === 'captcha'">
      <Form ref="formRef" layout="vertical" :model="captchaForm" :rules="captchaRules">
        <FormItem :label="t('verify.captchaLabel')" name="verifyCode">
          <Input
            v-model:value="captchaForm.verifyCode"
            :placeholder="t('verify.captchaPlaceholder')"
            :maxlength="64"
            autocomplete="off"
          >
            <template #suffix>
              <span class="captcha-suffix" @click="loadCaptchaImage">
                <img
                  v-if="captchaImage"
                  :src="captchaImage"
                  class="captcha-img"
                />
                <span v-else class="captcha-loading">{{ t('verify.loading') }}</span>
              </span>
            </template>
          </Input>
        </FormItem>
      </Form>
    </template>

    <!-- 身份校验 -->
    <template v-else-if="type === 'identity'">
      <Form ref="formRef" layout="vertical" :model="identityForm" :rules="identityRules">
        <FormItem :label="t('verify.identityLabel')" name="identityId">
          <Select
            v-model:value="identityForm.identityId"
            :placeholder="t('verify.identityPlaceholder')"
            :options="identityOptions"
            :field-names="{ label: 'identityLabel', value: 'id' }"
            @change="onIdentityChange"
          />
        </FormItem>
        <FormItem
          v-if="identityForm.identityId && isMobileProvider && !validationSent"
          :label="t('verify.phoneLabel')"
          name="identityValue"
        >
          <Input
            v-model:value="identityForm.identityValue"
            :placeholder="t('verify.phonePlaceholder')"
            :maxlength="20"
            autocomplete="off"
          />
        </FormItem>
        <FormItem v-if="identityForm.identityId && !validationSent" :label="t('verify.sendCode')">
          <Button type="primary" :loading="sendingCode" block @click="sendIdentityCode">
            {{ t('verify.sendCodeButton') }}
          </Button>
        </FormItem>
        <FormItem v-if="validationSent" :label="t('verify.codeLabel')" name="code">
          <Input
            v-model:value="identityForm.code"
            :placeholder="t('verify.codePlaceholder')"
            :maxlength="16"
            autocomplete="off"
          />
        </FormItem>
      </Form>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { Modal, Form, FormItem, Input, Select, Button } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  getVerifyCaptchaConfig,
  getVerifyCaptchaImage,
  confirmCaptcha,
  requestIdentityVerify,
  confirmIdentityVerify,
  getSelfIdentitiesForVerify
} from '@jetlinks-web-core/api/verify'
import type { VerifyRequiredResult } from '@jetlinks-web-core/api/verify'
import i18n from '@jetlinks-web-core/locales'

const { t } = i18n.global

const props = defineProps<{
  verifyResult: VerifyRequiredResult
}>()

const emit = defineEmits<{
  success: [payload: { key: string; token: string; disposable: boolean }]
  cancel: []
}>()

const visible = ref(true)
const type = computed(() => props.verifyResult?.type ?? 'captcha')
const title = computed(() =>
  type.value === 'captcha' ? t('verify.titleCaptcha') : t('verify.titleIdentity')
)
const submitText = computed(() =>
  type.value === 'captcha' ? t('verify.submit') : t('verify.confirm')
)

const formRef = ref<FormInstance>()
const submitting = ref(false)
const sendingCode = ref(false)
const validationSent = ref(false)
const validationData = ref<{ requestId: string; token: string; context?: Record<string, unknown> } | null>(null)
const identityListRaw = ref<Array<{ id: string; provider: string; identity: string }>>([])
const identityOptions = computed(() =>
  identityListRaw.value.map((item) => ({
    id: item.id,
    provider: item.provider,
    identity: item.identity,
    identityLabel: `${t('verify.provider.' + item.provider)}: ${item.identity}`
  }))
)

const captchaForm = reactive({
  verifyCode: '',
  imageKey: ''
})
const captchaImage = ref('')
const captchaConfig = ref<{ type?: string } | null>(null)

const identityForm = reactive({
  identityId: '',
  identityValue: '',
  code: ''
})

const mobileProviders = ['mobile', 'phone', 'sms', 'phoneNumber']
const selectedIdentityOption = computed(() =>
  identityForm.identityId ? identityListRaw.value.find((o) => o.id === identityForm.identityId) : null
)
const isMobileProvider = computed(() =>
  selectedIdentityOption.value ? mobileProviders.includes(selectedIdentityOption.value.provider) : false
)

const captchaRules = {
  verifyCode: [{ required: true, message: t('verify.verifyCodeRequired') }]
}
const identityRules = {
  identityId: [{ required: true, message: t('verify.identityRequired') }],
  identityValue: [{ required: true, message: t('verify.phoneRequired') }],
  code: [{ required: true, message: t('verify.codeRequired') }]
}

async function loadCaptchaImage() {
  try {
    const res = await getVerifyCaptchaImage()
    const data = res?.result ?? res
    if (data?.base64) {
      captchaImage.value = data.base64
      captchaForm.imageKey = data.key ?? ''
    }
  } catch {
    captchaImage.value = ''
  }
}

async function loadCaptchaConfig() {
  try {
    const res = await getVerifyCaptchaConfig()
    const data = res?.result ?? res
    captchaConfig.value = data ?? null
    await loadCaptchaImage()
  } catch {
    captchaConfig.value = null
  }
}

async function loadIdentities() {
  try {
    const res = await getSelfIdentitiesForVerify()
    const list = res?.result ?? res ?? []
    identityListRaw.value = Array.isArray(list)
      ? list.map((item: { id: string; provider: string; identity: string }) => ({
          id: item.id,
          provider: item.provider,
          identity: item.identity
        }))
      : []
  } catch {
    identityListRaw.value = []
  }
}

function onIdentityChange() {
  validationSent.value = false
  validationData.value = null
  identityForm.code = ''
  identityForm.identityValue = ''
}

async function sendIdentityCode() {
  if (!identityForm.identityId) return
  const item = identityOptions.value.find((o) => o.id === identityForm.identityId)
  if (!item) return
  if (isMobileProvider.value && !identityForm.identityValue?.trim()) {
    await formRef.value?.validateFields(['identityValue'])
    return
  }

  sendingCode.value = true
  try {
    const identityToSend = isMobileProvider.value ? identityForm.identityValue?.trim() ?? '' : item.identity
    const res = await requestIdentityVerify(identityForm.identityId, {
      provider: item.provider,
      identity: identityToSend
    })
    const data = res?.result ?? res
    validationData.value = data
      ? { requestId: (data as any).requestId, token: (data as any).token, context: (data as any).context }
      : null
    validationSent.value = true
  } finally {
    sendingCode.value = false
  }
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  if (type.value === 'identity' && !validationSent.value) {
    return
  }
  if (type.value === 'identity' && !identityForm.code?.trim()) {
    formRef.value?.validateFields(['code'])
    return
  }

  submitting.value = true
  try {
    let res: { result?: { token: string } }
    if (type.value === 'captcha') {
      res = await confirmCaptcha({
        key: props.verifyResult.key,
        provider: captchaConfig.value?.type ?? 'image',
        params: {
          verifyKey: captchaForm.imageKey,
          verifyCode: captchaForm.verifyCode
        }
      })
    } else {
      if (!validationData.value) throw new Error('Validation not sent')
      const item = identityOptions.value.find((o) => o.id === identityForm.identityId)
      res = await confirmIdentityVerify({
        key: props.verifyResult.key,
        provider: item?.provider ?? '',
        requestId: validationData.value.requestId,
        token: validationData.value.token,
        context: validationData.value.context,
        params: { code: identityForm.code }
      })
    }
    const token = (res?.result ?? (res as any))?.token
    if (token) {
      visible.value = false
      await nextTick()
      emit('success', {
        key: props.verifyResult.key,
        token,
        disposable: props.verifyResult.disposable
      })
    }
  } catch (e) {
    console.error(e)
    if (type.value === 'captcha') {
      captchaForm.verifyCode = ''
      await loadCaptchaImage()
    }
    submitting.value = false
    return Promise.reject(e)
  }
  submitting.value = false
}

async function onCancel() {
  visible.value = false
  await nextTick()
  emit('cancel')
}

watch(
  () => props.verifyResult,
  (val) => {
    if (!val) return
    if (val.type === 'captcha') {
      loadCaptchaConfig()
    } else {
      loadIdentities()
      validationSent.value = false
      validationData.value = null
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="less">
.captcha-suffix {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding-left: 8px;
  border-left: 1px solid #d9d9d9;
}
.captcha-img {
  height: 32px;
  width: 130px;
  object-fit: contain;
  display: block;
}
.captcha-loading {
  font-size: 12px;
  color: #999;
}
</style>
