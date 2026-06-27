<template>
  <a-drawer
    :open="true"
    placement="right"
    :width="760"
    :mask-closable="false"
    destroy-on-close
    :body-style="{ padding: 0, overflow: 'hidden' }"
    @close="emits('close')"
  >
    <template #title>
      <div class="ai-chat-drawer__title">
        <j-ellipsis>{{ activeClientName }}</j-ellipsis>
        <template v-if="availableAgents.length > 1">
          <j-ellipsis class="ai-chat-drawer__agent-name">
            {{ activeAgentName }}
          </j-ellipsis>
          <a-dropdown>
            <div class="ai-chat-drawer__agent-switch" @click.prevent>
              <AIcon type="DownOutlined" />
            </div>
            <template #overlay>
              <a-menu @click="handleAgentClick">
                <a-menu-item v-for="item in availableAgents" :key="item.agentId">
                  {{ item?.agentName || item.agentId }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </div>
    </template>

    <div class="ai-iframe-container">
      <component
        v-if="conversationComponent && activeAgent.agentId && activeAgent.clientType"
        :is="conversationComponent"
        :key="conversationKey"
        :agent-id="activeAgent.agentId"
        :agent-name="activeAgentName"
        :client-type="activeAgent.clientType || ''"
        :client-id="activeAgent.clientId || ''"
        :parameters="conversationParameters"
        :init-expands="conversationExpands"
        :subject-type="conversationSubject?.type || ''"
        :subject-id="conversationSubject?.id || ''"
      />
      <CloudEmpty v-else class="ai-chat-drawer__empty" />
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref, shallowRef, watch, type PropType } from 'vue';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import { buildAgentSubjectPayload, normalizeAgentSubject } from './subject';

interface AgentDeployRecord {
  agentId?: string;
  agentName?: string;
  clientId?: string;
  clientType?: string;
  others?: {
    client?: {
      name?: string;
    };
  };
  [key: string]: any;
}

const props = defineProps({
  agentList: {
    type: Array as PropType<AgentDeployRecord[]>,
    default: () => [],
  },
  parameters: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
});

const emits = defineEmits<{
  (e: 'close'): void;
}>();

const activeAgent = ref<AgentDeployRecord>({});
const conversationComponent = shallowRef<any>();

const availableAgents = computed(() => props.agentList || []);
const conversationSubject = computed(() => normalizeAgentSubject(props.parameters || {}));

// 页面功能点传入的 subject 需要同时进入会话参数和 expands，确保首条消息建会话与历史过滤口径一致。
const conversationParameters = computed(() => ({
  ...(props.parameters || {}),
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const conversationExpands = computed(() => ({
  clientId: activeAgent.value?.clientId,
  clientType: activeAgent.value?.clientType,
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const activeClientName = computed(() => activeAgent.value?.others?.client?.name || 'AI助手');
const activeAgentName = computed(() => activeAgent.value?.agentName || activeAgent.value?.agentId || '--');

const conversationKey = computed(() => [
  activeAgent.value?.agentId || '',
  activeAgent.value?.clientType || '',
  activeAgent.value?.clientId || '',
  conversationSubject.value?.type || '',
  conversationSubject.value?.id || '',
].join('|'));

const syncActiveAgent = (nextList: AgentDeployRecord[] = []) => {
  if (!nextList.length) {
    activeAgent.value = {};
    return;
  }

  const current = nextList.find((item) => item.agentId === activeAgent.value?.agentId);
  activeAgent.value = current || nextList[0];
};

const handleAgentClick = (event: { key: string }) => {
  const item = availableAgents.value.find((agent) => agent.agentId === event.key);
  if (item) {
    activeAgent.value = item;
  }
};

watch(
  () => props.agentList,
  (nextList) => syncActiveAgent(nextList || []),
  { immediate: true },
);

onMounted(() => {
  const component = moduleRegistry.getResourceItem(
    'jetlinks-ai-agent-ui',
    'components',
    'AgentAccessConversation',
  );
  conversationComponent.value = component ? markRaw(component) : undefined;
});
</script>

<style src="./AiChatDrawer.less" lang="less" scoped />
