import { computed, nextTick, ref } from 'vue';
import {
  createFloatingPanelGeometry,
  type FloatingPanelGeometryOptions,
  type FloatingPanelPosition,
  type FloatingPanelSize,
} from './floatingPanelGeometry';

type DragState = { startX: number; startY: number; originX: number; originY: number };

interface FloatingPanelOptions extends FloatingPanelGeometryOptions {
  initialSize?: FloatingPanelSize;
  onDragMove?: (delta: FloatingPanelPosition) => void;
  onSizeChange?: (size: FloatingPanelSize) => void;
}

type ResizeDirection = 'right' | 'bottom' | 'corner';
type ResizeState = { direction: ResizeDirection; startX: number; startY: number; originWidth: number; originHeight: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DRAG_IGNORED_SELECTORS = [
  'button', 'a', 'input', 'textarea', 'select', '[role="button"]',
  '.ant-dropdown', '.ant-dropdown-menu', '.ai-chat-bubble-panel__icon-action',
  '.agent-access__conversation-action',
].join(',');

export const useFloatingPanel = (options: FloatingPanelOptions = {}) => {
  const panelRef = ref<HTMLElement>();
  const geometry = createFloatingPanelGeometry(options);
  const initialManualSize = options.initialSize
    ? geometry.clampPanelSize(options.initialSize)
    : undefined;
  const panelPosition = ref<FloatingPanelPosition>({ x: 0, y: 0 });
  const panelSize = ref<FloatingPanelSize | undefined>(initialManualSize);
  const isPositionReady = ref(false);
  const dragState = ref<DragState>();
  const resizeState = ref<ResizeState>();
  const hasManualSize = ref(Boolean(initialManualSize));

  let previousBodyCursor = '';
  let previousBodyUserSelect = '';

  const isDragging = computed(() => Boolean(dragState.value));
  const isResizing = computed(() => Boolean(resizeState.value));
  const panelStyle = computed(() => {
    const currentSize = panelSize.value || geometry.resolveDefaultPanelSize();
    const anchor = options.getAnchorRect?.();
    const anchorCenter = anchor
      ? {
        x: anchor.x + anchor.width / 2 - panelPosition.value.x,
        y: anchor.y + anchor.height / 2 - panelPosition.value.y,
      }
      : {
        x: currentSize.width - 34,
        y: currentSize.height - 8,
      };
    const anchorX = clamp(anchorCenter.x, 34, Math.max(34, currentSize.width - 34));
    const anchorY = clamp(anchorCenter.y, 34, Math.max(34, currentSize.height - 6));

    // Keep the expansion origin aligned with the launcher even though the panel no longer renders a visual anchor.
    return {
      left: `${panelPosition.value.x}px`,
      top: `${panelPosition.value.y}px`,
      '--ai-chat-panel-anchor-x': `${anchorX}px`,
      '--ai-chat-panel-anchor-y': `${anchorY}px`,
      ...(panelSize.value
        ? {
          width: `${panelSize.value.width}px`,
          height: `${panelSize.value.height}px`,
        }
        : {}),
    };
  });

  const getCurrentPanelSize = (): FloatingPanelSize => {
    if (panelSize.value) {
      return panelSize.value;
    }

    const rect = panelRef.value?.getBoundingClientRect();
    return {
      width: rect?.width || geometry.resolveDefaultPanelSize().width,
      height: rect?.height || geometry.resolveDefaultPanelSize().height,
    };
  };

  const initPanelPosition = async () => {
    await nextTick();

    const panel = panelRef.value;
    if (!panel) {
      return;
    }

    const size = getCurrentPanelSize();

    if (!panelSize.value) {
      panelSize.value = size;
    }
    panelPosition.value = geometry.resolveInitialPosition(size);
    isPositionReady.value = true;
  };

  const handleWindowResize = () => {
    if (!isPositionReady.value) {
      void initPanelPosition();
      return;
    }

    panelSize.value = hasManualSize.value
      ? geometry.clampPanelSize(getCurrentPanelSize())
      : geometry.resolveDefaultPanelSize();
    panelPosition.value = geometry.clampPanelPosition(panelPosition.value, panelSize.value);
    if (hasManualSize.value) {
      options.onSizeChange?.(panelSize.value);
    }
  };

  const shouldIgnoreDragStart = (target: EventTarget | null) => (
    target instanceof Element && Boolean(target.closest(DRAG_IGNORED_SELECTORS))
  );

  const restoreDragEnvironment = () => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.cursor = previousBodyCursor;
    document.body.style.userSelect = previousBodyUserSelect;
  };

  const removeDragListeners = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
    window.removeEventListener('pointercancel', handleDragEnd);
  };

  const handleDragStart = (event: PointerEvent) => {
    if (event.button !== 0 || shouldIgnoreDragStart(event.target)) {
      return;
    }

    event.preventDefault();
    dragState.value = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panelPosition.value.x,
      originY: panelPosition.value.y,
    };

    if (typeof document !== 'undefined') {
      previousBodyCursor = document.body.style.cursor;
      previousBodyUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd, { once: true });
    window.addEventListener('pointercancel', handleDragEnd, { once: true });
  };

  function handleDragMove(event: PointerEvent) {
    const currentDragState = dragState.value;
    if (!currentDragState) {
      return;
    }

    const offsetX = event.clientX - currentDragState.startX;
    const offsetY = event.clientY - currentDragState.startY;
    const nextPosition = geometry.clampPanelPosition(
      {
        x: currentDragState.originX + offsetX,
        y: currentDragState.originY + offsetY,
      },
      getCurrentPanelSize(),
    );
    const delta = {
      x: nextPosition.x - panelPosition.value.x,
      y: nextPosition.y - panelPosition.value.y,
    };

    panelPosition.value = nextPosition;
    if (delta.x || delta.y) {
      options.onDragMove?.(delta);
    }
  }

  function handleDragEnd() {
    dragState.value = undefined;
    removeDragListeners();
    restoreDragEnvironment();
  }

  const handleResizeStart = (direction: ResizeDirection, event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const currentSize = getCurrentPanelSize();
    hasManualSize.value = true;
    resizeState.value = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: currentSize.width,
      originHeight: currentSize.height,
    };

    if (typeof document !== 'undefined') {
      previousBodyCursor = document.body.style.cursor;
      previousBodyUserSelect = document.body.style.userSelect;
      document.body.style.cursor = direction === 'corner' ? 'nwse-resize' : direction === 'right' ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd, { once: true });
    window.addEventListener('pointercancel', handleResizeEnd, { once: true });
  };

  function handleResizeMove(event: PointerEvent) {
    const currentResizeState = resizeState.value;
    if (!currentResizeState) {
      return;
    }

    const nextSize = geometry.clampPanelSize({
      width: currentResizeState.direction === 'bottom'
        ? currentResizeState.originWidth
        : currentResizeState.originWidth + event.clientX - currentResizeState.startX,
      height: currentResizeState.direction === 'right'
        ? currentResizeState.originHeight
        : currentResizeState.originHeight + event.clientY - currentResizeState.startY,
    });

    panelSize.value = nextSize;
    panelPosition.value = geometry.clampPanelPosition(panelPosition.value, nextSize);
    options.onSizeChange?.(nextSize);
  }

  function handleResizeEnd() {
    resizeState.value = undefined;
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', handleResizeEnd);
    window.removeEventListener('pointercancel', handleResizeEnd);
    restoreDragEnvironment();
  }

  const movePanelBy = (delta: FloatingPanelPosition) => {
    const nextPosition = geometry.clampPanelPosition(
      {
        x: panelPosition.value.x + delta.x,
        y: panelPosition.value.y + delta.y,
      },
      getCurrentPanelSize(),
    );
    panelPosition.value = nextPosition;
  };

  const cleanupFloatingPanel = () => {
    removeDragListeners();
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', handleResizeEnd);
    window.removeEventListener('pointercancel', handleResizeEnd);
    restoreDragEnvironment();
  };

  return {
    panelRef, panelStyle, isDragging, isResizing, isPositionReady, initPanelPosition,
    handleWindowResize, handleDragStart, handleResizeStart, movePanelBy, cleanupFloatingPanel,
  };
};
