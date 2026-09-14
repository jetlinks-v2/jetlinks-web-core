<template>
  <div class="notification-record-container">
    <pro-search
      :columns="columns"
      :target="type"
      style="padding: 0"
      @search="onSearch"
    />
    <j-pro-table
      ref="tableRef"
      :columns="columns"
      :request="requestNotifications"
      mode="TABLE"
      :params="queryParams"
      :bodyStyle="{ padding: 0 }"
      :defaultParams="defaultParams"
      :scroll="{ y: 420 }"
    >
      <template #headerRightRender>
        <a-dropdown trigger="hover">
          <a-button type="link">
            {{ $t('NotificationRecord.index.803553-12') }}
            <AIcon type="DownOutlined" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item>
                <j-permission-button
                  :popConfirm="{
                    title: $t('NotificationRecord.index.803553-15'),
                    onConfirm: () => readPage(),
                  }"
                  type="text"
                >{{ $t('NotificationRecord.index.803553-13') }}</j-permission-button>
              </a-menu-item>
              <a-menu-item>
                <j-permission-button
                  :popConfirm="{
                    title: $t('NotificationRecord.index.803553-16'),
                    onConfirm: () => onAllRead(),
                  }"
                  type="text">{{ $t('NotificationRecord.index.803553-14') }}</j-permission-button>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
      <template #topicProvider="slotProps">
        <div class="notification-title-cell">
          <AIcon
            v-if="props.type?.endsWith('Bulletin')"
            :type="resolveBulletinTypeIcon(slotProps)"
            :style="{ color: resolveBulletinTypeColor(slotProps) }"
          />
          <j-ellipsis>{{ getNotificationTitle(slotProps) }}</j-ellipsis>
        </div>
      </template>
      <template #message="slotProps">
        <j-ellipsis>{{ getNotificationSummary(slotProps) }}</j-ellipsis>
      </template>
      <template #notifyTime="slotProps">
        {{ dayjs(slotProps.notifyTime).format('YYYY-MM-DD HH:mm:ss') }}
      </template>
      <template #state="slotProps">
        <j-badge-status
          :status="slotProps.state.value"
          :text="slotProps.state.text"
          :statusNames="{
            read: 'success',
            unread: 'error',
          }"
        ></j-badge-status>
      </template>
      <template #action="slotProps">
        <a-space :size="16">
          <j-permission-button
            type="link"
            :popConfirm="{
              title: $t('NotificationRecord.index.803553-0', [slotProps.state.value === 'read' ? $t('NotificationRecord.index.803553-8') : $t('NotificationRecord.index.803553-9')]),
              onConfirm: () => changeStatus(slotProps),
            }"
            :tooltip="{
              title: slotProps.state.value === 'read' ? $t('NotificationRecord.index.803553-1') : $t('NotificationRecord.index.803553-2'),
            }"
          >
            <AIcon
              :type="slotProps.state.value === 'read'
                ? 'MailOutlined'
                : 'CheckCircleOutlined'"
            />
          </j-permission-button>
          <j-permission-button
            type="link"
            :tooltip="{
              title: $t('NotificationRecord.index.803553-3'),
            }"
            @click="view(slotProps)"
          >
            <AIcon type="SearchOutlined" />
          </j-permission-button>
        </a-space>
      </template>
    </j-pro-table>
    <ViewDialog
      v-if="viewVisible"
      v-model:visible="viewVisible"
      :data="viewItem"
      :type="type"
    />
  </div>
</template>

<script setup lang="ts" name="NotificationRecord">
import ViewDialog from './components/ViewDialog.vue'
import { getList_api, changeStatus_api, changeAllStatus } from '@jetlinks-web-core/api/account/notificationRecord'
import dayjs from 'dayjs'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useRouterParams } from '@jetlinks-web/hooks'
import { getTypeListNew } from '@jetlinks-web-core/api/account/notificationSubscription'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n';
import globalI18n from '@jetlinks-web-core/locales'
import { resolveNoticeTexts } from '@jetlinks-web-core/layout/components/noticeTextResolver'

const { t: $t, locale } = useI18n();
const user = useUserStore()
interface ProviderItem {
  provider: string;
}

const props = defineProps({
  type: {
    type: String,
    default: '',
  },
  children: {
    type: Array as PropType<ProviderItem[]>,
    default: () => ([])
  }
})

const requestNotifications = async (params: Record<string, unknown>) => {
  const response = await getList_api(params)
  const result = response?.result
  const records = Array.isArray(result) ? result : result?.data
  if (!Array.isArray(records)) return response
  const resolved = await resolveNoticeTexts(records)
  return {
    ...response,
    result: Array.isArray(result)
      ? resolved
      : { ...result, data: resolved },
  }
}

const parseDetail = (record: Record<string, any>) => {
  if (record.detail && typeof record.detail === 'object') return record.detail
  if (typeof record.detailJson !== 'string') return undefined
  try {
    const detail = JSON.parse(record.detailJson)
    return detail && typeof detail === 'object' ? detail : undefined
  } catch {
    return undefined
  }
}

const resolveDetailI18nText = (detail: Record<string, any> | undefined, field: string) => {
  const messages = detail?.i18nMessages?.[field]
  if (!messages || typeof messages !== 'object') return ''
  const locale = String(globalI18n.global.locale.value || 'zh').replace('_', '-').toLowerCase()
  const language = locale.split('-')[0]
  return String(messages[locale] || messages[language] || '').trim()
}

const getNotificationTitle = (record: Record<string, any>) => {
  const detail = parseDetail(record)
  return resolveDetailI18nText(detail, 'title')
    || String(detail?.title || record.topicName || record.title || record.message || '').trim()
}

const getNotificationSummary = (record: Record<string, any>) => {
  const detail = parseDetail(record)
  return resolveDetailI18nText(detail, 'summary')
    || String(record.message || '').trim()
}

const resolveBulletinTypeIcon = (record: Record<string, any>) => {
  const type = parseDetail(record)?.type
  const value = typeof type === 'object' ? type?.value : type
  return {
    default: 'NotificationOutlined',
    maintenance: 'ToolOutlined',
    incident: 'WarningOutlined',
    release: 'RocketOutlined',
    security: 'SafetyCertificateOutlined',
    policy: 'FileTextOutlined',
  }[String(value || 'default')] || 'NotificationOutlined'
}

const resolveBulletinTypeColor = (record: Record<string, any>) => {
  const type = parseDetail(record)?.type
  const value = typeof type === 'object' ? type?.value : type
  return {
    default: 'var(--jet-theme-primary)',
    maintenance: '#fa8c16',
    incident: '#f5222d',
    release: '#1677ff',
    security: '#722ed1',
    policy: '#52c41a',
  }[String(value || 'default')] || 'var(--jet-theme-primary)'
}

const getType = computed(() => {
  return props.children.map((item) => item.provider)
  // if (props.type === 'system-business') {
  //   return ['device-transparent-codec']
  // } else if (props.type === 'system-monitor') {
  //   return ['system-event']
  // } else if (props.type === 'workflow-notification') {
  //   return [
  //     'workflow-task-cc',
  //     'workflow-task-todo',
  //     'workflow-task-reject',
  //     'workflow-process-finish',
  //     'workflow-process-repealed',
  //     'workflow-task-transfer-todo',
  //   ]
  // } else {
  //   return [
  //     'alarm',
  //     'alarm-product',
  //     'alarm-device',
  //     'alarm-other',
  //     'alarm-org',
  //   ]
  // }
})

const columns = [
  {
    title: props.type?.endsWith('Bulletin')
      ? $t('Announcement.inbox.message')
      : $t('NotificationRecord.index.803553-4'),
    dataIndex: 'topicProvider',
    key: 'topicProvider',
    search: {
      type: 'select',
      termFilter: ['in', 'nin'],
      options: () =>
      getTypeListNew(props.type).then((resp: any) => {
                    return resp.result
                        .map((item: any) => ({
                            label: item.name,
                            value: item.id,
            }))
        }),
    },
    scopedSlots: true,
    ellipsis: true,
  },
  {
    title: props.type?.endsWith('Bulletin')
      ? $t('Announcement.inbox.summary')
      : $t('NotificationRecord.index.803553-5'),
    dataIndex: 'message',
    key: 'message',
    search: {
      type: 'string',
    },
    scopedSlots: true,
    ellipsis: true,
  },
  {
    title: $t('NotificationRecord.index.803553-6'),
    dataIndex: 'notifyTime',
    key: 'notifyTime',
    search: {
      type: 'date',
    },
    scopedSlots: true,
    ellipsis: true,
  },
  {
    title: $t('NotificationRecord.index.803553-7'),
    dataIndex: 'state',
    key: 'state',
    search: {
      type: 'select',
      termFilter: ['in', 'nin'],
      options: [
        {
          label: $t('NotificationRecord.index.803553-8'),
          value: 'unread',
        },
        {
          label: $t('NotificationRecord.index.803553-9'),
          value: 'read',
        },
      ],
    },
    scopedSlots: true,
    ellipsis: true,
  },
  {
    title: $t('NotificationRecord.index.803553-10'),
    dataIndex: 'action',
    key: 'action',
    ellipsis: true,
    scopedSlots: true,
    width: '12.5rem',
  },
]

const viewVisible = ref<boolean>(false)
const viewItem = ref<any>({})

const routerParams = useRouterParams()

const defaultParams = {
  sorts: [{ name: 'notifyTime', order: 'desc' }],
  terms: [
    {
      terms: [
        {
          column: 'topicProvider',
          value: getType.value,
          termType: 'in',
        },
      ],
      type: 'and',
    },
  ],
}
const queryParams = ref({})
const onSearch = (params: Record<string, any>) => {
  queryParams.value = params
}

const tableRef = ref()

const view = (row: any) => {
  viewItem.value = row
  viewVisible.value = true
}
const refresh = () => {
  tableRef.value && tableRef.value.reload()
}

watch(locale, refresh)

const changeStatus = (row: any) => {
  const type = row.state.value === 'read' ? '_unread' : '_read'
  changeStatus_api(type, [row.id]).then((resp: any) => {
    if (resp.status === 200) {
      onlyMessage($t('NotificationRecord.index.803553-11'))
      refresh()
      user.updateAlarm()
    }
  })
}

watch(() => user.messageInfo?.id, (val) => {
  if(val){
    view(user.messageInfo)
  }
}, {
  immediate: true
})

const onAllRead = async () => {
    if (!getType.value.length) return;
    const resp = await changeAllStatus('_read', getType.value);
    if (resp.status === 200) {
        onlyMessage($t('NotificationRecord.index.803553-11'));
        refresh();
        user.updateAlarm();
    }
};

const readPage = async () => {
  const unreadIds = (tableRef.value?.dataSource || [])
    .filter((item: any) => item.state?.value === 'unread')
    .map((item: any) => item.id);
  if (!unreadIds.length) {
    onlyMessage($t('NotificationRecord.index.803553-11'));
    return;
  }
  const resp = await changeStatus_api('_read', unreadIds);
  if (resp.status === 200) {
    onlyMessage($t('NotificationRecord.index.803553-11'));
    refresh();
    user.updateAlarm();
  }
}

onMounted(() => {
  if (routerParams.params?.value.row) {
    view(routerParams.params?.value.row)
  }
})

onUnmounted(() => {
  user.messageInfo = {}
  viewVisible.value = false
  routerParams?.clear?.()
})
</script>

<style lang="less" scoped>
.notification-record-container {
  :deep(.ant-table-tbody) {
    .ant-table-cell {
      .ant-space-item {
        .ant-btn-link {
          padding: 0;
        }
      }
    }
  }

  .notification-title-cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);

    :deep(.anticon) {
      flex: none;
      color: var(--jet-theme-text-secondary);
      font-size: var(--fs-14);
    }
  }
}</style>
