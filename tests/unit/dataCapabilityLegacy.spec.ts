import assert from 'node:assert/strict'
import { firstValueFrom, Observable } from 'rxjs'

import {
  createLegacyCommandProvider,
  type CapabilityContext,
} from '../../src/data-capability'

const context: CapabilityContext = {}
let listContext: CapabilityContext | undefined

const provider = createLegacyCommandProvider({
  providerId: 'unit.legacy-command',
  moduleId: 'unit-ui',
  async listCommands(contextValue) {
    listContext = contextValue
    return {
      commands: [
        {
          serviceId: 'device-service',
          commandId: 'query-properties',
          commandName: '查询属性',
          groupName: '设备',
          forQuery: true,
          metadata: { mode: 'snapshot', tags: ['query'] },
        },
        {
          serviceId: 'device-service',
          commandId: 'reboot',
          commandName: '重启',
          groupName: '设备',
          forAction: true,
          metadata: { action: 'control', risk: 'high', tags: ['action'] },
        },
        {
          serviceId: 'device-service',
          commandId: 'subscribe-properties',
          commandName: '订阅属性',
          forQuery: true,
          metadata: { mode: 'stream' },
        },
      ],
    }
  },
  async execute(command, input) {
    return { command, input }
  },
  subscribe(command, input) {
    return new Observable((subscriber) => {
      subscriber.next({ command, input, value: 1 })
      subscriber.complete()
    })
  },
})

const loaded = await provider.load?.()
assert.deepEqual(listContext, {})
assert.equal(loaded?.sources?.length, 2)
assert.equal(loaded?.operations?.length, 1)
assert.equal(loaded?.sources?.[0].id, 'legacy.command.datasource.device-service.query-properties')
assert.equal(loaded?.operations?.[0].id, 'legacy.command.operation.device-service.reboot')
assert.equal(loaded?.operations?.[0].policy.risk, 'high')

const snapshotSource = loaded!.sources![0]
const snapshotRuntime = await snapshotSource.create({}, context)
const snapshotResult = await firstValueFrom(snapshotRuntime.query({ query: { id: 'd1' } }, { ...context, runtimeId: 'unit-test' }))
assert.equal((snapshotResult.data as any).input.id, 'd1')

const streamSource = loaded!.sources![1]
const streamRuntime = await streamSource.create({}, context)
const streamResult = await firstValueFrom(streamRuntime.query({ query: { id: 'd1' } }, { ...context, runtimeId: 'unit-test' }))
assert.equal((streamResult.data as any).value, 1)
