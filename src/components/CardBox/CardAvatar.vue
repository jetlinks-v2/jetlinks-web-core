<template>
  <a-avatar
    class="card-avatar"
    :class="[`card-avatar--size-${size}`, `card-avatar--tone-${avatar.tone ?? 'info'}`]"
    :src="avatar.src"
    :alt="avatar.alt"
  >
    <AIcon v-if="avatar.icon" :type="avatar.icon" />
    <template v-else>{{ avatar.text }}</template>
  </a-avatar>
</template>

<script setup lang="ts" name="CardAvatar">
import type { PropType } from 'vue'
import type { CardAvatarData } from './types'

defineProps({
  avatar: {
    type: Object as PropType<CardAvatarData>,
    required: true,
  },
  size: {
    type: String as PropType<'default' | 'small'>,
    default: 'default',
  },
})
</script>

<style scoped>
.card-avatar {
  --card-avatar-color: var(--card-tone-info);
  --card-avatar-bg: var(--card-tone-info-soft);

  flex: none;
  border: var(--jet-theme-stroke-width) solid var(--line);
  background: var(--card-avatar-bg);
  color: var(--card-avatar-color);
  font-size: var(--fs-20);
  font-weight: 600;
}

.card-avatar--size-default {
  width: var(--card-shell-avatar-size);
  height: var(--card-shell-avatar-size);
  line-height: var(--card-shell-avatar-size);
}

.card-avatar--size-small {
  width: var(--card-shell-avatar-size-sm);
  height: var(--card-shell-avatar-size-sm);
  line-height: var(--card-shell-avatar-size-sm);
  font-size: var(--fs-16);
}

.card-avatar--tone-default {
  --card-avatar-color: var(--card-tone-default);
  --card-avatar-bg: var(--card-tone-default-soft);
}

.card-avatar--tone-info {
  --card-avatar-color: var(--card-tone-info);
  --card-avatar-bg: var(--card-tone-info-soft);
}

.card-avatar--tone-success {
  --card-avatar-color: var(--card-tone-success);
  --card-avatar-bg: var(--card-tone-success-soft);
}

.card-avatar--tone-warning {
  --card-avatar-color: var(--card-tone-warning);
  --card-avatar-bg: var(--card-tone-warning-soft);
}

.card-avatar--tone-error {
  --card-avatar-color: var(--card-tone-error);
  --card-avatar-bg: var(--card-tone-error-soft);
}
</style>
