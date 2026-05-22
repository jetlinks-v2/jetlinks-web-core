<template>
  <a-tooltip :title="$t('components.HeaderThemeSwitch.title')">
    <a-popover
      v-model:open="open"
      placement="bottomRight"
      trigger="click"
      overlay-class-name="header-theme-switch-overlay"
    >
      <a-button
        class="header-theme-switch"
        type="text"
        :aria-label="$t('components.HeaderThemeSwitch.title')"
      >
        <template #icon>
          <AIcon type="SkinOutlined" />
        </template>
      </a-button>
      <template #content>
        <div class="header-theme-switch-menu">
          <button
            v-for="item in themeOptions"
            :key="item.value"
            class="header-theme-switch-menu__item"
            :class="{ 'header-theme-switch-menu__item--active': themeMode === item.value }"
            type="button"
            :disabled="saving"
            @click="setThemeMode(item.value)"
          >
            <span class="header-theme-switch-menu__text">
              <span>{{ item.label }}</span>
            </span>
            <AIcon
              v-if="themeMode === item.value"
              type="CheckOutlined"
              class="header-theme-switch-menu__check"
            />
          </button>
        </div>
      </template>
    </a-popover>
  </a-tooltip>
</template>

<script setup lang="ts" name="HeaderThemeSwitch">
import { storeToRefs } from 'pinia'
import { useHeaderTheme } from '@jetlinks-web-core/hooks'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { saveThemeStyle_api } from '@jetlinks-web-core/api/account/center'
import type { ThemeStyleKey } from '@jetlinks-web-core/utils'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'

type ThemeMode = ThemeStyleKey

const systemStore = useSystemStore()
const { themeStyle } = storeToRefs(systemStore)
const { headerThemeAreas, applyHeaderTheme } = useHeaderTheme()
const { t: $t } = useI18n()

const open = ref(false)
const saving = ref(false)
const themeMode = ref<ThemeMode>(themeStyle.value)

const themeIconMap: Partial<Record<ThemeMode, string>> = {
  light: 'SunOutlined',
  dark: 'MoonOutlined'
}

const themeOptions = computed(() => headerThemeAreas.map(item => ({
  ...item,
  value: item.value as ThemeMode,
  icon: themeIconMap[item.value as ThemeMode] || 'SkinOutlined'
})))

const setThemeMode = async (mode: ThemeMode) => {
  if (saving.value || mode === themeMode.value) {
    open.value = false
    return
  }

  const previousThemeMode = themeMode.value
  saving.value = true
  try {
    themeMode.value = applyHeaderTheme(mode)
    const resp = await saveThemeStyle_api({
      name: 'style',
      content: mode
    })
    if (resp?.success === false) {
      throw new Error('save theme style failed')
    }
    open.value = false
  } catch {
    themeMode.value = applyHeaderTheme(previousThemeMode)
  } finally {
    saving.value = false
  }
}

watch(themeStyle, (value) => {
  themeMode.value = value
})
</script>

<style scoped lang="less">
.header-theme-switch {
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  color: var(--jet-theme-text-secondary);
  border-radius: var(--r-2);
  cursor: pointer;
  padding: 0 0.5rem;
  transition: background 0.16s ease, color 0.16s ease;

  &:hover {
    background: var(--jet-theme-border-secondary);
    color: var(--jet-theme-text);
  }

  &__arrow {
    font-size: var(--fs-12);
  }
}

.header-theme-switch-menu {
  width: 120px;
  padding: var(--space-1);

  &__item {
    width: 100%;
    min-height: 2.125rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4375rem 0.5rem;
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    color: var(--jet-theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease;

      &:not(:last-child) {
          margin-bottom: var(--space-1);
      }

    &:hover,
    &--active {
      background: var(--jet-theme-border-secondary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  &__text {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--fs-13);
    line-height: 1.25rem;
  }

  &__check {
    color: var(--jet-theme-primary);
  }
}
</style>

<style lang="less">
.header-theme-switch-overlay {
  .ant-popover-inner {
    padding: var(--space-1);
    border-radius: var(--r-3);
  }
}
</style>
