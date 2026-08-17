<template>
  <section class="third-account">
    <h3 class="section-title">{{ $t('AccountInfo.thirdSection') }}</h3>
    <p class="section-desc">{{ $t('AccountInfo.thirdSectionDesc') }}</p>

    <a-spin :spinning="loading">
      <a-alert
        v-if="loadFailed"
        type="error"
        show-icon
        :message="$t('BindThirdAccount.loadingFailed')"
      >
        <template #action>
          <a-button size="small" @click="loadAccounts">
            {{ $t('BindThirdAccount.retry') }}
          </a-button>
        </template>
      </a-alert>

      <div v-else-if="accounts.length" class="account-list">
        <div v-for="item in accounts" :key="item.id" class="account-item">
          <div class="account-summary">
            <img :src="item.logoUrl || providerIcons[item.provider]" class="account-icon" alt="" />
            <div class="account-content">
              <div class="account-name">{{ item.name }}</div>
              <div class="account-meta">
                <a-tag :color="item.bound ? 'success' : 'default'">
                  {{ item.bound
                    ? $t('BindThirdAccount.index.483756-0')
                    : $t('BindThirdAccount.index.483756-1') }}
                </a-tag>
                <span v-if="item.bound && item.others?.name" class="bound-user">
                  {{ item.others.name }}{{ $t('BindThirdAccount.index.483756-2') }}
                </span>
              </div>
            </div>
          </div>

          <a-popconfirm
            v-if="item.bound"
            :title="$t('BindThirdAccount.index.483756-3')"
            @confirm="unbind(item.id)"
          >
            <a-button :loading="unbindingId === item.id">
              {{ $t('BindThirdAccount.index.483756-4') }}
            </a-button>
          </a-popconfirm>
          <a-button v-else type="primary" ghost @click="bind(item.id)">
            {{ $t('BindThirdAccount.index.483756-5') }}
          </a-button>
        </div>
      </div>

      <a-empty v-else-if="!loading" :description="$t('BindThirdAccount.empty')" />
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import { getSsoBinds_api, unBind_api } from '@jetlinks-web-core/api/account/center'
import { DingTalk, WeixinCorp } from '@jetlinks-web-core/assets/notice'
import { InternalStandalone, ThirdParty } from '@jetlinks-web-core/assets/apply'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'

interface ThirdAccount {
  id: string
  name: string
  provider: string
  bound: boolean
  logoUrl?: string
  features?: string[]
  others?: {
    name?: string
  }
}

const { t: $t } = useI18n()
const accounts = ref<ThirdAccount[]>([])
const loading = ref(false)
const loadFailed = ref(false)
const unbindingId = ref('')
let popupTimer: ReturnType<typeof setInterval> | undefined

const providerIcons: Record<string, string> = {
  'dingtalk-ent-app': DingTalk,
  'wechat-webapp': WeixinCorp,
  'internal-standalone': InternalStandalone,
  'third-party': ThirdParty,
}

const loadAccounts = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    const response = await getSsoBinds_api()
    const result = response?.result ?? response
    accounts.value = Array.isArray(result)
      ? result.filter((item: ThirdAccount) => !item.features?.includes('ssoUnsupportedRedirect'))
      : []
  } catch {
    accounts.value = []
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

const unbind = async (id: string) => {
  unbindingId.value = id
  try {
    const response = await unBind_api(id)
    if (response?.status === 200 || response?.success) {
      onlyMessage($t('BindThirdAccount.index.483756-6'), 'success')
      await loadAccounts()
    }
  } finally {
    unbindingId.value = ''
  }
}

const bind = (id: string) => {
  const baseApi = import.meta.env.VITE_APP_BASE_API || '/api'
  const popup = window.open(`${baseApi}/application/sso/${id}/login?autoCreateUser=false`)
  if (!popup) {
    onlyMessage($t('BindThirdAccount.popupBlocked'), 'warning')
    return
  }

  if (popupTimer) clearInterval(popupTimer)
  // Refresh only after the OAuth window closes so the row reflects the final binding state.
  popupTimer = setInterval(() => {
    if (popup.closed) {
      clearInterval(popupTimer)
      popupTimer = undefined
      loadAccounts()
    }
  }, 500)
}

onMounted(loadAccounts)

onUnmounted(() => {
  if (popupTimer) clearInterval(popupTimer)
})
</script>

<style scoped lang="less">
.third-account {
  .section-title {
    margin: 0;
    color: var(--jet-theme-text);
    font-size: var(--fs-16);
    font-weight: 600;
  }

  .section-desc {
    margin: var(--space-1) 0 var(--space-4);
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-13);
  }

  .account-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .account-item {
    display: flex;
    min-height: 4.5rem;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--jet-theme-border-secondary);
    border-radius: var(--r-2);
    background: var(--jet-theme-bg-container);
    box-shadow: var(--jet-theme-shadow-secondary);
  }

  .account-summary,
  .account-meta {
    display: flex;
    align-items: center;
  }

  .account-summary {
    min-width: 0;
    gap: var(--space-3);
  }

  .account-icon {
    width: 2rem;
    height: 2rem;
    flex: none;
    border-radius: var(--r-1);
    object-fit: contain;
  }

  .account-content {
    min-width: 0;
  }

  .account-name {
    overflow: hidden;
    color: var(--jet-theme-text);
    font-size: var(--fs-14);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-meta {
    min-height: 1.5rem;
    margin-top: var(--space-1);
    gap: var(--space-2);
  }

  .bound-user {
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-13);
  }
}

@media (max-width: 768px) {
  .third-account .account-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
