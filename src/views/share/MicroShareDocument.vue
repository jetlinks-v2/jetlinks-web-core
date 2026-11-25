<template>
  <section class="micro-share-document">
    <a :href="href" target="_blank" rel="noopener noreferrer">{{ t('share.openDocument') }}</a>
    <iframe v-if="sameOrigin" :src="href" :title="t('share.documentTitle')" referrerpolicy="no-referrer" allowfullscreen />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ path: string }>()
const { t } = useI18n()
// micro-app 的虚拟 location 指向子应用。原生文档独占作品的 WebSocket 和系统配置。
const href = computed(() => {
  const url = new URL(window.location.href)
  url.hash = props.path
  return url.href
})
const host = (window as Window & { rawWindow?: Window }).rawWindow
// 部署默认使用 SAMEORIGIN；跨域基座通过独立标签页访问。
const sameOrigin = computed(() => host?.location.origin === new URL(href.value).origin)
</script>

<style scoped>
.micro-share-document { display: flex; flex-direction: column; height: 100vh; }
.micro-share-document a { align-self: flex-end; margin: 8px; }
.micro-share-document iframe { flex: 1; width: 100%; min-height: 0; border: 0; }
</style>
