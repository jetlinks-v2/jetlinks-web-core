import { nextTick, onBeforeUnmount, onMounted } from 'vue';

type LifecycleOptions = {
  observePlayerSize: () => void;
  stopObservingPlayerSize: () => void;
  syncPlayback: () => Promise<void>;
  clearNativeSource: () => void;
  destroyJessibuca: () => Promise<void>;
  handleResize: () => void;
};

export function useJessibucaLifecycle(options: LifecycleOptions) {
  onMounted(() => {
    options.observePlayerSize();
    window.addEventListener('resize', options.handleResize);
    void options.syncPlayback();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', options.handleResize);
    options.stopObservingPlayerSize();
    options.clearNativeSource();
    void options.destroyJessibuca();
  });

  return {
    syncAfterNativeReset: () => nextTick(() => options.syncPlayback()),
  };
}
