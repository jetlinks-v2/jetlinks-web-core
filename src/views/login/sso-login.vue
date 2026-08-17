<template>
  <div v-if="bindings.length" class="other-login">
    <Divider plain>
      <span class="other-login-text">
        {{ $t('login.right.419974-7') }}
      </span>
    </Divider>
    <div class="other-login-actions">
      <Tooltip
        v-for="item in bindings"
        :key="item.id"
        :title="item.name"
      >
        <button
          type="button"
          class="sso-button"
          :aria-label="item.name"
          @click="emit('select', item)"
        >
          <img
            :alt="item.name"
            :src="resolveLogo(item)"
          />
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts" name="SsoLogin">
import type { PropType } from 'vue'
import { Divider, Tooltip } from 'ant-design-vue'
import { iconMap, type SsoBinding } from './util'
import defaultImg from '@jetlinks-web-core/assets/apply/internal-standalone.png'
import { resolvePersistedAssetUrl } from '@jetlinks-web-core/utils'

defineProps({
  bindings: {
    type: Array as PropType<SsoBinding[]>,
    default: () => []
  }
})

const emit = defineEmits<{
  select: [binding: SsoBinding]
}>()

const resolveLogo = (binding: SsoBinding) => {
  return resolvePersistedAssetUrl(
    binding.logoUrl,
    iconMap.get(binding.provider) || defaultImg,
  )
}
</script>

<style scoped lang="less">
.other-login {
  margin-top: -8px;

  :deep(.ant-divider) {
    margin: 20px 0 16px;
  }
}

.other-login-text {
  color: #86909C;
  font-size: 13px;
}

.other-login-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.sso-button {
  display: inline-flex;
  width: 40px;
  height: 40px;
  padding: 7px;
  align-items: center;
  justify-content: center;
  border: 1px solid #DDE0E8;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover,
  &:focus-visible {
    border-color: var(--ant-primary-color);
    background: #FFF;
    outline: none;
  }

  img {
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
}
</style>
