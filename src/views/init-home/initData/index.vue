<template>
    <div>
        <img
            class="init-data-img"
            @click="showModal"
            :src="
                flag
                    ? DataEnabled
                    : DataDisabled
            "
        />
    </div>
    <!-- 初始数据提交表单 -->
    <a-modal
        v-model:open="visible"
        :title="$t('init-home.index.011072-2')"
        :width="720"
        :maskClosable="false"
        @cancel="cancel"
        @ok="handelSave"
        :okText="$t('Save.index.551009-0')"
        :cancelText="$t('Save.index.551009-1')"
        class="modal-style"
    >
        <a-alert v-if="portError" type="error" show-icon :message="portError"><template #action><a-button @click="loadPorts">{{ $t('PlatformSettings.retry') }}</a-button></template></a-alert>
        <div class="data-content">
            <p class="data-p-style">
                <ExclamationCircleOutlined style="margin: 0 0 0 0.3125rem" />
                {{ $t('init-home.index.011072-3') }}
            </p>
        </div>
        <div style="margin-top: 1.25rem">
            <a-form
                layout="vertical"
                :model="modalForm"
                ref="formRef"
                :rules="rulesModule"
            >
                <a-row :span="24" :gutter="24">
                    <a-col :xs="24" :sm="12">
                        <a-form-item name="host">
                            <template #label>
                                <span>{{ $t('init-home.index.011072-4') }} </span>
                                <a-tooltip
                                    :title="$t('init-home.index.011072-14')"
                                >
                                    <img
                                        class="img-style"
                                        :src="Mark"
                                    />
                                </a-tooltip>
                            </template>
                            <a-input
                                v-model:value="modalForm.host"
                                :disabled="true"
                            />
                        </a-form-item>
                        <a-form-item name="publicHost">
                            <template #label>
                                <span>{{$t('init-home.index.011072-5')}} </span>
                                <a-tooltip
                                    :title="$t('init-home.index.011072-6')"
                                >
                                    <img
                                        class="img-style"
                                        :src="Mark"
                                    />
                                </a-tooltip>
                            </template>
                            <a-input v-model:value="modalForm.publicHost" :placeholder="$t('init-home.index.011072-7')">
                            </a-input>
                        </a-form-item>
                    </a-col>
                    <a-col :xs="24" :sm="12">
                        <a-form-item name="port">
                            <template #label>
                                <span>{{ $t('init-home.index.011072-8') }} </span>
                                <a-tooltip :title="$t('init-home.index.011072-9')">
                                    <img
                                        class="img-style"
                                        :src="Mark"
                                    />
                                </a-tooltip>
                            </template>
                            <a-select :loading="loadingPorts" v-model:value="modalForm.port" :placeholder="$t('init-home.index.011072-10')" show-search>
                                <a-select-option
                                    v-for="item in optionPorts"
                                    :key="item.value"
                                    :value="item.value"
                                    :label="item.label"
                                    >{{ item.label }}</a-select-option
                                >
                            </a-select>
                        </a-form-item>
                        <a-form-item name="publicPort">
                            <template #label>
                                <span>{{ $t('init-home.index.011072-11') }} </span>
                                <a-tooltip :title="$t('init-home.index.011072-12')">
                                    <img
                                        class="img-style"
                                        :src="Mark"
                                    />
                                </a-tooltip>
                            </template>
                            <a-input-number
                                v-model:value="modalForm.publicPort"
                                :placeholder="$t('init-home.index.011072-13')"
                                style="width: 100%"
                                :precision="0"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>
            </a-form>
        </div>
    </a-modal>
</template>

<script setup lang="ts">
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { DataEnabled, DataDisabled, Mark } from '@jetlinks-web-core/assets/init-home'
import { useInitializationData } from './useInitializationData'
const { formRef, flag, visible, modalForm, optionPorts, loadingPorts, portError, rulesModule, showModal, cancel, handelSave, save, loadPorts } = useInitializationData()
defineExpose({ save })
</script>
<style lang="less" scoped>
.init-data-img {
    width: 18.75rem;
}
.modal-style {
    .data-content {
        background: rgb(236, 237, 238);
        .data-p-style {
            padding: 0.625rem;
        }
    }
}</style>
