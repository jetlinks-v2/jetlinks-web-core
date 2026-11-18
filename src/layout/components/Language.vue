<template>
  <a-dropdown
    placement="bottomRight"
    :trigger="['click']"
  >
    <div
      class="language-switch"
    >
      <AIcon type="GlobalOutlined" />
      <span>{{ systemStore.languageLabel }}</span>
    </div>

    <template #overlay>
      <a-menu
        class="language-switch__menu"
        :selectable="false"
        @click="handleChangeLanguage"
      >
        <a-menu-item
          v-for="item in systemStore.languageOptions"
          :key="item.value"
        >
          {{ item.label }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { useSystemStore } from '@jetlinks-web-core/store/system'

const systemStore = useSystemStore()
const handleChangeLanguage = ({ key }: { key: string | number }) => systemStore.selectLanguage(key)
</script>

<style scoped lang="less">
.language-switch {
  height: 2rem;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border-radius: var(--r-2);
  color: var(--ink-1);
  font-size: var(--fs-14);
  line-height: 1;
  transition: background 0.16s ease, color 0.16s ease;
    cursor: pointer;


  &__arrow {
    color: var(--ink-1);
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
