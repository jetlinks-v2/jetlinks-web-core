<template>
    <a-modal
        open
        :title="$t(isResetMode ? 'EditPassword.index.010161-0' : 'AccountInfo.editPassword')"
        :width="480"
        centered
        :confirmLoading="loading"
        @cancel="emits('close')"
    >
                <a-typography-paragraph v-if="!isResetMode" type="secondary">{{ $t('EditPassword.prototype.changeHint') }}</a-typography-paragraph>
                <a-form :model="form" layout="vertical" ref="formRef">
                    <a-form-item
                        :label="$t('EditPassword.index.010161-4')"
                        name="oldPassword"
                        v-if="!isResetMode"
                        :rules="isResetMode ? [] : [
                            { required: true, message: $t('EditPassword.index.010161-5') },
                            { validator: checkMethods.old, trigger: 'blur' },
                        ]"
                    >
                        <a-input-password
                            v-model:value="form.oldPassword"
                            :placeholder="$t('EditPassword.index.010161-5')"
                            autocomplete="current-password"
                        />
                    </a-form-item>
                    <a-form-item
                        :label="$t('EditPassword.index.010161-6')"
                        name="newPassword"
                        :extra="$t('EditPassword.prototype.passwordHint')"
                        :rules="[
                            { required: true, message: $t('EditPassword.index.010161-7') },
                            { validator: checkMethods.new, trigger: 'blur' },
                        ]"
                    >
                        <a-input-password
                            v-model:value="form.newPassword"
                            :placeholder="$t('EditPassword.index.010161-7')"
                        />
                    </a-form-item>
                    <a-form-item
                        :label="$t('EditPassword.index.010161-8')"
                        name="confirmPassword"
                        :style="{ marginBottom: 0 }"
                        :rules="[
                            { required: true, message: $t('EditPassword.index.010161-9') },
                            {
                                validator: checkMethods.confirm,
                                trigger: 'blur',
                            },
                        ]"
                    >
                        <a-input-password
                            v-model:value="form.confirmPassword"
                            :placeholder="$t('EditPassword.index.010161-9')"
                        />
                    </a-form-item>
                </a-form>
        <template #footer>
            <a-button :disabled="loading" @click="emits('close')">{{ $t('EditPassword.index.010161-10') }}</a-button>
            <a-button type="primary" :loading="loading" @click="handleOk">{{ $t(isResetMode ? 'EditPassword.index.010161-13' : 'EditPassword.prototype.confirmChange') }}</a-button>
        </template>
    </a-modal>
</template>

<script setup lang="ts">
import {
    updateMepsd_api,
    resetPassword_api,
} from '@jetlinks-web-core/api/account/center';
import { usePasswordValidation } from './usePasswordValidation'
import { onlyMessage } from "@jetlinks-web/utils";
import { Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
type formType = {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
};

const emits = defineEmits(['close']);
const router = useRouter();

const props = defineProps({
  type: {
    type: Boolean,
    default: false
  }
})

// 是否为重置密码模式（忘记密码）
const isResetMode = ref(props.type);


const loading = ref(false);
const formRef = ref<any>();

const form = ref<formType>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
});
const checkMethods = usePasswordValidation(form)

/** 表单错误由字段就地显示，不把包含密码的表单值写入控制台。 */
const handleValidationFailure = (error: unknown) => {
    if (!error || typeof error !== 'object' || !('errorFields' in error)) {
        onlyMessage($t('EditPassword.validationUnavailable'), 'error')
    }
}

const handleOk = () => {
    if (loading.value) return
    const validateFields = isResetMode.value
        ? ['newPassword', 'confirmPassword']
        : ['oldPassword', 'newPassword', 'confirmPassword'];

    formRef.value?.validate(validateFields).then(() => {
        if (loading.value) return
        loading.value = true;
        if (isResetMode.value) {
            // 重置密码模式：调用重置密码接口
            resetPassword_api({ password: form.value.newPassword })
                .then((resp) => {
                    if (resp.success === false || (resp.success !== true && resp.status !== 200)) {
                        onlyMessage($t('EditPassword.index.010161-17'), 'error')
                    } else {
                        onlyMessage($t('EditPassword.index.010161-19'), 'success');
                        emits('close')
                        Modal.warning({
                            content: $t('EditPassword.index.010161-20'),
                            okText: $t('EditPassword.index.010161-21'),
                            onOk() {
                                localStorage.clear();
                                router.push('/user/login');
                            },
                        });
                    }
                })
                .catch((error) => {
                    // 取消验证时不显示错误提示
                    if (error?.message === 'verify_canceled' || error?.message?.includes('verify_canceled')) {
                        return;
                    }
                    onlyMessage(error?.message || $t('EditPassword.index.010161-17'), 'error');
                })
                .finally(() => (loading.value = false));
        } else {
            // 修改密码模式：调用修改密码接口
            const params = {
                oldPassword: form.value.oldPassword,
                newPassword: form.value.newPassword,
            };
            updateMepsd_api(params)
                .then((resp) => {
                    if (resp.success === false || (resp.success !== true && resp.status !== 200)) {
                        onlyMessage($t('EditPassword.index.010161-17'), 'error')
                    } else {
                        onlyMessage($t('EditPassword.prototype.changed'), 'success');
                        emits('close')
                        Modal.warning({
                            content: $t('EditPassword.index.010161-20'),
                            okText: $t('EditPassword.index.010161-21'),
                            onOk() {
                                localStorage.clear();
                                router.push('/user/login');
                            },
                        });
                    }
                })
                .catch((error) => {
                    // 取消验证时不显示错误提示
                    if (error?.message === 'verify_canceled' || error?.message?.includes('verify_canceled')) {
                        return;
                    }
                    onlyMessage(error?.message || $t('EditPassword.index.010161-17'), 'error');
                })
                .finally(() => (loading.value = false));
        }
    }).catch(handleValidationFailure);
};
</script>
