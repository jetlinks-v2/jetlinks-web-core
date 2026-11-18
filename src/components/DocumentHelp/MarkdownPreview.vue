<template>
  <MdPreview :model-value="content" :sanitize="sanitizeHelpMarkdown" :language="language" class="document-help-markdown" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { sanitizeHelpMarkdown } from '@jetlinks-web-core/utils/documentHelpMarkdown'

defineProps<{ content: string }>()
const { locale } = useI18n()
const language = computed(() => locale.value.startsWith('zh') ? 'zh-CN' : 'en-US')
</script>

<style scoped>
.document-help-markdown { background: transparent; }
.document-help-markdown :deep(.md-editor-preview-wrapper) { padding: 0; }
.document-help-markdown :deep(.md-editor-preview),
.document-help-markdown :deep(table th),
.document-help-markdown :deep(table td) { font-size: var(--fs-14, 14px); }
.document-help-markdown :deep(a) { color: var(--jet-theme-primary); }
.document-help-markdown :deep(a:hover) { color: var(--jet-theme-primary-hover); }
</style>
