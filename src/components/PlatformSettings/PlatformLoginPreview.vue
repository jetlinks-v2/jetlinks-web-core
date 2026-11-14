<template>
  <div ref="viewport" class="preview-login" :style="{ height: `${width * previewSize.height / previewSize.width}px` }">
    <LoginPageLayout preview class="preview-login__canvas" :style="canvasStyle">
      <template #brand>
        <a-button type="text" class="preview-logo" :class="mark('logo')" :aria-label="t('PlatformSettings.logo')" @click="emit('locate', 'logo')">
          <img :src="assets.logo" alt="" class="login-brand__logo" />
        </a-button>
        <a-button type="text" class="login-brand__title preview-title" :class="mark('title')" @click="emit('locate', 'title')">{{ model.title || t('PlatformSettings.defaultName') }}</a-button>
      </template>
      <template #actions><div inert><LoginHeaderActions /></div></template>
      <section class="login-workspace" inert>
        <LoginPanelHeader :title="t('Login.passwordTitle')" :description="hidden.includes('background') ? t('Login.passwordDescription') : ''" :back-text="t('Login.backDefault')" />
        <div class="login-panel-body"><PasswordLogin /></div>
      </section>
      <template v-if="!hidden.includes('showRecordNumber') && model.showRecordNumber && model.recordNumber" #record>
        <a-button type="text" class="login-record preview-record" :class="mark('recordNumber')" @click="emit('locate', 'recordNumber')">{{ t('login.index.102238-0') }}{{ model.recordNumber }}</a-button>
      </template>
      <template v-if="!hidden.includes('background')" #scene>
        <a-button class="preview-background" :class="mark('background')" type="text" :aria-label="t('PlatformSettings.background')" @click="emit('locate', 'background')" />
      </template>
    </LoginPageLayout>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import LoginPageLayout from '../../views/login/components/LoginPageLayout.vue'
import LoginPanelHeader from '../../views/login/components/LoginPanelHeader.vue'
import LoginHeaderActions from '../../views/login/components/LoginHeaderActions.vue'
import PasswordLogin from '../../views/login/components/PasswordLogin.vue'
import { resolveLoginBackground } from '@jetlinks-web-core/utils/login-background'
import type { PlatformSettingKey, PlatformSettingsAssets, PlatformSettingsModel } from './types'

const props = defineProps<{ model: PlatformSettingsModel; assets: PlatformSettingsAssets; hidden: readonly string[]; active?: string }>()
const emit = defineEmits<{ locate: [key: PlatformSettingKey] }>()
const { t } = useI18n()
const previewSize = computed(() => ({ width: 1440, height: props.hidden.includes('background') ? 600 : 900 }))
const viewport = ref<HTMLElement>()
const { width } = useElementSize(viewport)
const mark = (key: string) => ({ 'preview-active': props.active === key })
const canvasStyle = computed(() => {
  const background = resolveLoginBackground(props.hidden.includes('background') ? '' : props.model.background)
  return {
    // Keep the login page's proportions when the settings card becomes narrower.
    '--login-viewport-width': `${previewSize.value.width}px`, '--login-viewport-height': `${previewSize.value.height}px`,
    ...background.style,
    transform: `scale(${width.value / previewSize.value.width})`,
  }
})
</script>
<style scoped lang="less" src="../../views/login/components/Login.less"></style>
<style scoped>
.preview-login { position: relative; width: 100%; overflow: hidden; }
.preview-login__canvas { position: absolute; inset: 0 auto auto 0; transform-origin: top left; }
.preview-logo.ant-btn, .preview-title.ant-btn { display: inline-flex; align-items: center; height: auto; padding: 0; border: 0; border-radius: 0; }
.preview-logo { flex: none; }
.preview-title.ant-btn { display: block; text-align: left; }
.preview-record.ant-btn { height: auto; padding: 0; border: 0; border-radius: 0; line-height: inherit; }
.preview-login :deep(.login-scene) { position: relative; }
.preview-background.ant-btn { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 0; }
.preview-background.ant-btn:hover { background: transparent; }
.preview-active { outline: 0.375rem solid var(--jet-theme-primary); outline-offset: -0.375rem; }
/* The miniature always represents the desktop login page, including on a narrow settings screen. */
@media (max-width: 48rem) {
  .preview-login :deep(.login-panel-header) { margin-bottom: var(--space-12); }
  .preview-login :deep(.login-panel-header h2) { font-size: var(--fs-32); line-height: 2.75rem; }
  .preview-login :deep(.form-actions) { margin-bottom: 0.125rem; }
  .login-panel-body { min-height: 15.875rem; }
}
</style>
