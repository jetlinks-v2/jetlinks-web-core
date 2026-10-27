<template>
  <div class="notice-container" ref="noticeRef">
    <a-dropdown
      v-model:open="visible"
      :trigger="['click']"
      :placement="props.placement"
      :getPopupContainer="resolvePopupContainer"
    >
      <a-badge :count="total" :overflow-count="BADGE_OVERFLOW_COUNT" :offset="[3, -3]">
	      <AIcon class="notice-icon" :type="props.icon" />
      </a-badge>
      <template #overlay>
        <div>
          <NoticeInfo ref="noticeInfoRef" :tabs="tabs" @action="handleRead" />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="Notice">
import { getCurrentInstance, ref, type PropType } from 'vue'
import NoticeInfo from './NoticeInfo.vue';
import { useWebSocket } from '@jetlinks-web-core/hooks'
import { notification, Button } from 'ant-design-vue';
import { useUserStore } from '@jetlinks-web-core/store/user';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { getReceivedNoticeProviders } from '@jetlinks-web-core/api/account/center';
import { flatten } from 'lodash-es';
import { useI18n } from 'vue-i18n';
import {
    BADGE_OVERFLOW_COUNT,
    createUnreadQueryParams,
    type NoticeTabItem,
    toBadgeCount,
} from './noticeUtils';
import { handleRegisteredRealtimeNotice, type NoticeTipOptions } from './noticeRealtimeHandler';
import { changeNoticeReadState, queryNoticeUnreadSummary, useNoticeDataSourceChanges, useNoticeDataSourceRealtime } from './noticeListHandler';

type NoticePlacement = 'top' | 'bottom' | 'topLeft' | 'topRight' | 'topCenter'
  | 'bottomLeft' | 'bottomRight' | 'bottomCenter'
type NoticePopupContainer = (triggerNode: HTMLElement) => HTMLElement

// 保留原 Header 默认行为，同时允许侧栏按所在位置调整图标、弹层方向与挂载容器。
const props = defineProps({
  icon: {
    type: String,
    default: 'BellOutlined'
  },
  placement: {
    type: String as PropType<NoticePlacement>,
    default: 'bottomLeft'
  },
  getPopupContainer: {
    type: Function as PropType<NoticePopupContainer>,
    default: undefined
  }
})

const { t: $t } = useI18n();
const updateCount = computed(() => useUserStore().alarmUpdateCount);
const menuStory = useMenuStore();

const visible = ref(false)
const total = ref(0)
const loading = ref(false)
let countRequestId = 0
let providerRequestId = 0
const noticeRef = ref<HTMLElement | null>(null)
const noticeInfoRef = ref<{ refresh: () => void } | null>(null)
const appContext = getCurrentInstance()?.appContext

const resolvePopupContainer = (triggerNode: HTMLElement) => {
  return props.getPopupContainer?.(triggerNode) || noticeRef.value || document.body
}

const getList = () => {
    const currentRequestId = ++countRequestId;
    const topicProviders = flatten(tabs.value.map((i: any) => i?.type)).filter(Boolean);
    if (topicProviders.length <= 0) {
        total.value = 0;
        loading.value = false;
        return;
    }
    loading.value = true;
    const params = createUnreadQueryParams(topicProviders, BADGE_OVERFLOW_COUNT);
    queryNoticeUnreadSummary(topicProviders, params)
        .then((resp: any) => {
            if (currentRequestId === countRequestId) {
                total.value = toBadgeCount(resp.result?.total);
            }
        })
        .finally(() => {
            if (currentRequestId === countRequestId) loading.value = false;
        });
};

const markNotificationRead = async (payload: Record<string, any>) => {
    const resp = await changeNoticeReadState([payload.topicProvider], '_read', [payload.id]);
    if (resp.status === 200) {
        getList();
    }
};

// 业务模块可以按 provider 接管实时提示图标与点击行为，未接管时仍走下面的通用轻提示。
const showNoticeTip = (
  payload: Record<string, any>,
  options: NoticeTipOptions,
) => {
    const key = String(payload?.id || options.title || '');
    notification.open({
        key,
        icon: options.icon,
        message: options.title,
        description: options.description,
        onClick: () => {
            notification.close(key);
            options.onClick?.();
        },
    });
};

/** 独立数据源和普通通知共用现有展示分派，不在顶栏判断具体业务 Topic。 */
const handleRealtimePayload = async (payload: Record<string, any>) => {
    if (!payload?.id) return;
    const handled = await handleRegisteredRealtimeNotice(payload, {
      markRead: () => markNotificationRead(payload),
      refresh: getList,
      appContext,
      source: 'realtime',
      showTip: (options: NoticeTipOptions) => showNoticeTip(payload, options),
    });
    // WebSocket 只触发刷新，角标始终以后端未读统计为准。
    getList();
    noticeInfoRef.value?.refresh();
    if (handled) return;
    const data = { payload };
    notification.open({
                message: data?.payload?.topicName,
                description: () =>
                  h(
                    'div',
                    {
                      class: "ellipsis",
                      style: {
                        cursor: 'pointer'
                      },
                      onClick: () => {
                        read('', data);
                      }
                    },
                    {
                      default: () => data?.payload?.message
                    }
                  )
                ,
                onClick: () => {
                    read('', data);
                },
                key: data.payload.id,
                btn: () =>
                  h(
                    Button,
                    {
                      type: "primary",
                      size: "small",
                      onClick: (e: Event) => {
                        e.stopPropagation();
                        read('_read', data);
                      }
                    },
                    {
                      default: () => $t('components.Notice.573407-0')
                    }
                  ),
    });
};

const { send } = useWebSocket({ onMessage: data => handleRealtimePayload(data?.payload) });

const read = (type: string, data: any) => {
    const id = data?.payload?.id;
    if (!id) return;
    changeNoticeReadState([data.payload.topicProvider], '_read', [id]).then((resp: any) => {
        if (resp.status !== 200) return;
        // notification.close(data.payload.id);
        getList();
        if (type !== '_read') {
            menuStory.routerPush('account/center', {
               params:{
                tabKey: 'StationMessage',
                row: data.payload,
               }
            });
        }
    });
};

const handleRead = () => {
    visible.value = false;
    getList();
};




const tabs = ref<NoticeTabItem[]>([]);

const queryTypeList = async () => {
    const currentRequestId = ++providerRequestId;
    countRequestId++;
    const resp: any = await getReceivedNoticeProviders();
    if (currentRequestId !== providerRequestId) return;
    if (resp.status === 200) {
      const typeMap = new Map<string, NoticeTabItem>()
        resp.result.forEach((i: any) => {
            const currentTab = typeMap.get(i.type.id)
            if (!currentTab) {
                typeMap.set(i.type.id, {
                    key: i.type.id,
                    tab: i.type.name,
                    type: [
                        i.provider
                    ]
                })
            } else {
                currentTab.type.push(i.provider)
            }
        })
        tabs.value = [...typeMap.values()]
        if (tabs.value.length > 0) {
            send('notification', '/notifications', {});
        }
        getList();
    }
};

useNoticeDataSourceChanges(() => tabs.value.flatMap(tab => tab.type), () => {
    getList();
    noticeInfoRef.value?.refresh();
});
useNoticeDataSourceRealtime(() => tabs.value.flatMap(tab => tab.type), handleRealtimePayload);
watch(() => useUserStore().userInfo?.id, queryTypeList);
watch(updateCount, () => getList());
watch(visible, (opened) => {
    // 打开铃铛时再次向后端校准，避免浏览器保留过期角标。
    if (opened) {
        getList();
        noticeInfoRef.value?.refresh();
    }
});

onMounted(() => {
    queryTypeList()
})

</script>

<style scoped lang="less">
.notice-container {
		display: flex;
		align-items: center;
    .notice-icon {
        font-size: var(--fs-h4);
    }

    .icon-content {
        height: 3rem;
        display: flex;
        align-items: center;
        position: relative;

        .unread {
            position: absolute;
            top: 0;
            right: -0.75rem;
            min-width: 1.25rem;
            height: 1.25rem;
            padding: 0 0.375rem;
            color: var(--accent-ink);
            font-weight: normal;
            font-size: var(--fs-12);
            line-height: 1.25rem;
            white-space: nowrap;
            text-align: center;
            background: var(--jet-theme-error);
            border-radius: 0.625rem;
        }
    }
}</style>
