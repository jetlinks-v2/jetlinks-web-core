<template>
  <div class="data-capability-lab">
    <a-card title="数据能力测试" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="loadCatalog">刷新目录</a-button>
          <a-button danger :disabled="!connection" @click="stopConnection">停止连接</a-button>
        </a-space>
      </template>

      <a-form layout="vertical" class="query-form">
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="scopeId">
              <a-input v-model:value="context.scopeId" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="关键字">
              <a-input v-model:value="query.keyword" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="能力类型">
              <a-select v-model:value="selectedKind" allow-clear @change="loadCatalog">
                <a-select-option value="data-source">DataSource</a-select-option>
                <a-select-option value="operation">Operation</a-select-option>
                <a-select-option value="option-source">OptionSource</a-select-option>
                <a-select-option value="context-value">Context</a-select-option>
                <a-select-option value="value-editor">ValueEditor</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="providerId">
              <a-input v-model:value="query.providerId" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <div class="lab-grid">
      <a-card title="能力目录" :bordered="false" class="catalog-card">
        <a-list :data-source="capabilityItems" :loading="loading" size="small">
          <template #renderItem="{ item }">
            <a-list-item
              class="capability-item"
              :class="{ active: item.id === selectedCapability?.id && item.kind === selectedCapability?.kind }"
              @click="selectCapability(item)"
            >
              <a-list-item-meta :title="item.name">
                <template #description>
                  <div>{{ item.id }}</div>
                  <a-space size="small" wrap>
                    <a-tag>{{ item.kind }}</a-tag>
                    <a-tag>{{ item.owner.providerId }}</a-tag>
                    <a-tag :color="item.availability.executable ? 'green' : 'orange'">
                      {{ item.availability.executable ? 'executable' : 'not executable' }}
                    </a-tag>
                  </a-space>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-card>

      <a-card title="定义与配置" :bordered="false" class="definition-card">
        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="definition" tab="Definition">
            <pre>{{ formatJson(selectedCapability) }}</pre>
          </a-tab-pane>
          <a-tab-pane key="config" tab="Config / Query / Input">
            <a-alert
              type="info"
              show-icon
              message="测试页只保存当前会话草稿。执行操作前请先 prepare，高风险操作默认不执行。"
            />
            <a-form layout="vertical" class="draft-form">
              <a-form-item label="config JSON">
                <a-textarea v-model:value="draftConfig" :rows="5" />
              </a-form-item>
              <a-form-item label="query JSON（DataSource / OptionSource）">
                <a-textarea v-model:value="draftQuery" :rows="5" />
              </a-form-item>
              <a-form-item label="input JSON（Operation）">
                <a-textarea v-model:value="draftInput" :rows="5" />
              </a-form-item>
            </a-form>
          </a-tab-pane>
          <a-tab-pane key="component" tab="Component Preview">
            <a-spin :spinning="componentLoading">
              <a-alert
                v-if="componentError"
                type="error"
                show-icon
                :message="componentError"
              />
              <div v-else-if="componentPreview" class="component-preview">
                <component :is="componentPreview" v-bind="componentPreviewProps" />
              </div>
              <a-empty v-else description="当前能力没有注册可预览组件">
                <a-button @click="refreshComponentPreview">重新加载组件</a-button>
              </a-empty>
            </a-spin>
          </a-tab-pane>
        </a-tabs>
      </a-card>

      <a-card title="测试运行" :bordered="false" class="runner-card">
        <a-space direction="vertical" class="runner-actions">
          <a-button type="primary" :disabled="selectedCapability?.kind !== 'data-source'" @click="runPreview">
            Preview
          </a-button>
          <a-button :disabled="selectedCapability?.kind !== 'data-source'" @click="runQuery">
            Query
          </a-button>
          <a-button :disabled="selectedCapability?.kind !== 'data-source'" @click="runConnect">
            Connect
          </a-button>
          <a-button :disabled="selectedCapability?.kind !== 'option-source'" @click="runOptionSource">
            Query Options
          </a-button>
          <a-button :disabled="selectedCapability?.kind !== 'operation'" @click="prepareOperation">
            Prepare Operation
          </a-button>
          <a-button danger :disabled="!canExecutePreparedOperation" @click="executeOperation">
            Execute Prepared
          </a-button>
        </a-space>
      </a-card>
    </div>

    <a-card title="事件与结果" :bordered="false" class="result-card">
      <a-tabs>
        <a-tab-pane key="events" tab="Events">
          <pre>{{ formatJson(events) }}</pre>
        </a-tab-pane>
        <a-tab-pane key="result" tab="Result">
          <pre>{{ formatJson(result) }}</pre>
        </a-tab-pane>
        <a-tab-pane key="fixture" tab="Fixture">
          <pre>{{ formatJson(currentFixture) }}</pre>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useDataCapabilityLab } from './useDataCapabilityLab'

const {
  context,
  query,
  selectedKind,
  selectedCapability,
  connection,
  preparedOperation,
  canExecutePreparedOperation,
  loading,
  activeTab,
  draftConfig,
  draftQuery,
  draftInput,
  events,
  result,
  componentPreview,
  componentPreviewProps,
  componentLoading,
  componentError,
  capabilityItems,
  currentFixture,
  loadCatalog,
  selectCapability,
  refreshComponentPreview,
  runPreview,
  runQuery,
  runConnect,
  runOptionSource,
  prepareOperation,
  executeOperation,
  stopConnection,
} = useDataCapabilityLab()

const formatJson = (value: unknown) => JSON.stringify(value, null, 2)

void loadCatalog()
</script>

<style scoped>
.data-capability-lab {
  padding: 16px;
}
.query-form {
  margin-top: 8px;
}
.lab-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 220px;
  gap: 16px;
  margin-top: 16px;
}
.catalog-card,
.definition-card,
.runner-card {
  min-height: 480px;
}
.capability-item {
  cursor: pointer;
}
.capability-item.active {
  background: rgba(22, 119, 255, 0.08);
}
.runner-actions {
  width: 100%;
}
.runner-actions :deep(.ant-btn) {
  width: 100%;
}
.component-preview {
  min-height: 220px;
  padding: 12px;
  overflow: auto;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
}
.result-card {
  margin-top: 16px;
}
pre {
  max-height: 520px;
  padding: 12px;
  overflow: auto;
  background: #f6f8fa;
  border-radius: 6px;
}
</style>
