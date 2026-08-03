<template>
  <a-modal
    visible
    :title="$t('components.ViewDialog.411617-0')"
    :width="754"
    @cancel="emits('update:visible', false)"
    class="view-dialog-container"
  >
    <template
      v-if="
        ['device-transparent-codec', 'system-event'].includes(
          data?.topicProvider,
        )
      "
    >
      <div>
        <div class="label">{{ $t('components.ViewDialog.411617-1') }}</div>
        <div style="padding: 0.625rem; background-color: #fafafa">
          <j-scrollbar height="12.5rem">
            <JsonViewer :value="data" />
          </j-scrollbar>
        </div>
      </div>
    </template>
    <template
      v-else-if="
        [
          'workflow-task-cc',
          'workflow-task-todo',
          'workflow-task-reject',
          'workflow-process-finish',
          'workflow-process-repealed',
          'workflow-task-transfer-todo',
        ].includes(data?.topicProvider)
      "
    >
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
    <template v-else-if="isWorkOrder">
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
        <a-descriptions-item :label="$t('components.ViewDialog.411617-16')">
          <j-ellipsis>{{ workOrderData?.title || data?.message || '' }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-17')">
          <j-ellipsis>{{ workOrderData?.orderNo || data?.dataId || '' }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-18')">
          <j-ellipsis>{{ workOrderData?.parkName || '' }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-19')">
          <j-ellipsis>{{ workOrderData?.typeName || '' }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-20')">
          <j-ellipsis>{{ workOrderEventName }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-21')">
          <j-ellipsis>{{ workOrderData?.operatorName || '' }}</j-ellipsis>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-22')">
          {{ formatWorkOrderTime(workOrderData?.occurredTime || data?.notifyTime) }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('components.ViewDialog.411617-23')">
          <j-ellipsis>{{ workOrderData?.reason || data?.message || '' }}</j-ellipsis>
        </a-descriptions-item>
      </a-descriptions>
    </template>
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
        <a-descriptions-item :label="$t('components.ViewDialog.411617-11')"
          >{{ dayjs(_data?.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}
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
              style="background-color: #fafafa"
              :value="JSON.parse(_data?.alarmInfo || '{}')"
            />
          </j-scrollbar>
        </div>
      </div>
    </template>
    <template #footer>
      <a-button type="primary" @click="emits('update:visible', false)"
        >{{ $t('components.ViewDialog.411617-15') }}
      </a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import {
  getWorkflowNotice,
  getWorkOrderDetail_api,
  queryLevel as queryLevel_api,
} from '@jetlinks-web-core/api/account/notificationRecord'
const emits = defineEmits(['update:visible'])
const { t } = useI18n()
const props = defineProps<{
  visible: boolean
  data: any
  type: string
}>()

const levelList = ref<any[]>([])
//工作流详情的值
const workFlowData = ref()
const workOrderDetail = ref<Record<string, any>>({})
const _data = computed(() => {
  if (props.data.detailJson) {
    try {
      return JSON.parse(props.data.detailJson)
    } catch {
      // Older notification records can contain invalid serialized details; retain the direct payload when available.
      return props.data?.detail || props.data
    }
  }
  return props.data?.detail || props.data
})
const isWorkOrder = computed(() => props.data?.topicProvider === 'work-order')
const workOrderData = computed(() => ({ ...workOrderDetail.value, ...(_data.value || {}) }))
const workOrderEventType = computed(() => {
  return workOrderData.value?.eventType || props.data?.code?.replace('work-order.', '')
})
const workOrderEventName = computed(() => {
  const names: Record<string, string> = {
    dispatched: 'components.ViewDialog.411617-24',
    autoDispatched: 'components.ViewDialog.411617-25',
    accepted: 'components.ViewDialog.411617-26',
    submittedForVerification: 'components.ViewDialog.411617-27',
    verificationRejected: 'components.ViewDialog.411617-28',
    verified: 'components.ViewDialog.411617-29',
    reassigned: 'components.ViewDialog.411617-30',
    urged: 'components.ViewDialog.411617-31',
    closed: 'components.ViewDialog.411617-32',
  }
  return t(names[workOrderEventType.value] || 'components.ViewDialog.411617-33')
})
const formatWorkOrderTime = (value?: number) => value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : ''
const getLevel = () => {
  queryLevel_api().then((resp: any) => {
    if (resp.status === 200) levelList.value = resp.result.levels
  })
}
const getLevelLabel = (id: number) => {
  if (levelList.value.length < 1 || !id) return ''
  const obj = levelList.value.find((item) => item.level === id)
  return obj?.title
}
onMounted(() => {
  if (
    !['device-transparent-codec', 'system-event', 'work-order'].includes(
      props?.data?.topicProvider,
    )
  ) {
    getLevel()
  }
  if (
    [
      'workflow-task-cc',
      'workflow-task-todo',
      'workflow-task-reject',
      'workflow-process-finish',
      'workflow-process-repealed',
      'workflow-task-transfer-todo',
    ].includes(props?.data?.topicProvider)
  ) {
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
  if (isWorkOrder.value && props.data?.dataId) {
    getWorkOrderDetail_api(props.data.dataId).then((res: any) => {
      if (res.status === 200) {
        workOrderDetail.value = res.result || {}
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
