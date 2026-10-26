<template>
  <div style="height: 100%; padding-right: 1.25rem">
    <a-tabs
      tab-position="left"
      v-if="tabs.length"
      :destroyInactiveTabPane="true"
      v-model:activeKey="user.other.tabKey"
    >
      <a-tab-pane v-for="item in tabs" :key="item.provider" :tab="item.name">
        <NotificationRecord :type="item.provider" :children="item.children" />
      </a-tab-pane>
    </a-tabs>
    <div v-else style="margin: 12.5rem 0"><CloudEmpty  /></div>
  </div>
</template>

<script lang="ts" setup>
import NotificationRecord from "./components/NotificationRecord/index.vue";
import { getReceivedNoticeProviders } from "@jetlinks-web-core/api/account/center";
import { useRouterParams } from "@jetlinks-web/hooks";
import { useUserStore } from "@jetlinks-web-core/store/user";
import { omit } from "lodash-es";

const tabs = ref<any[]>([]);
const router = useRouterParams();
const user = useUserStore();

const queryTypeList = () => {
  getReceivedNoticeProviders().then((resp: any) => {
    if (resp.status === 200) {
      const dataMap = new Map();
      resp.result.forEach((i: any) => {
        if (!dataMap.has(i.type.id)) {
          dataMap.set(i.type.id, {
            name: i.name,
            provider: i.type.id,
            children: [
              {
                ...omit(i, ["type"]),
              },
            ],
          });
        } else {
          dataMap.get(i.type.id).children.push({
            ...omit(i, ["type"]),
          });
        }
      });
      tabs.value = [...dataMap.values()];
      if (!user.other.tabKey) {
        user.other.tabKey = tabs.value?.[0]?.provider;
      }
    }
  });
};

// 路由页签仅在参数变化时同步，避免消息列表卸载清理后覆盖手动切换。
watch(
  () => router.params.value?.other?.tabKey,
  (tabKey) => {
    if (tabKey) user.other.tabKey = tabKey;
  },
  { immediate: true },
);

/** 仅消费新消息上下文，清空 Store 时不回退到旧路由消息。 */
const syncNotificationTab = (notification?: { topicProvider?: string }) => {
  if (!notification?.topicProvider) return;

  /** 按服务端 provider 分组定位消息类型，新增通知无需再维护前端枚举。 */
  const matched = tabs.value.find(tab =>
    tab.children?.some((child: any) => child.provider === notification.topicProvider),
  );
  if (matched) user.other.tabKey = matched.provider;
};

watch(() => router.params.value?.row, syncNotificationTab, { immediate: true });
watch(() => user.messageInfo, syncNotificationTab, { immediate: true });

// 消息类型异步返回后补充首次定位，不随页签切换时的消息清理重放路由上下文。
watch(tabs, () => {
  syncNotificationTab(user.messageInfo?.topicProvider
    ? user.messageInfo
    : router.params.value?.row);
});

onMounted(() => {
  queryTypeList();
});
</script>
