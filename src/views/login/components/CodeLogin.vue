<template>
  <div class="code-login">
    <Form
      ref="formRef"
      :model="formState"
      :rules="rules"
      @finish="handleFinish"
      layout="vertical"
    >
      <FormItem name="identity" validate-first>
        <Input
          v-model:value="formState.identity"
          :placeholder="placeholder"
          :inputmode="inputMode"
          allow-clear
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          name="login-identity"
          data-lpignore="true"
          data-1p-ignore="true"
          class="modern-input"
        >
          <template #prefix>
            <AIcon class="login-prefix-icon" :type="icon" />
          </template>
        </Input>
      </FormItem>

      <FormItem name="code">
        <div class="code-input-group">
          <Input
            v-model:value="formState.code"
            :placeholder="t('Login.verifyCodePlaceholder')"
            allow-clear
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            inputmode="numeric"
            spellcheck="false"
            name="login-code"
            data-lpignore="true"
            data-1p-ignore="true"
            class="modern-input code-input"
          >
            <template #prefix>
              <AIcon class="login-prefix-icon" type='SafetyOutlined' />
            </template>
          </Input>
          <Button
            size="large"
            class="code-btn"
            :disabled="countdown > 0 || !formState.identity || validateError"
            :loading="loading && !formState.code"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `${countdown}s` : t('Login.getCode') }}
          </Button>
        </div>
      </FormItem>

      <FormItem class="submit-form-item">
        <Button
          type="primary"
          html-type="submit"
          block
          size="large"
          :loading="loading && !!formState.code"
          class="submit-button"
        >
          {{ t('Login.loginButton') }}
        </Button>
      </FormItem>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {Form, FormItem, Input, Button} from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'

const t = i18n.global.t

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  countdown: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    default: 'mobile'
  },
})

const emit = defineEmits(['submit', 'sendCode'])
const formRef = ref()

const formState = reactive({
  identity: '',
  code: ''
})
const validateError = ref(false)

const rules = {
  identity: [
    { required: true, message: props.type === 'mobile' ? t('Login.mobileRequired') : t('Login.emailRequired') },
    {
      validator: (_rule: any, value: string) => {
        const tip = props.type === 'mobile' ? t('Login.mobileRequired') : t('Login.emailRequired')
        if (!value) {
          return Promise.reject(tip)
        }

        if (props.type === 'mobile') {
          // 验证中国手机号：1开头，第二位是3-9，总共11位
          const phoneRegex = /^1[3-9]\d{9}$/
          if (!phoneRegex.test(value)) {
            validateError.value = true
            return Promise.reject(t('Login.mobileInvalid'))
          }
        } else {
          // 验证邮箱格式
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            validateError.value = true
            return Promise.reject(t('Login.emailInvalid'))
          }
        }
        validateError.value = false

        return Promise.resolve()
      }
    }
  ],
  code: [{ required: true, message: t('Login.verifyCodeRequired') }]
}

const placeholder = computed(() => {
  return props.type === 'mobile' ? t('Login.mobilePlaceholder') : t('Login.emailPlaceholder')
})
const icon = computed(() => {
  return props.type === 'mobile' ? 'MobileOutlined' : 'MailOutlined'
})
const inputMode = computed(() => {
  return props.type === 'mobile' ? 'numeric' : 'email'
})

const handleSendCode = () => {
  if (!formState.identity) {
    return
  }
  emit('sendCode', formState.identity)
}

const handleFinish = (values: any) => {
  emit('submit', { ...values })
}

</script>

<style scoped lang="less">
.code-login {
  .login-prefix-icon {
    color: var(--jet-theme-text-disabled);
  }

  .submit-form-item {
    margin-top: var(--space-6);
    margin-bottom: 0;
  }

  .code-input-group {
    display: flex;
    gap: 0.625rem;
    align-items: flex-start;

    .code-input {
      flex: 1;
    }

    .code-btn {
      min-width: 7.5rem;
      border: 0.09375rem solid var(--jet-theme-border-secondary);
      background: var(--jet-theme-bg-container);
      color: var(--jet-theme-primary);
      font-size: var(--fs-14);
      font-weight: 600;
      transition: all 0.3s;

      &:hover:not(:disabled) {
        border-color: var(--jet-theme-primary);
        color: var(--jet-theme-primary-active);
        background: var(--jet-theme-primary-soft);
        transform: translateY(-0.0625rem);
        box-shadow: var(--jet-theme-shadow-secondary);
      }

      &:disabled {
        background: var(--jet-theme-bg-container);
        color: var(--jet-theme-text-disabled);
        border-color: var(--jet-theme-border-secondary);
        cursor: not-allowed;
      }
    }
  }
}

@media (max-width: 48rem) {
  .code-login {
    .code-input-group {
      flex-direction: column;
      gap: var(--space-3);

      .code-input {
        width: 100%;
      }

      .code-btn {
        width: 100%;
        height: 2.5rem;
        min-width: auto;
        font-size: var(--fs-16);
      }
    }

    :deep(.ant-input) {
      font-size: var(--fs-16);
    }

    :deep(.ant-btn) {
      height: 2.5rem;
      font-size: var(--fs-16);
    }
  }
}</style>
