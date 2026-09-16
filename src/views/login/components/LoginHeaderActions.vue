<template>
  <div class="login-header-actions">
    <a-popover
      v-model:open="languageOpen"
      placement="bottomRight"
      trigger="click"
      overlay-class-name="login-language-popover-overlay"
    >
      <a-button
        class="login-header-actions__language"
        type="text"
        :aria-label="t('Login.language')"
      >
        <template #icon>
          <AIcon type="GlobalOutlined" />
        </template>
        <span>{{ currentLanguageLabel }}</span>
      </a-button>

      <template #content>
        <div class="login-language-menu">
          <button
            v-for="item in languageOptions"
            :key="item.value"
            type="button"
            class="login-language-menu__item"
            :class="{ 'login-language-menu__item--active': currentLanguage === item.value }"
            @click="changeLanguage(item.value)"
          >
            <span>{{ item.label }}</span>
            <AIcon
              v-if="currentLanguage === item.value"
              type="CheckOutlined"
              class="login-language-menu__check"
            />
          </button>
        </div>
      </template>
    </a-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LocalStore } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import { useSystemStore } from '@jetlinks-web-core/store'
import { langKey, ruleEditorKey } from '@jetlinks-web-core/utils/consts'

type LoginLanguage = 'zh' | 'en'

type LanguageOption = {
  label: string
  value: LoginLanguage
}

const systemStore = useSystemStore()
const t = i18n.global.t
const languageOpen = ref(false)

const normalizeLanguage = (language?: string): LoginLanguage => (language === 'en' ? 'en' : 'zh')

const currentLanguage = computed(() => normalizeLanguage(systemStore.language))

const languageOptions = computed<LanguageOption[]>(() => [
  {
    label: t('Login.languageZh'),
    value: 'zh'
  },
  {
    label: t('Login.languageEn'),
    value: 'en'
  }
])

const currentLanguageLabel = computed(() => (
  languageOptions.value.find(item => item.value === currentLanguage.value)?.label || t('Login.languageZh')
))

const changeLanguage = (language: LoginLanguage) => {
  if (language === currentLanguage.value) {
    languageOpen.value = false
    return
  }

  systemStore.language = language
  LocalStore.set(langKey, language)
  LocalStore.set(ruleEditorKey, language)
  languageOpen.value = false
  window.location.reload()
}
</script>

<style scoped lang="less">
.login-header-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;

  &__language {
    min-width: 4.75rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    color: var(--jet-theme-text-secondary);
    border-radius: var(--r-2);
    font-size: var(--fs-14);
    line-height: 1;
    transition: background 0.16s ease, color 0.16s ease;

    &:hover {
      background: var(--jet-theme-border-secondary);
      color: var(--jet-theme-text);
    }
  }

  :deep(.header-theme-switch) {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: var(--r-2);
  }
}

.login-language-menu {
  width: 8rem;
  padding: var(--space-1);

  &__item {
    width: 100%;
    min-height: 2.125rem;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    color: var(--jet-theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease;

    &:hover,
    &--active {
      background: var(--jet-theme-border-secondary);
    }

    span {
      min-width: 0;
      flex: 1;
      font-size: var(--fs-14);
      line-height: 1.25rem;
    }
  }

  &__check {
    color: var(--jet-theme-primary);
  }
}
</style>

<style lang="less">
.login-language-popover-overlay {
  .ant-popover-inner {
    padding: var(--space-1);
    border-radius: var(--r-3);
  }
}
</style>
