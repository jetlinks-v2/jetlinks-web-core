<template>
  <a-popover
    v-model:open="open"
    placement="bottomRight"
    trigger="click"
    :overlay-inner-style="{ padding: 'var(--space-1)' }"
  >
    <a-button
      class="language-switch"
      type="text"
      translate="no"
      data-no-translate
      :aria-label="`${menuLabel}: ${currentLabel}`"
      :aria-expanded="open"
      @keydown.esc.stop="open = false"
    >
      <AIcon type="GlobalOutlined" />
      <span>{{ currentLabel }}</span>
    </a-button>

    <template #content>
      <div class="language-switch__menu" translate="no" data-no-translate @keydown.esc.stop="open = false">
        <div v-for="item in options" :key="item.value" class="language-switch__row">
          <a-button
            class="language-switch__option"
            type="text"
            :disabled="item.disabled"
            :aria-current="selected === item.value ? 'true' : undefined"
            @click.stop="select(item.value)"
          >
            <span>{{ item.label }}</span>
          </a-button>
          <a-tooltip v-if="item.model">
            <template #title><span data-no-translate>{{ item.model.label }}</span></template>
            <span class="language-switch__model" :role="item.model.enabled ? undefined : 'status'">
              <a-button
                class="language-switch__model-button"
                size="small"
                type="text"
                :aria-label="item.model.label"
                :disabled="!item.model.enabled"
                @click.stop="prepare(item.value)"
              >
                <span v-if="item.model.percent !== undefined">{{ item.model.percent }}%</span>
                <AIcon v-else :type="item.model.icon" aria-hidden="true" />
              </a-button>
            </span>
          </a-tooltip>
        </div>
      </div>
    </template>
  </a-popover>
</template>

<script setup lang="ts">
import { useRuntimeLanguageMenu } from '../hooks/useRuntimeLanguageMenu'

const { open, options, selected, currentLabel, menuLabel, select, prepare } = useRuntimeLanguageMenu()
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

  &__menu {
    min-width: 8rem;
    max-width: min(18rem, calc(100vw - 2rem));
  }

  &__row {
    min-height: 2rem;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  &__option {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 2rem;
    height: auto;
    align-items: center;
    padding-inline: var(--space-2);
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: start;

    &[aria-current="true"] {
      font-weight: 600;
    }
  }

  &__model {
    flex: none;
  }

  &__model-button {
    width: 2.5rem;
    padding-inline: 0;
    font-size: var(--fs-12);
    font-variant-numeric: tabular-nums;
  }
}
</style>
