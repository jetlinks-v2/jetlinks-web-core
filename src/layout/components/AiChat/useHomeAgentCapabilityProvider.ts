import { onBeforeUnmount, watch } from 'vue';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityProvider,
} from './homeAgentCapabilities';

type MaybeProvider = HomeAgentCapabilityProvider | undefined | null;
type ProviderSource = MaybeProvider | (() => MaybeProvider);

const resolveProvider = (source: ProviderSource) => (
  typeof source === 'function' ? source() : source
);

export const useHomeAgentCapabilityProvider = (source: ProviderSource) => {
  let unregister: (() => void) | undefined;
  const stop = watch(
    () => resolveProvider(source),
    (provider) => {
      unregister?.();
      unregister = provider ? registerHomeAgentCapabilityProvider(provider) : undefined;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stop();
    unregister?.();
    unregister = undefined;
  });
};
