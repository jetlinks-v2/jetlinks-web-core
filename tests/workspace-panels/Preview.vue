<template>
  <main class="fixture">
    <div class="fixture-controls">
      <a-segmented v-model:value="mode" :options="modes" aria-label="折叠入口布局" />
      <a-space wrap>
        <a-button @click="collapsed = !collapsed">外部{{ collapsed ? '展开' : '收起' }}</a-button>
        <a-checkbox v-model:checked="collapsible">允许折叠</a-checkbox>
        <a-checkbox v-model:checked="acceptRequests">接受点击请求</a-checkbox>
      </a-space>
    </div>
    <section ref="frame" class="fixture-workspace" aria-label="设备工作区">
      <EqualHeightColumns :collapsed="collapsed" :collapsible="collapsible" :show-left="!compact"
        left-width="13rem" gap="var(--space-4)" @update:collapsed="requestCollapse">
        <template v-if="mode === 'left'" #left-header>对象空间</template>
        <template #left>
          <div class="navigation">
            <a-input v-model:value="navigationDraft" aria-label="导航草稿" placeholder="搜索空间" allow-clear />
            <a-menu v-model:selected-keys="selectedSpace" :items="spaces" />
          </div>
        </template>
        <template v-if="mode === 'toolbar'" #right-header>
          <div class="content-toolbar">
            <a-input v-model:value="search" aria-label="搜索设备" placeholder="搜索设备" allow-clear />
            <a-button type="primary">新增设备</a-button>
          </div>
        </template>
        <template #right>
          <div ref="workspace" class="device-workspace" :style="workspaceStyle">
            <div class="device-content">
              <div class="content-toolbar content-toolbar--body">
                <a-space>
                  <a-button v-if="compact" @click="navigationOpen = true"><AIcon type="AppstoreOutlined" />空间</a-button>
                  <strong>{{ activeSpace }}</strong>
                </a-space>
                <a-button v-if="inspectorInDrawer" @click="inspectorOpen = true"><AIcon type="ProfileOutlined" />设备详情</a-button>
              </div>
              <div v-if="mode !== 'toolbar'" class="content-toolbar content-toolbar--body">
                <a-input v-model:value="search" aria-label="搜索设备" placeholder="搜索设备" allow-clear />
                <a-button type="primary">新增设备</a-button>
              </div>
              <a-list :data-source="filteredDevices" class="device-list">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-button type="text" class="device-item" :class="{ 'is-selected': selectedDevice === item.id }" @click="selectedDevice = item.id">
                      <AIcon type="DeploymentUnitOutlined" />
                      <span><b>{{ item.name }}</b><small>{{ item.location }}</small></span>
                      <a-tag :color="item.online ? 'success' : 'default'">{{ item.online ? '在线' : '离线' }}</a-tag>
                    </a-button>
                  </a-list-item>
                </template>
              </a-list>
            </div>
            <PanelResizeHandle v-if="!inspectorInDrawer" v-model="panelWidth" :container="workspace"
              :limits="{ min: 280, max: 480, contentMin: 320, initial: 320 }" aria-label="调整设备详情宽度" aria-controls="device-inspector" />
            <aside v-if="!inspectorInDrawer" id="device-inspector" class="device-inspector">
              <h2>{{ activeDevice.name }}</h2>
              <a-tag :color="activeDevice.online ? 'success' : 'default'">{{ activeDevice.online ? '在线' : '离线' }}</a-tag>
              <dl><dt>安装位置</dt><dd>{{ activeDevice.location }}</dd><dt>最近上报</dt><dd>刚刚</dd></dl>
              <label for="device-draft">处理备注</label>
              <a-textarea id="device-draft" v-model:value="deviceDraft" :rows="4" />
            </aside>
          </div>
        </template>
      </EqualHeightColumns>
    </section>
    <output class="fixture-state" aria-live="polite">{{ compact ? '单栏 · 空间抽屉' : '双栏' }} · {{ collapsed ? '收起偏好' : '展开偏好' }} · 详情 {{ panelWidth }}px · 最近请求 {{ lastRequest }}</output>
    <a-drawer v-model:open="navigationOpen" title="对象空间" placement="left" :width="280">
      <a-input v-model:value="navigationDraft" aria-label="导航草稿" placeholder="搜索空间" allow-clear />
      <a-menu v-model:selected-keys="selectedSpace" :items="spaces" @click="navigationOpen = false" />
    </a-drawer>
    <a-drawer v-model:open="inspectorOpen" :title="activeDevice.name" :width="320">
      <a-tag :color="activeDevice.online ? 'success' : 'default'">{{ activeDevice.online ? '在线' : '离线' }}</a-tag>
      <dl><dt>安装位置</dt><dd>{{ activeDevice.location }}</dd></dl>
      <label for="drawer-draft">处理备注</label>
      <a-textarea id="drawer-draft" v-model:value="deviceDraft" :rows="4" />
    </a-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import EqualHeightColumns from '../../src/components/EqualHeightColumns/index.vue'
import PanelResizeHandle from '../../src/components/PanelResizeHandle/index.vue'

const mode = ref('toolbar')
const modes = [{ label: '默认轨道', value: 'default' }, { label: '右侧工具栏', value: 'toolbar' }, { label: '左侧标题', value: 'left' }]
const collapsed = ref(false), collapsible = ref(true), acceptRequests = ref(true), lastRequest = ref('无')
function requestCollapse(next: boolean) {
  lastRequest.value = `${next ? '收起' : '展开'}${acceptRequests.value ? ' · 已接受' : ' · 已拒绝'}`
  if (acceptRequests.value) collapsed.value = next
}
const frame = ref<HTMLElement>(), workspace = ref<HTMLElement>()
const { width: frameWidth } = useElementSize(frame)
const { width: workspaceWidth } = useElementSize(workspace)
// 断点与业务草稿属于示例宿主，不进入布局组件。
const compact = computed(() => frameWidth.value > 0 && frameWidth.value < 720)
const inspectorInDrawer = computed(() => workspaceWidth.value < 640)
const navigationOpen = ref(false), inspectorOpen = ref(false)
const panelWidth = ref(320)
const workspaceStyle = computed(() => ({ gridTemplateColumns: inspectorInDrawer.value ? 'minmax(0, 1fr)' : `minmax(0, 1fr) ${panelWidth.value}px` }))
const navigationDraft = ref(''), deviceDraft = ref('巡检草稿'), search = ref(''), selectedSpace = ref(['workshop'])
const spaces = [{ key: 'workshop', label: '生产车间' }, { key: 'warehouse', label: '仓储区域' }, { key: 'utilities', label: '公用设施' }]
const activeSpace = computed(() => spaces.find(item => item.key === selectedSpace.value[0])?.label ?? '全部空间')
const devices = [
  { id: 'sensor-01', name: '温湿度传感器', location: '生产车间 · 一层', online: true },
  { id: 'meter-02', name: '智能电表', location: '生产车间 · 配电室', online: true },
  { id: 'gateway-03', name: '边缘网关', location: '仓储区域 · 二层', online: false },
  { id: 'pump-04', name: '循环水泵', location: '公用设施 · 泵房', online: true },
]
const selectedDevice = ref(devices[0].id)
const activeDevice = computed(() => devices.find(item => item.id === selectedDevice.value) ?? devices[0])
const filteredDevices = computed(() => devices.filter(item => item.name.includes(search.value)))
</script>

<style>
body { margin: 0; background: var(--canvas); color: var(--ink-1); font-family: var(--font-sans); }
.fixture { padding: var(--space-4); }
.fixture-controls { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
.fixture-workspace { height: calc(100dvh - 130px); min-height: 400px; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-3); overflow: hidden; }
.fixture-state { display: block; margin-top: var(--space-2); color: var(--ink-2); font-size: var(--fs-12); }
.navigation { padding: var(--space-3); height: 100%; overflow: auto; }
.navigation .ant-menu { border-inline-end: 0; margin-top: var(--space-3); background: transparent; }
.content-toolbar { display: flex; align-items: center; gap: var(--space-3); }
.content-toolbar .ant-input-affix-wrapper { max-width: 26rem; }
.content-toolbar--body { padding: var(--space-3) var(--space-4); justify-content: space-between; }
.device-workspace { display: grid; height: 100%; min-height: 0; }
.device-content { min-width: 0; min-height: 0; overflow: auto; }
.device-list { padding: 0 var(--space-4); }
.device-list .ant-list-item { padding: var(--space-1) 0; border: 0; }
.device-item.ant-btn { display: flex; align-items: center; gap: var(--space-3); width: 100%; height: auto; padding: var(--space-3); text-align: start; }
.device-item.is-selected { background: var(--accent-soft); }
.device-item > span:nth-child(2) { flex: 1; }
.device-item b, .device-item small { display: block; }
.device-item small { margin-top: var(--space-1); color: var(--ink-2); }
.device-inspector { grid-column: 2; grid-row: 1; min-width: 0; overflow: auto; padding: var(--space-4); background: var(--bg-sunken); }
.device-inspector h2 { margin: 0 0 var(--space-3); font-size: var(--fs-18); }
.fixture dl { margin: var(--space-5) 0; }
.fixture dt { color: var(--ink-2); font-size: var(--fs-12); }
.fixture dd { margin: var(--space-1) 0 var(--space-4); }
.fixture label[for] { display: block; margin-bottom: var(--space-2); }
</style>
