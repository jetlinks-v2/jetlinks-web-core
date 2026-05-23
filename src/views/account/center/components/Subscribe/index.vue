<template>
  <j-scrollbar :height="`calc(100% - 3.1875rem)`">
    <a-spin :spinning="loading">
      <div style="padding: 0 0.625rem">
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t("Subscribe.index.994011-0") }}
        </div>
        <div class="content-collapse">
          <template v-if="dataSource.length">
            <a-collapse
              :bordered="false"
              v-model:activeKey="activeKey"
              expand-icon-position="right"
            >
              <template #expandIcon="{ isActive }">
                <AIcon
                  type="CaretRightOutlined"
                  :style="{
                    transform: `rotate(${isActive ? 90 : 0}deg)`,
                  }"
                />
              </template>
              <a-collapse-panel
                v-for="item in dataSource"
                :key="item.provider"
                :header="item.name"
              >
                <div>
                  <template v-for="child in item.children" :key="child.id">
                    <Item
                      @refresh="handleSearch"
                      :data="child"
                      :subscribe="
                        subscribe.find(
                          (i) => i?.topicProvider === child?.provider,
                        )
                      "
                    />
                  </template>
                </div>
              </a-collapse-panel>
            </a-collapse>
          </template>
          <CloudEmpty style="margin: 12.5rem 0" v-else />
        </div>
      </div>
    </a-spin>
  </j-scrollbar>
</template>

<script lang="ts" setup>
import { getAllNotice } from "@jetlinks-web-core/api/account/center";
import { getNoticeList_api } from "@jetlinks-web-core/api/account/notificationSubscription";
import Item from "./components/Item.vue";
import { useMenuStore } from "@jetlinks-web-core/store/menu";
import { omit } from "lodash-es";

const menuStore = useMenuStore();
const subscribe = ref<any[]>([]);
const dataSource = ref<any[]>([]);
const activeKey = ref<string[]>();
const loading = ref<boolean>(false);
let initData: any[];
const handleSearch = () => {
  loading.value = true;
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
      dataSource.value = [...dataMap.values()];
      if (!activeKey.value) {
        activeKey.value = dataSource.value.map((i: any) => {
          return i?.provider;
        });
      }
    }
  });
  getNoticeList_api()
    .then((resp: any) => {
      if (resp.status === 200) {
        subscribe.value = resp?.result?.data || [];
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

onMounted(() => {
  handleSearch();
});
</script>

<style lang="less" scoped>
.alert {
  padding-left: 0.625rem;
  color: #999999;
  margin-bottom: var(--space-4);
}

.content-collapse {
  :deep(.ant-collapse) {
    border-color: #ebeef3;
    background-color: #fff;

    .ant-collapse-item {
      border: 1px solid #ebeef3;
      margin-bottom: var(--space-6);
    }

    .ant-collapse-header {
      background-color: #f7f8fa;
      height: 2.625rem;
    }

    .ant-collapse-content {
      padding: 1.0625rem 1.3125rem 0.4375rem 1.3125rem;
    }

    .ant-collapse-content-box {
      padding: 0;
    }
  }
}</style>
