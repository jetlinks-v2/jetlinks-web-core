<template>
  <header ref="root" class='cloud-detail-header' :class="{ 'cloud-detail-header--summary': variant === 'summary', 'cloud-detail-header--compact': variant === 'summary' && compact, 'cloud-detail-header--identified': identified, 'cloud-detail-header--condensed': condensed, 'cloud-detail-header--visual': !!(slots.icon || slots.leading) }">
    <div class="cloud-detail-header__layout">
    <div v-if="variant === 'summary' && (slots.icon || slots.leading)" class="cloud-detail-header__visual">
    <div v-if="variant === 'summary' && slots.leading" class="cloud-detail-header__leading">
      <slot name="leading" />
    </div>
    <div v-if="variant === 'summary' && slots.icon" class="cloud-detail-header__icon">
      <slot name="icon" />
    </div>
    </div>
    <div class='cloud-detail-header__main'>
      <div class="cloud-detail-header__identity-line">
      <div class='cloud-detail-header__title-row'>
        <a-button
          v-if='showBack'
          type='text'
          class='cloud-detail-header__back'
          :title='displayBackTitle'
          @click='handleBack'
        >
          <AIcon type='LeftOutlined' />
        </a-button>

        <div class='cloud-detail-header__title-wrap'>
          <div class='cloud-detail-header__title-main'>
            <h1 class='cloud-detail-header__title' :class="{ 'cloud-detail-header__title--custom': !!slots.title }" :title="variant === 'summary' ? title : undefined">
              <slot name='title'>
                {{ title }}
              </slot>
            </h1>
            <a-tooltip v-if="resourceType" v-model:open="typeOpen" :title="resourceType.label" :trigger="['hover', 'focus', 'click']">
              <button type="button" class="cloud-detail-header__type" :aria-label="resourceType.label" @keydown.esc.stop.prevent="typeOpen = false"><AIcon :type="resourceType.icon" aria-hidden="true" /></button>
            </a-tooltip>
            <div v-if='slots.titleExtra' class='cloud-detail-header__title-extra'>
              <slot name='titleExtra' />
            </div>
            <div v-if="identified && slots.status" class="cloud-detail-header__status" @click.capture="factsOpen = false"><slot name="status" /></div>
          </div>
          <div v-if="slots.description && variant !== 'summary'" class='cloud-detail-header__description'>
            <slot name='description' />
          </div>
        </div>
      </div>

      <div v-if="identified && slots.observation" class="cloud-detail-header__observation" @click.capture="factsOpen = false"><slot name="observation" /></div>
      <div v-if="identified && slots.context" class="cloud-detail-header__context" @click.capture="factsOpen = false"><slot name="context" /></div>
      </div>
      <div v-if="identified" class="cloud-detail-header__secondary">
        <div class="cloud-detail-header__identifier"><slot name="identifier" /></div>
        <div class="cloud-detail-header__facts" @keydown.esc.stop.prevent="closeFacts">
          <button v-show="condensed" type="button" class="cloud-detail-header__facts-trigger" :aria-expanded="factsOpen" :aria-controls="factsId" :aria-label="metaLabel || $t('components.DetailHeader.moreInfo')" :title="metaLabel || $t('components.DetailHeader.moreInfo')" @click="factsOpen = !factsOpen"><span class="cloud-detail-header__facts-label">{{ metaLabel || $t('components.DetailHeader.moreInfo') }}</span><AIcon class="cloud-detail-header__facts-caret" :type="factsOpen ? 'UpOutlined' : 'DownOutlined'" aria-hidden="true" /><AIcon class="cloud-detail-header__facts-overflow" type="EllipsisOutlined" aria-hidden="true" /></button>
          <div v-show="!condensed || factsOpen" :id="factsId" class="cloud-detail-header__facts-panel">
            <div v-if="condensed || metaEditable" class="cloud-detail-header__facts-heading">
              <strong v-if="condensed">{{ metaTitle || metaLabel || $t('components.DetailHeader.moreInfo') }}</strong>
              <div class="cloud-detail-header__facts-actions">
                <a-button v-if="metaEditable" type="text" size="small" class="cloud-detail-header__facts-edit" :disabled="metaEditDisabled" :title="$t('components.DetailHeader.editInfo')" :aria-label="$t('components.DetailHeader.editInfo')" @click="editMeta"><AIcon type="EditOutlined" aria-hidden="true" /></a-button>
                <a-button v-if="condensed" type="text" size="small" :aria-label="$t('runtimeDiagnostics.closeDetails')" @click="closeFacts"><AIcon type="CloseOutlined" aria-hidden="true" /></a-button>
              </div>
            </div>
            <div class="cloud-detail-header__meta"><slot name="meta" :expanded="condensed" /></div>
            <div v-if="slots.auxiliary" class="cloud-detail-header__auxiliary"><slot name="auxiliary" :inline="condensed" /></div>
          </div>
        </div>
      </div>
      <div v-else-if="variant === 'summary' && compact" class="cloud-detail-header__secondary">
        <div v-if="slots.meta" class="cloud-detail-header__meta"><slot name="meta" :expanded="false" /></div>
        <a-popover v-if="slots.extra" trigger="click" placement="bottomRight">
          <template #content><div class="cloud-detail-header__extra-panel"><slot name="extra" /></div></template>
          <a-button type="text" size="small" class="cloud-detail-header__more-info" :aria-label="extraLabel || $t('components.DetailHeader.moreInfo')">
            <AIcon :type="extraKind ? detailMetaIcons[extraKind] : 'EllipsisOutlined'" />{{ extraLabel || $t('components.DetailHeader.moreInfo') }}
          </a-button>
        </a-popover>
      </div>
      <div v-else-if="variant === 'summary' && slots.meta" class="cloud-detail-header__meta">
        <slot name="meta" :expanded="false" />
      </div>
      <div v-if="variant === 'summary' && slots.description" class="cloud-detail-header__description">
        <slot name="description" />
      </div>
      <div v-if="variant === 'summary' && !compact && slots.extra" class="cloud-detail-header__extra">
        <slot name="extra" />
      </div>

      <div v-if='slots.info || slots.default' class='cloud-detail-header__info'>
        <slot name='info'>
          <slot />
        </slot>
      </div>

      <div v-if="variant === 'summary' && (slots.actions || (!identified && slots.status))" class="cloud-detail-header__actions" @click="identified && (factsOpen = false)">
        <slot v-if="!identified" name="status" />
        <slot name="actions" />
      </div>
    </div>

    <div v-if="variant !== 'summary' && slots.actions" class='cloud-detail-header__actions'>
      <slot name='actions' />
    </div>
    </div>
  </header>
</template>

<script setup lang='ts'>
import { computed, getCurrentInstance, ref, nextTick, useId } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { detailMetaIcons, type DetailMetaKind } from '../DetailMetaItem/semantics'

defineOptions({ name: 'CloudDetailHeader' })

const { t: $t } = useI18n()

const props = withDefaults(
  defineProps<{
    title: string
    showBack?: boolean
    backTitle?: string
    /** 摘要模式只负责布局，由外层 ContentPanel 提供卡片边界。 */
    variant?: 'default' | 'summary'
    /** 摘要固定为名称/动作、元信息两行，附加内容在浮层中查看。 */
    compact?: boolean
    extraLabel?: string
    extraKind?: DetailMetaKind
    metaLabel?: string
    metaTitle?: string
    /** 基本信息的分区编辑入口；权限与编辑表单由宿主负责。 */
    metaEditable?: boolean
    metaEditDisabled?: boolean
    /** 资源类别只读标识；文案由宿主国际化，主图片仍可独立编辑。 */
    resourceType?: { icon: string; label: string }
  }>(),
  {
    showBack: false,
    backTitle: undefined,
    variant: 'default',
    compact: false,
    extraLabel: undefined,
    extraKind: undefined,
  }
)

const displayBackTitle = computed(() => props.backTitle || $t('components.DetailHeader.back'))

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'editMeta'): void
}>()

const slots = defineSlots<{
  leading?: () => unknown; icon?: () => unknown; title?: () => unknown
  titleExtra?: () => unknown; status?: () => unknown; observation?: () => unknown; context?: () => unknown
  identifier?: () => unknown; description?: () => unknown; extra?: () => unknown
  actions?: () => unknown; info?: () => unknown; default?: () => unknown
  meta?: (scope: { expanded: boolean }) => unknown
  auxiliary?: (scope: { inline: boolean }) => unknown
}>()
const root = ref<HTMLElement>()
const { width } = useElementSize(root)
const identified = computed(() => props.variant === 'summary' && props.compact && !!slots.identifier)
const condensed = computed(() => identified.value && width.value > 0 && width.value < 820)
const factsOpen = ref(false)
const typeOpen = ref(false)
const factsId = `detail-facts-${useId()}`
function editMeta() {
  emit('editMeta')
}
function closeFacts() {
  factsOpen.value = false
  void nextTick(() => root.value?.querySelector<HTMLElement>('.cloud-detail-header__facts-trigger')?.focus())
}
const router = useRouter()
const instance = getCurrentInstance()

const handleBack = () => {
  // 已声明的 emits 监听器不会进入 attrs，需从当前 vnode 判断是否由父组件接管返回。
  if (instance?.vnode.props?.onBack) {
    emit('back')
  } else {
    router.back()
  }
}
</script>

<style scoped lang='less'>
.cloud-detail-header {
  display: flex;
  flex-wrap: wrap;
  container: detail-header / inline-size;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 0.0625rem solid var(--bg);
  border-radius: var(--r-6);
  background: var(--bg-trans-8);
  margin-bottom: 1rem;
}
.cloud-detail-header__layout,.cloud-detail-header__visual,.cloud-detail-header__identity-line { display:contents; }
.cloud-detail-header__type { display:inline-flex; flex:none; align-items:center; justify-content:center; width:20px; height:24px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--jet-theme-text-secondary); font-size:16px; cursor:help; }
.cloud-detail-header__type:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:2px; }

.cloud-detail-header__main {
  display: flex;
  flex: 1 1 20rem;
  flex-direction: column;
  min-width: 0;
  gap: var(--space-3);
}

.cloud-detail-header__title-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: var(--space-2);
}

.cloud-detail-header__back {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--jet-theme-text);
}

.cloud-detail-header__title-wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: var(--space-1);
}

.cloud-detail-header__title-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: var(--space-2);
}

.cloud-detail-header__title {
  flex-shrink: 1;
  margin: 0;
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-18);
  font-weight: 650;
  line-height: 2rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-detail-header__title-extra {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
}

.cloud-detail-header__description {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.cloud-detail-header__info {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.cloud-detail-header__actions {
  display: inline-flex;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.cloud-detail-header__title-main { flex-wrap: wrap; }
.cloud-detail-header__actions :deep(.ant-btn) { max-width: 100%; height: auto; min-height: 2rem; white-space: normal; overflow-wrap: anywhere; }
.cloud-detail-header__actions :deep(.ant-space) { flex-wrap: wrap; max-width: 100%; }
</style>

<style scoped src="./summary.css"></style>
<style scoped src="./compact.css"></style>
<style scoped src="./identified.css"></style>
