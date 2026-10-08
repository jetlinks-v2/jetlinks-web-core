import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const drawerSource = readFileSync(
  fileURLToPath(new URL('../src/layout/components/AiChat/AiChatDrawer.vue', import.meta.url)),
  'utf8',
)
const sessionParametersSource = readFileSync(
  fileURLToPath(new URL('../../modules/jetlinks-ai-agent-ui/components/AgentConversation/sessionParameters.ts', import.meta.url)),
  'utf8',
)

test('floating assistant composes the page-owned before-send hook before shared bridges', () => {
  assert.match(drawerSource, /const conversationBeforeSendChat = computed/)
  assert.match(drawerSource, /props\.parameters\?\.beforeSendChat/)

  const handler = drawerSource.indexOf('const handleConversationBeforeSend')
  const pageHook = drawerSource.indexOf('conversationBeforeSendChat.value?.(scopedPayload)', handler)
  const sharedBridges = drawerSource.indexOf('conversationBridges.beforeSend(scopedPayload)', handler)
  assert.ok(handler >= 0 && pageHook > handler && sharedBridges > pageHook)
})

test('page-owned before-send hook stays out of serialized session parameters', () => {
  assert.match(drawerSource, /beforeSendChat,[\s\S]*?onConversationMessage,[\s\S]*?\.\.\.rest/)
  assert.match(sessionParametersSource, /'beforeSendChat'/)
})
