<template>
  <a-modal
      :open="true"
      :title="$t(regenerated ? 'PersonalToken.prototype.regeneratedTitle' : 'PersonalToken.prototype.createdTitle')"
      :width="520"
      centered
      :mask-closable="false"
      :closable="true"
      @cancel="handleClose"
  >
    <div class="token-success">
      <a-alert type="warning" show-icon :message="$t('PersonalToken.prototype.secretWarning')" />
      <div class="token-success__credential">
        <p class="token-success__label">{{ $t('PersonalToken.prototype.namedToken', { name }) }}</p>
        <div class="token-success__value-row">
          <a-typography-text class="token-success__value">{{ token }}</a-typography-text>
          <a-button size="small" class="token-success__copy" @click="copyToken">
            {{ $t('PersonalToken.TokenDialog.168178-6') }}
          </a-button>
        </div>
      </div>
    </div>
    <template #footer>
      <a-button type="primary" @click="handleClose">{{ $t('PersonalToken.prototype.saved') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import i18n from '@jetlinks-web-core/locales'

import {onlyMessage} from "@jetlinks-web/utils";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  token: {
    type: String,
    default: ''
  },
  name: { type: String, default: '' },
  regenerated: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

async function copy(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
  onlyMessage(i18n.global.t('PersonalToken.Success.965370-4'))
}


const copyToken = () => {
  void copy(props.token).catch(() => onlyMessage(i18n.global.t('PersonalToken.Success.965370-5'), 'error'))
}

const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.token-success { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.token-success__label { margin: 0 0 var(--space-2); color: var(--text-color-secondary); font-size: var(--fs-13); line-height: 20px; }
.token-success__value-row { display: flex; align-items: flex-start; gap: var(--space-3); min-width: 0; padding: var(--space-3); background: var(--bg-hover); border: 1px solid var(--line); border-radius: var(--r-2); }
.token-success__value { flex: 1; min-width: 0; font-family: var(--font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: var(--fs-13); line-height: 24px; overflow-wrap: anywhere; user-select: all; }
.token-success__copy { flex: none; }
</style>
