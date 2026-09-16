<template>
  <div class="password-login">
    <Form
      ref="formRef"
      :model="formState"
      :rules="rules"
      @finish="handleFinish"
      layout="vertical"
    >
      <FormItem name="username">
        <Input
          v-model:value="formState.username"
          :placeholder="t('Login.independentAccountPlaceholder')"
          allow-clear
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          name="login-account"
          data-lpignore="true"
          data-1p-ignore="true"
          class="modern-input"
        >
          <template #prefix>
            <AIcon class="login-prefix-icon" type='UserOutlined' />
          </template>
        </Input>
      </FormItem>

      <FormItem name="password">
        <InputPassword
          v-model:value="formState.password"
          :placeholder="t('Login.passwordPlaceholder')"
          allow-clear
          autocomplete="new-password"
          name="login-password"
          data-lpignore="true"
          data-1p-ignore="true"
          class="modern-input"
        >
          <template #prefix>
            <AIcon class="login-prefix-icon" type='LockOutlined' />
          </template>
        </InputPassword>
      </FormItem>
        <FormItem name="verifyCode" v-if="image">
          <Input
            v-model:value="formState.verifyCode"
            :placeholder="t('Login.verifyCodePlaceholder')"
            allow-clear
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            inputmode="numeric"
            :maxlength="64"
            spellcheck="false"
            name="login-verify-code"
            data-lpignore="true"
            data-1p-ignore="true"
            class="modern-input verify-code-input"
            @keyup.enter="handleEnterSubmit"
          >
            <template #addonAfter>
              <img :src="image" @click="getCode" />
            </template>
          </Input>
      </FormItem>

      <div class="form-actions">
        <Checkbox v-model:checked="formState.remember">{{ t('Login.rememberMe') }}</Checkbox>
        <div class="account-links">
          <a class="forgot-password" @click.prevent="$emit('forgot')">{{ t('Login.forgotPasswordLink') }}</a>
        </div>
      </div>

      <FormItem class="submit-form-item">
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
import { reactive, ref, watch } from 'vue'

import { Form, FormItem, Input, InputPassword, Checkbox, Button } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import { isProjectStorageEnabled } from '@jetlinks-web-core/utils'

const t = i18n.global.t
const subAccountLoginEnabled = isProjectStorageEnabled()

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  image: {
    type: String,
    default: undefined
  }
})

const emit = defineEmits(['submit', 'forgot', 'getCode', 'subAccount'])

const formRef = ref()

const formState = reactive({
  username: '',
  password: '',
  remember: true,
  verifyCode: undefined,
})

const rules = {
  username: [{ required: true, message: t('Login.accountRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('Login.passwordRequired'), trigger: 'blur' }],
  verifyCode: [{ required: true, message: t('Login.verifyCodeRequired'), trigger: 'blur' }]
}

const handleFinish = () => {
  emit('submit', { ...formState })
}

const handleEnterSubmit = () => {
  formRef.value?.submit()
}

const getCode = () => {
  emit('getCode')
}

watch(() => props.image, () => {
  formState.verifyCode = undefined
})

</script>

<style scoped lang="less">
.password-login {
  .login-prefix-icon {
    color: var(--jet-theme-text-disabled);
  }

  .submit-form-item {
    margin-top: 0.875rem;
    margin-bottom: 0;
  }

  input:-internal-autofill-selected {
    background-color: transparent !important;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.125rem;
  }

  .account-links {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    flex: none;
  }

  .forgot-password,
  .sub-account-link {
    color: var(--color-jet-gray-500);
    cursor: pointer;
    font-size: var(--fs-14);
    text-decoration: none;
    transition: opacity 0.3s;
    font-weight: 400;

    &:hover {
      color: var(--jet-theme-primary);
    }
  }

  .account-links__divider {
    width: 0.0625rem;
    height: 0.75rem;
    background: var(--jet-theme-border);
  }

  :deep(.verify-code-input .ant-input-group-addon) {
    box-sizing: border-box;
    line-height: 0 !important;

    img {
      display: block;
      width: auto;
      height: 1.875rem;
      max-height: 100%;
      cursor: pointer;
    }
  }
}

@media (max-width: 48rem) {
  .password-login {
    :deep(.ant-input),
    :deep(.ant-input-password) {
      font-size: var(--fs-16);
    }

    .form-actions {
      margin-bottom: var(--space-2);
    }

    .forgot-password,
    .sub-account-link {
      font-size: var(--fs-14);
    }

    :deep(.ant-input-group-addon) {
      img {
        height: 1.75rem;
        width: auto;
      }
    }
  }
}</style>
