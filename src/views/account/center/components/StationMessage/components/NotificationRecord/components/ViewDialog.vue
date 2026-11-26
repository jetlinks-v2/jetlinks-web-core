<template>
  <a-modal
    open
    :title="hasRegisteredDetail
      ? notificationTitle
      : $t(summary?.titleKey ?? 'components.ViewDialog.411617-0')"
    :width="754"
    @cancel="emits('update:visible', false)"
    class="view-dialog-container"
  >
    <RegistryComponent
      v-if="hasRegisteredDetail"
      page-code="notification-detail"
      code="default"
      :active-key="`${data.topicProvider}:append`"
      :data="data"
    />
    <template v-else-if="isRawDetail">
      <div>
        <div class="label">{{ $t('components.ViewDialog.411617-1') }}</div>
        <div style="padding: 0.625rem; background-color: #fafafa">
          <j-scrollbar height="12.5rem">
            <JsonViewer :value="data" />
          </j-scrollbar>
        </div>
      </div>
    </template>
    <template v-else-if="isWorkflow">
      <a-descriptions
        :column="2"
        :contentStyle="{
          color: '#333333',
        }"
        :labelStyle="{
          color: 'rgba(0, 0, 0, 0.6)',
          width: '4.5rem',
        }"
      >
        <a-descriptions-item :label="$t('components.ViewDialog.411617-2')">
          <j-ellipsis>{{ workFlowData?.creatorName }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-3')">
          <j-ellipsis>
            {{ dayjs(workFlowData?.createTime).format('YYYY-MM-DD HH:mm:ss') }}
          </j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-4')">
          <j-ellipsis>
            {{ workFlowData?.classifiedName }}
          </j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-5')">
          <j-ellipsis>
            {{ workFlowData?.modelName }}
          </j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-6')">
          <j-ellipsis>
            {{ workFlowData?.name }}
          </j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-7')">
          <j-ellipsis>
            {{ workFlowData?.summary }}
          </j-ellipsis>
        </a-descriptions-item>
      </a-descriptions>
    </template>
    <StationNotificationSummary v-else-if="summary" :summary="summary" :levels="levelList" />
    <template v-else>
      <a-descriptions
        :column="2"
        :contentStyle="{
          color: '#333333',
        }"
        :labelStyle="{
          color: 'rgba(0, 0, 0, 0.6)',
          width: '4.5rem',
        }"
      >
        <template v-if="data?.topicProvider === 'alarm-device'">
          <a-descriptions-item :label="$t('components.ViewDialog.411617-8')">
            <j-ellipsis>{{ _data?.targetName || '' }}</j-ellipsis>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('components.ViewDialog.411617-9')">
            <j-ellipsis>
              {{ _data?.targetId || '' }}
            </j-ellipsis>
          </a-descriptions-item>
        </template>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-10')">
          <j-ellipsis>
            {{ _data?.alarmName || _data?.alarmConfigName || '' }}
          </j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item v-if="alarmTime !== undefined" :label="$t('components.ViewDialog.411617-11')">
          {{ dayjs(alarmTime).format('YYYY-MM-DD HH:mm:ss') }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-12')"
          >{{ (levelList.length > 0 && getLevelLabel(_data.level)) || '' }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-13')">
          <j-ellipsis>
            {{ _data?.description || '' }}
          </j-ellipsis>
        </a-descriptions-item>
      </a-descriptions>
      <div>
        <div class="label">{{ $t('components.ViewDialog.411617-14') }}</div>
        <div style="padding: 0.625rem; background-color: #fafafa">
          <j-scrollbar height="12.5rem">
            <JsonViewer
              style="background-color: #fafafa; height: 12.5rem"
              :value="_data"
            />
          </j-scrollbar>
        </div>
      </div>
    </template>
    <template #footer>
      <a-button type="primary" :loading="confirming" @click="confirmDetail"
        >{{ $t('components.ViewDialog.411617-15') }}
      </a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { onScopeDispose } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'
import dayjs from 'dayjs'
import globalI18n from '@jetlinks-web-core/locales'
import RegistryComponent from '@jetlinks-web-core/components/RegisterComponents'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import {
  getWorkflowNotice,
  queryLevel as queryLevel_api,
} from '@jetlinks-web-core/api/account/notificationRecord'
import StationNotificationSummary from './StationNotificationSummary.vue'
import { buildStationSummary, readNotificationDetail, resolveAlarmNotificationTime } from './alarmNotificationSummary'

const emits = defineEmits(['update:visible'])
const props = defineProps<{
  visible: boolean
  data: any
  type: string
  confirm?: () => Promise<void>
}>()

let active = true
onScopeDispose(() => { active = false })
const confirming = ref(false)
const confirmDetail = async () => {
  if (confirming.value) return
  confirming.value = true
  try {
    await props.confirm?.()
    if (active) emits('update:visible', false)
  } finally {
    confirming.value = false
  }
}

const levelList = ref<Array<{ level: number; title: string }>>([])
//工作流详情的值
const workFlowData = ref()

// 历史通知的 detailJson 可能损坏，解析失败时回退到通知记录本身
const _data = computed(() => readNotificationDetail(props.data))

const alarmTime = computed(() => resolveAlarmNotificationTime(_data.value.alarmTime, props.data?.notifyTime))
const isRawDetail = computed(() => ['device-transparent-codec', 'system-event'].includes(props.data?.topicProvider))
const isWorkflow = computed(() => [
  'workflow-task-cc', 'workflow-task-todo', 'workflow-task-reject', 'workflow-process-finish',
  'workflow-process-repealed', 'workflow-task-transfer-todo',
].includes(props.data?.topicProvider))

const notificationTitle = computed(() => {
  const messages = _data.value?.i18nMessages?.title
  if (messages && typeof messages === 'object') {
    const locale = String(globalI18n.global.locale.value || 'zh').replace('_', '-').toLowerCase()
    const localized = String(messages[locale] || messages[locale.split('-')[0]] || '').trim()
    if (localized) return localized
  }
  return props.data?.topicName || props.data?.title || props.data?.message || ''
})

const hasRegisteredDetail = computed(() =>
  componentsRegistry
    .getRegistry('notification-detail:default')
    .some(item => item.code === props.data?.topicProvider),
)

// 注册详情和专属模板优先，不能按载荷中的同名告警字段抢占它们。
const summary = computed(() => hasRegisteredDetail.value || isRawDetail.value || isWorkflow.value || !props.data
  ? undefined
  : buildStationSummary(props.data, _data.value))

// 字典用于补充级别名称；不可用时摘要仍可使用快照文案或数值。
const getLevel = async () => {
  try {
    const resp = await queryLevel_api()
    if (resp.status === 200 && Array.isArray(resp.result?.levels)) levelList.value = resp.result.levels
  } catch {
    levelList.value = []
  }
}
const getLevelLabel = (id: number) => {
  if (levelList.value.length < 1 || !id) return ''
  const obj = levelList.value.find((item) => item.level === id)
  return obj?.title
}
onMounted(() => {
  if (!hasRegisteredDetail.value && !isRawDetail.value && !isWorkflow.value && props.data?.topicProvider !== 'scene') {
    getLevel()
  }
  if (isWorkflow.value) {
    const params = {
      terms: [
        {
          type: 'or',
          value: [
            'workflow-process-finish',
            'workflow-process-repealed',
          ].includes(props?.data?.topicProvider)
            ? props?.data?.dataId
            : props?.data?.detailJson
            ? JSON.parse(props?.data?.detailJson)?.processId
            : props?.data?.detail?.processId,
          termType: 'eq',
          column: 'id',
        },
      ],
    }
    getWorkflowNotice(params).then((res: any) => {
      workFlowData.value = {
        topicProvider: props?.data?.topicProvider,
        ...res?.result?.[0],
      }
    })
  }
})
</script>

<style lang="less" scoped>
.view-dialog-container {
  .label {
    width: 100%;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: var(--space-2);
  }

  .value {
    color: #333333;
  }
}</style>
