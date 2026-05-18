<template>
  <Modal
    v-model:open="visible"
    wrapClassName="relogin-modal"
    :maskClosable="false"
    :footer="null"
    :width="!isCloud ? 1020 : 718"
    :bodyStyle="{padding: 0}"
    @cancel="onCancel"
    centered
  >
    <template #closeIcon>
      <Button class="relogin-close" danger type="link" @click="onCancel">
        <svg focusable="false" class="" data-icon="export" width="1em" height="1em" fill="currentColor" aria-hidden="true" viewBox="64 64 896 896"><path d="M888.3 757.4h-53.8c-4.2 0-7.7 3.5-7.7 7.7v61.8H197.1V197.1h629.8v61.8c0 4.2 3.5 7.7 7.7 7.7h53.8c4.2 0 7.7-3.4 7.7-7.7V158.7c0-17-13.7-30.7-30.7-30.7H158.7c-17 0-30.7 13.7-30.7 30.7v706.6c0 17 13.7 30.7 30.7 30.7h706.6c17 0 30.7-13.7 30.7-30.7V765.1c0-4.3-3.5-7.7-7.7-7.7zm18.6-251.7L765 393.7c-5.3-4.2-13-.4-13 6.3v76H438c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h314v76c0 6.7 7.8 10.5 13 6.3l141.9-112a8 8 0 000-12.6z"></path></svg>
      </Button>
    </template>

    <RegistryComponent pageCode="relogin" code="relogin">
      <div class="relogin" key='relogin'>
        <div class="left">
          <div class="left-box">
            <div>
              <img :width="280" :src="Relogin" />
            </div>
            <div class="left-title">{{ $t('relogin.419974-1') }}</div>
            <div class="left-desc">{{ $t('relogin.419974-2') }}</div>
          </div>
        </div>
        <div class="right">
          <Right
            :logo="systemInfo?.front?.logo"
            :title="layout?.title"
            :bindings="[]"
            v-model:loading="loading"
            type="relogin"
            @submit="handleSuccess"
          />
        </div>
      </div>
    </RegistryComponent>
  </Modal>
</template>

<script setup>
import Right from "@jetlinks-web-core/views/login/right.vue";
import {useSystemStore} from "@jetlinks-web-core/store";
import {storeToRefs} from "pinia";
import { jumpLogin } from "@jetlinks-web-core/router";
import { clearVerifyCache } from "@jetlinks-web-core/package";
import i18n from "@jetlinks-web-core/locales";
import Relogin from '@jetlinks-web-core/assets/relogin.png'
import { Modal, Button } from 'ant-design-vue'
import { Language, Notice, Resource, User } from '@/layout/components'
import RegistryComponent from '@jetlinks-web-core/components/RegisterComponents'
import {isCloud} from "@/utils/consts";

const systemStore = useSystemStore();
const { systemInfo, layout } = storeToRefs(systemStore);
const loading = ref(false)
const $t = i18n.global.t

const visible = ref(false);
let resolvePromise = null;
const onCancel = () => {
  handleClose()
  clearVerifyCache()
  jumpLogin()
}
const handleClose = (result = null) => {
  visible.value = false;
  if (resolvePromise) {
    resolvePromise(result); // 传递登录结果
    resolvePromise = null;
  }
};
const open = () => {
  visible.value = true;
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
};

const handleSuccess = () => {
  handleClose(true);
};

defineExpose({ open })
</script>

<style lang="less">
.relogin-modal {
  .relogin-close {
    font-size: var(--fs-h3);
  }

  .ant-modal-content {
    padding: 0;

    .ant-modal-close {
      width: 3.5rem;
      height: 3.5rem;
      top: 0;
      right: 0;
    }
  }
}</style>

<style lang="less" scoped>
.relogin {
  display: flex;
  height: 40.625rem;
  align-items: center;
}

.left {
  height: 100%;
  background-color: var(--jet-theme-primary-soft);
  display: flex;
  justify-content: center;
  width: 29.125rem;

  .left-box {
    display: flex;
    flex-direction: column;
    text-align: center;
    justify-content: center;
    gap: var(--space-4);
  }

  .left-title {
    font-size: var(--fs-h4);
    color: var(--jet-theme-text-title);
  }

  .left-desc {
    font-size: var(--fs-meta);
    color: var(--jet-theme-text-secondary);
  }
}

.right {
  padding: var(--space-6);
  flex: 1;
  min-width: 0;
}</style>
