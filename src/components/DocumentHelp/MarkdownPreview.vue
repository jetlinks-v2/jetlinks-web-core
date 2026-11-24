<template>
  <article class="document-help-article">
    <div class="document-help-article__heading">
      <span class="document-help-article__icon" aria-hidden="true"><AIcon type="ReadOutlined" /></span>
      <strong class="document-help-article__fallback">{{ t('components.DocumentHelp.help') }}</strong>
      <a-button v-if="close" class="document-help-article__close" type="text" size="small"
        :aria-label="t('components.DocumentHelp.close')" @click.stop="close()">
        <AIcon type="CloseOutlined" aria-hidden="true" />
      </a-button>
    </div>
    <MdPreview :model-value="content" :sanitize="sanitizeHelpMarkdown" :language="language" />
  </article>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { closeDocumentHelpKey } from '@jetlinks-web-core/hooks/useDocumentHelp'
import { sanitizeHelpMarkdown } from '@jetlinks-web-core/utils/documentHelpMarkdown'

defineProps<{ content: string }>()
const { t, locale } = useI18n()
const close = inject(closeDocumentHelpKey, undefined)
const language = computed(() => locale.value.startsWith('zh') ? 'zh-CN' : 'en-US')
</script>

<style lang="less">
// The preview library inserts sanitized HTML without Vue scope attributes.
.document-help-article {
  --help-tint: color-mix(in srgb, var(--jet-theme-primary) 8%, var(--jet-theme-bg-container));
  --help-inset: var(--space-5);
  position: relative;
  padding: var(--help-inset);
  color: var(--jet-theme-text);
  font-family: var(--jet-theme-font-family, inherit);
  font-size: var(--fs-14);
  line-height: 1.65;

  &__heading {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-block-end: var(--space-3);
  }
  &__icon, &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--space-7);
    height: var(--space-7);
    border-radius: var(--r-2);
  }
  &__icon {
    background: var(--help-tint);
    color: var(--jet-theme-primary);
    font-size: var(--fs-16);
  }
  &__fallback {
    flex: 1;
    font-size: var(--fs-h4);
    line-height: var(--space-7);
    color: var(--jet-theme-text-title);
  }
  &__close {
    margin-inline-start: auto;
    padding: 0;
    color: var(--jet-theme-text-secondary);
    pointer-events: auto;
  }
  &__close:focus-visible, a:focus-visible {
    outline: 2px solid var(--jet-theme-primary);
    outline-offset: 1px;
  }

  .md-editor { background: transparent; color: inherit; font-family: inherit; }
  .md-editor-preview-wrapper { padding: 0; }
  .md-editor-preview {
    font: inherit;
    color: var(--jet-theme-text-secondary);
    overflow-wrap: anywhere;
    > :first-child { margin-block-start: 0; }
    > :last-child { margin-block-end: 0; }
    p { margin: var(--space-2) 0; line-height: inherit; }
    :is(h1, h2, h3, h4, h5, h6) {
      margin: var(--space-4) 0 var(--space-2);
      padding: 0;
      border: 0;
      color: var(--jet-theme-text-title);
      font-size: var(--fs-16);
      line-height: 1.5;
    }
    strong { color: var(--jet-theme-text-title); }
    ul, ol { margin: var(--space-2) 0; padding-inline-start: var(--space-6); }
    li { margin-block: var(--space-1); line-height: inherit; }
    th, td { font-size: inherit; }
    a { color: var(--jet-theme-primary); }
    a:hover { color: var(--jet-theme-primary-hover); text-decoration: underline; }
    blockquote, .document-help-guide__note, .document-help-guide__example {
      margin: var(--space-4) 0 0;
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--r-2);
      background: var(--help-tint);
      color: var(--jet-theme-text);
      font-size: var(--fs-13);
      p { margin: 0; }
    }
    .document-help-guide__note {
      position: relative;
      padding-inline-start: calc(var(--space-3) + var(--space-4) + var(--space-2));
      font-size: var(--fs-12);
      text-wrap: pretty;
      &::before {
        content: 'i' / '';
        position: absolute;
        inset: calc(var(--space-2) + .2em) auto auto var(--space-3);
        width: var(--space-4);
        border-radius: var(--r-pill);
        background: var(--jet-theme-primary);
        color: var(--jet-theme-bg-container);
        font: 600 var(--fs-12)/var(--space-4) system-ui, sans-serif;
        text-align: center;
      }
    }
  }

  // Place the author's first title between the icon and the close button.
  @title: ~":is(.md-editor-preview > :is(h1, h2, h3, h4, h5, h6):first-child, .md-editor-preview > .document-help-guide:first-child > header:first-child)";
  &:has(@{title}) &__heading {
    position: absolute;
    z-index: 1;
    inset: var(--help-inset) var(--help-inset) auto;
    margin: 0;
    pointer-events: none;
  }
  &:has(@{title}) &__fallback { display: none; }
  @{title} {
    box-sizing: border-box;
    min-height: var(--space-7);
    margin: 0 0 var(--space-2);
    padding-inline: calc(var(--space-7) + var(--space-2));
    color: var(--jet-theme-text-title);
    font-size: var(--fs-h4);
    font-weight: 600;
    line-height: var(--space-7);
  }

  .document-help-guide {
    header small { margin-inline-start: var(--space-2); color: var(--jet-theme-text-secondary); font-weight: normal; }
    > :last-child { margin-block-end: 0; }
  }
  :is(.document-help-guide, .md-editor-preview) {
    > ol {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      padding: 0;
      list-style: none;
    }
    > ol > li {
      display: list-item;
      position: relative;
      max-width: 100%;
      margin: 0;
      padding-inline-start: calc(var(--space-5) + var(--space-2));
    }
    > ol > li::before {
      content: counter(list-item);
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: .15em;
      width: var(--space-5);
      text-align: center;
      border-radius: var(--r-pill);
      background: var(--help-tint);
      color: var(--jet-theme-primary);
      font-size: var(--fs-12);
      font-weight: 600;
      line-height: var(--space-5);
    }
    > ol:has(li span, li p, li ul, li ol) { flex-direction: column; }
  }
  .document-help-guide {
    ol > li span { display: block; color: var(--jet-theme-text-secondary); }
    a.document-help-guide__link {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-block-start: var(--space-4);
      padding-block-start: var(--space-3);
      border-block-start: 1px solid var(--jet-theme-border-secondary);
      font-weight: 500;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  }
}
</style>
