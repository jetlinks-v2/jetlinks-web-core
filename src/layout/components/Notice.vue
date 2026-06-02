<template>
  <div class="notice-container" ref="noticeRef">
    <a-dropdown
      v-model:open="visible"
      :trigger="['click']"
      :getPopupContainer="getPopupContainer"
    >
      <a-badge :count="total" :overflow-count="BADGE_OVERFLOW_COUNT" :offset="[3, -3]">
        <AIcon class="notice-icon" type="BellOutlined" />
      </a-badge>
      <template #overlay>
        <div>
          <NoticeInfo :tabs="tabs" @action="handleRead" />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="Notice">
import { changeStatus_api, getUnreadCount_api } from '@jetlinks-web-core/api/account/notificationRecord';
import { ref } from 'vue'
import NoticeInfo from './NoticeInfo.vue';
import { useWebSocket } from '@jetlinks-web-core/hooks'
import { notification, Button } from 'ant-design-vue';
import { useUserStore } from '@jetlinks-web-core/store/user';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { getAllNotice } from '@jetlinks-web-core/api/account/center';
import { flatten } from 'lodash-es';
import { useI18n } from 'vue-i18n';
import {
    BADGE_OVERFLOW_COUNT,
    BADGE_OVERFLOW_VALUE,
    createUnreadQueryParams,
    toBadgeCount,
} from './noticeUtils';

const { t: $t } = useI18n();
const updateCount = computed(() => useUserStore().alarmUpdateCount);
const menuStory = useMenuStore();

const visible = ref(false)
const total = ref(0)
const loading = ref(false)
const noticeRef = ref(null)

const getPopupContainer = () => {
  return noticeRef.value || document.body
}

const { send } = useWebSocket({
  onMessage(data) {
    if (!data?.payload?.id) return;
    // 消息处理
    total.value = Math.min(total.value + 1, BADGE_OVERFLOW_VALUE);
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
  }
})

// const visibleChange = (v: boolean) => {
//   v && getList();
// }



const read = (type: string, data: any) => {
    const id = data?.payload?.id;
    if (!id) return;
    changeStatus_api('_read', [id]).then((resp: any) => {
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

// 查询未读数量
const getList = () => {
    const topicProviders = flatten(tabs.value.map((i: any) => i?.type)).filter(Boolean);
    if (topicProviders.length <= 0) {
        total.value = 0;
        return;
    }
    loading.value = true;
    const params = createUnreadQueryParams(topicProviders, BADGE_OVERFLOW_COUNT);
    getUnreadCount_api(params)
        .then((resp: any) => {
            total.value = toBadgeCount(resp.result);
        })
        .finally(() => (loading.value = false));
};


const handleRead = () => {
    visible.value = false;
    getList();
};




const tabs = ref<any>([]);

const queryTypeList = async () => {
    const resp: any = await getAllNotice();
    if (resp.status === 200) {
      const typeMap = new Map()
        resp.result.forEach((i: any) => {
            if (!typeMap.has(i.type.id)) {
                typeMap.set(i.type.id, {
                    key: i.type.id,
                    tab: i.type.name,
                    type: [
                        i.provider
                    ]
                })
            } else {
                typeMap.get(i.type.id).type.push(i.provider)
            }
        })
        tabs.value = [...typeMap.values()]
        if (tabs.value.length > 0) {
            send('notification', '/notifications', {});
            getList();
        }
    }
};

watch(updateCount, () => getList());

onMounted(() => {
    queryTypeList()
})

</script>

<style scoped lang="less">
.notice-container {
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
