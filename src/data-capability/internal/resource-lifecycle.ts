import type { Subscription } from 'rxjs'

type DisposableResource = { dispose?: () => void | Promise<void> }

let runtimeResourceSequence = 0

export function nextRuntimeResourceId(prefix: string): string {
  runtimeResourceSequence += 1
  return `${prefix}:${Date.now()}:${runtimeResourceSequence}`
}

export function safeDispose(target: DisposableResource | undefined, label: string): void {
  try {
    const result = target?.dispose?.()
    if (result && typeof (result as Promise<void>).catch === 'function') {
      void (result as Promise<void>).catch(error => console.warn(`[DataCapability] dispose failed: ${label}`, error))
    }
  } catch (error) {
    console.warn(`[DataCapability] dispose failed: ${label}`, error)
  }
}

export async function safeDisposeAsync(target: DisposableResource | undefined, label: string): Promise<void> {
  try {
    await target?.dispose?.()
  } catch (error) {
    console.warn(`[DataCapability] dispose failed: ${label}`, error)
  }
}

export function safeUnsubscribe(subscription: Subscription | undefined, label: string): void {
  try {
    subscription?.unsubscribe()
  } catch (error) {
    console.warn(`[DataCapability] unsubscribe failed: ${label}`, error)
  }
}
