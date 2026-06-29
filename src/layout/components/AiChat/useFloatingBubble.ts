import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

type BubblePosition = { x: number; y: number };
type BubbleDockSide = 'left' | 'right' | 'free';
type BubbleDragState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};
type FloatingBubbleOptions = {
  onDragMove?: (delta: BubblePosition) => void;
};

const DEFAULT_MARGIN = 10;
const SAFE_MARGIN = 10;
const DOCK_THRESHOLD = 14;
const MOVE_THRESHOLD = 3;

export const useFloatingBubble = (options: FloatingBubbleOptions = {}) => {
  const bubbleRef = ref<HTMLElement>();
  const bubblePosition = ref<BubblePosition>({ x: 0, y: 0 });
  const bubbleDragState = ref<BubbleDragState>();
  const isBubbleReady = ref(false);
  const suppressBubbleClick = ref(false);

  let previousBodyCursor = '';
  let previousBodyUserSelect = '';
  let suppressBubbleClickTimer: number | undefined;

  const isBubbleDragging = computed(() => Boolean(bubbleDragState.value));
  const bubbleDockSide = computed<BubbleDockSide>(() => {
    const rect = bubbleRef.value?.getBoundingClientRect();
    const width = rect?.width || 70;
    const maxX = Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN);
    const currentX = bubblePosition.value.x;

    if (currentX <= SAFE_MARGIN + DOCK_THRESHOLD) {
      return 'left';
    }
    if (currentX >= maxX - DOCK_THRESHOLD) {
      return 'right';
    }
    return 'free';
  });
  const bubbleStyle = computed(() => ({
    left: `${bubblePosition.value.x}px`,
    top: `${bubblePosition.value.y}px`,
  }));
  const bubbleAnchorRect = computed(() => {
    if (!isBubbleReady.value) {
      return undefined;
    }

    const rect = bubbleRef.value?.getBoundingClientRect();
    return {
      x: bubblePosition.value.x,
      y: bubblePosition.value.y,
      width: rect?.width || 70,
      height: rect?.height || 70,
    };
  });

  const clampBubblePosition = (position: BubblePosition) => {
    const rect = bubbleRef.value?.getBoundingClientRect();
    const width = rect?.width || 70;
    const height = rect?.height || 70;

    return {
      x: Math.min(Math.max(position.x, SAFE_MARGIN), Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN)),
      y: Math.min(Math.max(position.y, SAFE_MARGIN), Math.max(SAFE_MARGIN, window.innerHeight - height - SAFE_MARGIN)),
    };
  };

  const initBubblePosition = async () => {
    await nextTick();
    const rect = bubbleRef.value?.getBoundingClientRect();
    const width = rect?.width || 70;
    const height = rect?.height || 70;

    bubblePosition.value = clampBubblePosition({
      x: window.innerWidth - width - DEFAULT_MARGIN,
      y: window.innerHeight - height - DEFAULT_MARGIN,
    });
    isBubbleReady.value = true;
  };

  const restoreBubbleDragEnvironment = () => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.cursor = previousBodyCursor;
    document.body.style.userSelect = previousBodyUserSelect;
  };

  const removeBubbleDragListeners = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('pointermove', handleBubbleDragMove);
    window.removeEventListener('pointerup', handleBubbleDragEnd);
    window.removeEventListener('pointercancel', handleBubbleDragEnd);
  };

  const handleBubbleDragStart = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    if (suppressBubbleClickTimer) {
      window.clearTimeout(suppressBubbleClickTimer);
      suppressBubbleClickTimer = undefined;
    }

    bubbleDragState.value = {
      startX: event.clientX,
      startY: event.clientY,
      originX: bubblePosition.value.x,
      originY: bubblePosition.value.y,
      moved: false,
    };

    if (typeof document !== 'undefined') {
      previousBodyCursor = document.body.style.cursor;
      previousBodyUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    window.addEventListener('pointermove', handleBubbleDragMove);
    window.addEventListener('pointerup', handleBubbleDragEnd, { once: true });
    window.addEventListener('pointercancel', handleBubbleDragEnd, { once: true });
  };

  function handleBubbleDragMove(event: PointerEvent) {
    const currentDragState = bubbleDragState.value;
    if (!currentDragState) {
      return;
    }

    const offsetX = event.clientX - currentDragState.startX;
    const offsetY = event.clientY - currentDragState.startY;
    if (Math.abs(offsetX) > MOVE_THRESHOLD || Math.abs(offsetY) > MOVE_THRESHOLD) {
      currentDragState.moved = true;
    }

    const nextPosition = clampBubblePosition({
      x: currentDragState.originX + offsetX,
      y: currentDragState.originY + offsetY,
    });
    const delta = {
      x: nextPosition.x - bubblePosition.value.x,
      y: nextPosition.y - bubblePosition.value.y,
    };

    bubblePosition.value = nextPosition;
    if (delta.x || delta.y) {
      options.onDragMove?.(delta);
    }
  }

  function handleBubbleDragEnd() {
    if (bubbleDragState.value?.moved) {
      suppressBubbleClick.value = true;
      // Only swallow the synthetic click generated by the drag release, not a later intentional click.
      suppressBubbleClickTimer = window.setTimeout(() => {
        suppressBubbleClick.value = false;
        suppressBubbleClickTimer = undefined;
      }, 120);
    }
    bubbleDragState.value = undefined;
    removeBubbleDragListeners();
    restoreBubbleDragEnvironment();
  }

  const handleWindowResize = () => {
    if (!isBubbleReady.value) {
      void initBubblePosition();
      return;
    }
    bubblePosition.value = clampBubblePosition(bubblePosition.value);
  };

  const consumeBubbleDragClick = () => {
    if (!suppressBubbleClick.value) {
      return false;
    }

    suppressBubbleClick.value = false;
    if (suppressBubbleClickTimer) {
      window.clearTimeout(suppressBubbleClickTimer);
      suppressBubbleClickTimer = undefined;
    }
    return true;
  };

  const moveBubbleBy = (delta: BubblePosition) => {
    bubblePosition.value = clampBubblePosition({
      x: bubblePosition.value.x + delta.x,
      y: bubblePosition.value.y + delta.y,
    });
  };

  onMounted(() => {
    void initBubblePosition();
    window.addEventListener('resize', handleWindowResize);
  });

  onBeforeUnmount(() => {
    removeBubbleDragListeners();
    if (suppressBubbleClickTimer) {
      window.clearTimeout(suppressBubbleClickTimer);
    }
    restoreBubbleDragEnvironment();
    window.removeEventListener('resize', handleWindowResize);
  });

  return {
    bubbleRef,
    bubbleStyle,
    bubbleAnchorRect,
    bubbleDockSide,
    isBubbleReady,
    isBubbleDragging,
    handleBubbleDragStart,
    consumeBubbleDragClick,
    moveBubbleBy,
  };
};
