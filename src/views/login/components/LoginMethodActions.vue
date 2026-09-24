<template>
  <div v-if="methods.length" class="login-method-actions">
    <div class="method-title">{{ title }}</div>
    <div class="method-list">
      <button
        v-for="method in visibleMethods"
        :key="method.key"
        type="button"
        class="method-button"
        :title="method.label"
        :aria-label="method.label"
        @click="$emit('change', method.key)"
      >
        <span class="method-icon">
          <img :src="method.image" alt="" />
        </span>
        <span class="method-label">{{ method.label }}</span>
      </button>
      <Popover v-if="remainingMethods.length" v-model:open="moreOpen" trigger="click" placement="bottomRight">
        <button type="button" class="method-button more-button" :title="moreLabel" :aria-label="moreLabel" :aria-expanded="moreOpen">
          <span class="method-icon"><AIcon type="MoreOutlined" /></span>
          <span class="method-label">{{ moreLabel }}</span>
        </button>
        <template #content>
          <div
            class="more-method-list"
            :class="{ 'more-method-list--grid': remainingMethods.length > 4 }"
            :aria-label="moreLabel"
          >
            <button v-for="method in remainingMethods" :key="method.key" type="button" class="more-method-item" @click="selectMore(method.key)">
              <img :src="method.image" alt="" />
              <span>{{ method.label }}</span>
            </button>
          </div>
        </template>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Popover } from 'ant-design-vue'

const props = defineProps<{
  title: string
  moreLabel: string
  methods: Array<{
    key: string
    label: string
    image: string
  }>
}>()

const emit = defineEmits<{
  (e: 'change', key: string): void
}>()

const moreOpen = ref(false)
// 前五项直接展示，其余从“更多”中选择。
const visibleMethods = computed(() => props.methods.slice(0, 5))
const remainingMethods = computed(() => props.methods.slice(visibleMethods.value.length))

const selectMore = (key: string) => {
  moreOpen.value = false
  emit('change', key)
}
</script>

<style scoped lang="less">
.login-method-actions {
  margin-top: var(--space-section);
}

.method-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 0.0625rem;
    background: var(--jet-theme-border-secondary);
  }
}

.method-list {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-1);
  margin-top: var(--space-6);
}

.method-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 3.5rem;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  cursor: pointer;
  line-height: 1.25rem;
  transition: color 0.2s ease;

  &:hover,
  &:focus-visible {
    color: var(--jet-theme-primary);
  }

  &:focus-visible {
    outline: 0.125rem solid var(--jet-theme-primary);
    outline-offset: 0.125rem;
    border-radius: var(--r-2);
  }
}

.method-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--jet-theme-bg-container);

  img {
    display: block;
    width: 2.125rem;
    height: 2.125rem;
    object-fit: contain;
  }
}

.method-label {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-button .method-icon {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-20);
}

.more-method-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 12rem;
  max-width: calc(100vw - 2rem);
  max-height: min(18rem, 50vh);
  overflow-y: auto;

  &--grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: min(24rem, calc(100vw - 2rem));
  }
}

.more-method-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: var(--r-2);
  background: transparent;
  color: var(--jet-theme-text);
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--jet-theme-border-secondary);
  }

  img {
    width: 2rem;
    height: 2rem;
    flex: none;
    object-fit: contain;
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 48rem) {
  .method-button {
    min-height: 2rem;
  }
}

@media (max-width: 25rem) {
  .method-button {
    width: 3rem;
  }

  .method-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
