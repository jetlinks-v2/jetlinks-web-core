<template>
  <div class="creation-banner">
    <div class="banner-card">
      <!-- Header -->
      <div v-if="processState !== ProcessState.SUCCESS" class="header">
        <div class="header-left">
          <span class="title">创建中</span>
          <span class="progress">{{ progressPercent }}%</span>
        </div>

        <button class="cancel-btn" @click="handleCancel" title="取消创建">
          <AIcon type="CloseCircleOutlined"/>
        </button>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- Success -->
        <div
            v-if="processState === ProcessState.SUCCESS"
            class="success"
        >
          <SuccessIllustration/>

          <h3 class="success-title">
            {{ templateName }}应用创建成功
          </h3>

          <div class="success-actions">
            <a-button class="primary-btn" @click="onClick">
              <span>立即跳转</span>
              <span class="countdown">{{ countdown }}s</span>
            </a-button>

            <a-button class="secondary-btn" @click="onClose">
              关闭
            </a-button>
          </div>
        </div>

        <!-- Steps -->
        <div v-else class="steps">
          <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="step"
              :class="{ active: index === activeStepIndex }"
          >
            <div class="icon">
              <AIcon type="LoadingOutlined"
                     v-if="step.status === StepStatus.LOADING"
                     class="loading"
              />
              <AIcon type="CheckCircleOutlined"
                     v-else-if="step.status === StepStatus.COMPLETED"
                     class="completed"
              />
              <div
                  v-else
                  class="dot"
                  :class="{ active: index === activeStepIndex }"
              />
            </div>

            <div class="label">
              <span>{{ step.label }}</span>

              <div
                  v-if="
                  index === activeStepIndex &&
                  step.status === StepStatus.LOADING
                "
                  class="progress-bar"
              >
                <div class="progress-inner"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, watch} from 'vue'
import {CreationStep, StepStatus, ProcessState} from './types'
import {INITIAL_STEPS, REDIRECT_TIMEOUT} from './constants'
import SuccessIllustration from './SuccessIllustration.vue'
import {useMenuStore} from "@jetlinks-web-core/store";
import {randomString} from "@jetlinks-web/utils";

import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

const { createTask } = moduleRegistry.getResource('jetlinks-ai-ui', 'api')

const menuStore = useMenuStore();

const props = defineProps<{
  templateName: string
}>()

const emit = defineEmits<{
  close: []
}>()

const steps = ref<CreationStep[]>(
    INITIAL_STEPS.map(s => ({...s, status: StepStatus.PENDING}))
)

const processState = ref(ProcessState.PROCESSING)
const activeStepIndex = ref(0)
const countdown = ref(REDIRECT_TIMEOUT)
const task = ref({})

const progressPercent = computed(() => {
  const current = steps.value[activeStepIndex.value]
  const completed =
      activeStepIndex.value +
      (current.status === StepStatus.COMPLETED ? 1 : 0)

  return Math.round((completed / steps.value.length) * 100)
})

// 处理步骤进度
watch(
    () => ({
      index: activeStepIndex.value,
      state: processState.value,
      status: steps.value[activeStepIndex.value]?.status
    }),
    ({index, state, status}, _, onCleanup) => {
      if (state !== ProcessState.PROCESSING) return

      if (status === StepStatus.PENDING) {
        const timer = setTimeout(() => {
          steps.value = steps.value.map((s, i) =>
              i === index ? {...s, status: StepStatus.LOADING} : s
          )
        }, 100)
        onCleanup(() => clearTimeout(timer))
      }

      if (status === StepStatus.LOADING) {
        const timer = setTimeout(() => {
          steps.value = steps.value.map((s, i) =>
              i === index ? {...s, status: StepStatus.COMPLETED} : s
          )

          if (index < steps.value.length - 1) {
            activeStepIndex.value++
          } else {
            processState.value = ProcessState.SUCCESS
          }
        }, 600)
        onCleanup(() => clearTimeout(timer))
      }
    },
    {immediate: true}
)

const createData = async () => {
  const _id = randomString()
  const obj = {
    "task": {
      "taskTarget": "IllegalParkingDetection",
      "domain": "ComputerVision",
      "name": "车辆违停检测任务",
      "configuration": {
        "sources": []
      },
      "handleTasks": [],
      "workPlan": {},
      "type": "device"
    },
    "handleTasks": [
      {
        "type": "reviewHandle",
        "id": _id,
        "taskConfig": {
          "windowSpec": {
            "timeSpan": 5,
            "every": 0
          }
        },
        "handleConfig": {
          "type": "reviewHandle",
          "config": {
            "reviewer": {
              "type": "agent",
              "config": {
                "agentId": "illegallyParkedAgent",
                "agentName": "车辆违停检测智能体"
              }
            }
          }
        }
      }
    ]
  }
  const resp = await createTask(obj)
  if (resp.success) {
    task.value = resp.result
  }
}

// 处理成功后的倒计时
watch(
    () => ({state: processState.value, count: countdown.value}),
    ({state, count}, _, onCleanup) => {
      if (state !== ProcessState.SUCCESS) return

      if (count > 0) {
        const timer = setInterval(() => {
          countdown.value--
        }, 1000)
        onCleanup(() => clearInterval(timer))
      } else {
        onClick()
      }
    }
)

function handleCancel() {
  processState.value = ProcessState.CANCELLED
  emit('close')
}

const onClick = () => {
  menuStore.jumpPage(`machine-vision/SceneApplication/Detail`, {
    params: {
      id: task.value.id || 'ecc90137-2b9e-4627-b6b9-4dc748e61107'
    }
  })
}

onMounted(() => {
  createData()
})

function onClose() {
  emit('close')
}
</script>

<style lang="less" scoped>
@blue: #2563eb;
@blue-light: #dbeafe;
@green: #22c55e;
@gray-50: #f9fafb;
@gray-200: #e5e7eb;
@gray-400: #9ca3af;
@gray-600: #4b5563;
@gray-800: #1f2937;

.creation-banner {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 101;
  animation: fadeInSlide 0.3s ease-out;
}

@keyframes fadeInSlide {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.banner-card {
  width: 16rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 0.75rem;
  box-shadow: 0 0.625rem 1.5625rem rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(0.5rem);
  overflow: hidden;
}

.header {
  padding: 0.625rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid @gray-50;

  .header-left {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .title {
    font-size: var(--fs-12);
    font-weight: 700;
    color: @gray-400;
    letter-spacing: 0.08em;
  }

  .progress {
    font-size: var(--fs-12);
    font-weight: 500;
    color: @blue;
    background: @blue-light;
    padding: 0.125rem 0.375rem;
    border-radius: var(--r-2);
  }

  .cancel-btn {
    background: none;
    border: none;
    color: @gray-400;
    cursor: pointer;

    &:hover {
      color: @gray-600;
    }
  }
}

.content {
  padding: 0.875rem 1rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.step {
  display: flex;
  gap: var(--space-2);
  opacity: 0.3;
  transition: opacity 0.3s;

  &.active {
    opacity: 1;
  }
}

.icon {
  width: 0.875rem;
  display: flex;
  justify-content: center;
  align-items: center;

  .dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: @gray-200;

    &.active {
      background: #60a5fa;
    }
  }

  .loading {
    width: 0.875rem;
    height: 0.875rem;
    color: @blue;
  }

  .completed {
    width: 0.875rem;
    height: 0.875rem;
    color: @green;
  }
}

.label {
  flex: 1;

  span {
    font-size: var(--fs-12);
    color: @gray-600;
  }

  .step.active & span {
    color: @gray-800;
    font-weight: 500;
  }
}

.progress-bar {
  height: 0.125rem;
  margin-top: var(--space-1);
  background: @gray-50;
  border-radius: 0.125rem;
  overflow: hidden;

  .progress-inner {
    height: 100%;
    background: @blue;
    animation: loading 0.6s linear;
  }
}

@keyframes loading {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

.success {
  text-align: center;

  .success-title {
    font-size: var(--fs-12);
    font-weight: 600;
    color: @gray-800;
    margin-top: var(--space-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .success-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: 0.625rem;
  }

  .primary-btn {
    flex: 2;
    background: @blue;
    color: #fff;
    font-size: var(--fs-12);
    font-weight: 700;
    padding: 0.375rem;
    border-radius: var(--r-3);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;

    &:hover {
      background: darken(@blue, 5%);
    }

    .countdown {
      background: rgba(255, 255, 255, 0.2);
      padding: 0 0.25rem;
      border-radius: var(--r-1);
    }
  }

  .secondary-btn {
    flex: 1;
    background: none;
    border: none;
    font-size: var(--fs-12);
    font-weight: 700;
    color: @gray-400;
    cursor: pointer;

    &:hover {
      color: @gray-600;
    }
  }
}</style>
