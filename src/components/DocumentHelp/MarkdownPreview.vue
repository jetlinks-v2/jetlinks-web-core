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
.document-help-markdown :deep(.document-help-guide) {
  color: var(--jet-theme-text);
  line-height: 1.6;
}
.document-help-markdown :deep(.document-help-guide header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.document-help-markdown :deep(.document-help-guide header strong) { font-size: var(--fs-16, 16px); }
.document-help-markdown :deep(.document-help-guide header small) { color: var(--jet-theme-text-tertiary); }
.document-help-markdown :deep(.document-help-guide p) { margin: var(--space-2) 0; color: var(--jet-theme-text-secondary); }
.document-help-markdown :deep(.document-help-guide__example) {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--r-2);
  background: color-mix(in srgb, var(--jet-theme-primary) 7%, var(--jet-theme-bg-container));
  color: var(--jet-theme-primary);
  font-weight: 500;
  text-align: center;
}
.document-help-markdown :deep(.document-help-guide ol) {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-3) 0;
  padding: 0;
  list-style: none;
  counter-reset: help-step;
}
.document-help-markdown :deep(.document-help-guide li) {
  display: grid;
  grid-template-columns: var(--space-6) minmax(0, 1fr);
  gap: var(--space-2);
  margin: 0;
  counter-increment: help-step;
}
.document-help-markdown :deep(.document-help-guide li::before) {
  content: counter(help-step);
  display: grid;
  place-items: center;
  height: var(--space-6);
  border-radius: 50%;
  background: color-mix(in srgb, var(--jet-theme-primary) 9%, var(--jet-theme-bg-container));
  color: var(--jet-theme-primary);
  font-weight: 600;
}
.document-help-markdown :deep(.document-help-guide li strong),
.document-help-markdown :deep(.document-help-guide li span) { display: block; }
.document-help-markdown :deep(.document-help-guide li span) { color: var(--jet-theme-text-secondary); }
.document-help-markdown :deep(.document-help-guide__note) { font-size: var(--fs-12, 12px); }
.document-help-markdown :deep(a.document-help-guide__link) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--jet-theme-border-secondary);
  border-radius: var(--r-2);
  font-weight: 500;
  text-decoration: none;
}
.document-help-markdown :deep(a.document-help-guide__link:hover),
.document-help-markdown :deep(a.document-help-guide__link:focus-visible) {
  border-color: var(--jet-theme-primary);
  background: color-mix(in srgb, var(--jet-theme-primary) 5%, var(--jet-theme-bg-container));
}
</style>
