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
import { getAllNotice } from "@jetlinks-web-core/api/account/center";
import { useRouterParams } from "@jetlinks-web/hooks";
import { useUserStore } from "@jetlinks-web-core/store/user";
import { omit } from "lodash-es";

const tabs = ref<any[]>([]);
const router = useRouterParams();
const user = useUserStore();

const queryTypeList = () => {
  getAllNotice().then((resp: any) => {
    if (resp.status === 200) {
      const dataMap = new Map();
      resp.result.forEach((i: any) => {
        if (!dataMap.has(i.type.id)) {
          dataMap.set(i.type.id, {
            name: i.type.name,
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

watchEffect(() => {
  if (router.params.value?.other?.tabKey) {
    user.other.tabKey = router.params.value.other.tabKey;
  }

  const notification = user.messageInfo?.topicProvider
    ? user.messageInfo
    : router.params.value?.row;
  if (!notification?.topicProvider) return;

  /** 按服务端 provider 分组定位消息类型，新增通知无需再维护前端枚举。 */
  const matched = tabs.value.find(tab =>
    tab.children?.some((child: any) => child.provider === notification.topicProvider),
  );
  if (matched) user.other.tabKey = matched.provider;
});

onMounted(() => {
  queryTypeList();
});
</script>
