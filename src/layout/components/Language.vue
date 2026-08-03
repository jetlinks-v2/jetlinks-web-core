<template>
  <a-dropdown
    placement="bottomRight"
    :trigger="['click']"
  >
    <a-button
      class="language-switch"
      type="text"
    >
      <AIcon type="GlobalOutlined" />
      <span>{{ currentLanguageLabel }}</span>
      <AIcon
        class="language-switch__arrow"
        type="DownOutlined"
      />
    </a-button>

    <template #overlay>
      <a-menu
        class="language-switch__menu"
        :selectable="false"
        @click="handleChangeLanguage"
      >
        <a-menu-item
          v-for="item in languageOptions"
          :key="item.value"
        >
          {{ item.label }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LocalStore } from '@jetlinks-web/utils'
import { useSystemStore } from '@jetlinks-web-core/store'
import { langKey, ruleEditorKey } from '@jetlinks-web-core/utils/consts'

type MenuClickEvent = {
  key: string | number
}

const systemStore = useSystemStore()

const languageOptions = [
  {
    label: '中文',
    value: 'zh'
  },
  {
    label: 'English',
    value: 'en'
  }
]

const currentLanguageLabel = computed(() => (
  languageOptions.find(item => item.value === systemStore.language)?.label || languageOptions[0].label
))

const handleChangeLanguage = ({ key }: MenuClickEvent) => {
  const option = languageOptions.find(item => item.value === String(key))
  if (!option || option.value === systemStore.language) return

  systemStore.language = option.value
  LocalStore.set(langKey, option.value)
  // 规则编辑器使用独立缓存，必须与全局语言保持同步。
  LocalStore.set(ruleEditorKey, option.value)
  window.location.reload()
}
</script>

<style scoped lang="less">
.language-switch {
  height: 2rem;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border-radius: var(--r-2);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1;
  transition: background 0.16s ease, color 0.16s ease;

  &:hover,
  &:focus-visible {
    background: var(--jet-theme-border-secondary);
    color: var(--jet-theme-text);
  }

  &__arrow {
    color: var(--jet-theme-text-tertiary, var(--jet-theme-text-secondary));
    font-size: var(--fs-12);
  }

  &__menu {
    min-width: 6rem;
    padding: var(--space-1);
    border-radius: var(--r-3);

    :deep(.ant-dropdown-menu-item) {
      min-height: 2rem;
      padding: var(--space-2) var(--space-3);
      font-size: var(--fs-14);
    }
  }
}
</style>
