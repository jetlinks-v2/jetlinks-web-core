import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'

import {
  useAiChatComposerIntent,
} from '../src/layout/components/AiChat/useAiChatComposerIntent.ts'
import {
  GENERAL_AGENT_COMPOSER_INTENT_EVENT,
} from '../src/layout/components/AiChat/generalAgentExtensions.ts'

test('floating composer intent focuses the current input and scopes params to one send', async () => {
  const target = new EventTarget()
  const resetKey = ref('conversation-a')
  const focused = []
  const prefilled = []
  const scope = effectScope()
  const intent = scope.run(() => useAiChatComposerIntent({
    target: ref(target),
    resetKey: () => resetKey.value,
    focusInput: () => focused.push(true),
    prefillInput: value => prefilled.push(value),
  }))
  await nextTick()

  target.dispatchEvent(new CustomEvent(GENERAL_AGENT_COMPOSER_INTENT_EVENT, {
    detail: {
      action: 'focus',
      placeholder: '描述你想生成的大屏',
      nextSendParams: {
        bigscreenGenerationIntent: {
          strategy: 'requirement-compose',
          action: 'confirm-requirement',
        },
      },
    },
  }))
  await nextTick()

  assert.equal(intent.placeholder.value, '描述你想生成的大屏')
  assert.equal(focused.length, 1)
  assert.deepEqual(prefilled, [])
  assert.deepEqual(intent.consumeNextSendParams({
    content: '生成设备告警大屏',
    params: { existing: true },
  }).params, {
    existing: true,
    bigscreenGenerationIntent: {
      strategy: 'requirement-compose',
      action: 'confirm-requirement',
    },
  })
  assert.deepEqual(intent.consumeNextSendParams({ content: '下一条消息' }), {
    content: '下一条消息',
  })

  target.dispatchEvent(new CustomEvent(GENERAL_AGENT_COMPOSER_INTENT_EVENT, {
    detail: {
      action: 'prefill',
      value: '继续完善大屏',
      nextSendParams: { marker: 'pending' },
    },
  }))
  await nextTick()
  assert.deepEqual(prefilled, ['继续完善大屏'])

  resetKey.value = 'conversation-b'
  await nextTick()
  assert.equal(intent.placeholder.value, '')
  assert.equal(intent.consumeNextSendParams({ content: '新会话消息' }).params, undefined)
  scope.stop()
})
