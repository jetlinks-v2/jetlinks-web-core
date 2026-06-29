export type FloatingPanelPosition = { x: number; y: number };
export type FloatingPanelSize = { width: number; height: number };
export type FloatingPanelRect = FloatingPanelPosition & FloatingPanelSize;

export type FloatingPanelGeometryOptions = {
  edgeGap?: number;
  bubbleGap?: number;
  anchorOverlap?: number;
  mobileBreakpoint?: number;
  widthRatio?: number;
  heightRatio?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  getAnchorRect?: () => FloatingPanelRect | undefined;
};

const DEFAULT_EDGE_GAP = 16;
const DEFAULT_BUBBLE_GAP = 96;
const DEFAULT_ANCHOR_OVERLAP = 10;
const DEFAULT_MOBILE_BREAKPOINT = 480;
const DEFAULT_WIDTH_RATIO = 0.44;
const DEFAULT_HEIGHT_RATIO = 0.78;

export const createFloatingPanelGeometry = (options: FloatingPanelGeometryOptions = {}) => {
  const edgeGap = options.edgeGap ?? DEFAULT_EDGE_GAP;
  const bubbleGap = options.bubbleGap ?? DEFAULT_BUBBLE_GAP;
  const anchorOverlap = options.anchorOverlap ?? DEFAULT_ANCHOR_OVERLAP;
  const mobileBreakpoint = options.mobileBreakpoint ?? DEFAULT_MOBILE_BREAKPOINT;
  const minWidth = options.minWidth ?? 320;
  const minHeight = options.minHeight ?? 360;
  const maxWidth = options.maxWidth;
  const maxHeight = options.maxHeight;
  const widthRatio = options.widthRatio ?? DEFAULT_WIDTH_RATIO;
  const heightRatio = options.heightRatio ?? DEFAULT_HEIGHT_RATIO;

  const getViewportSize = () => ({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  });

  const getPanelMargin = () => (getViewportSize().width < mobileBreakpoint ? edgeGap / 2 : edgeGap);

  const clampPanelSize = (size: FloatingPanelSize): FloatingPanelSize => {
    const viewport = getViewportSize();
    const margin = getPanelMargin();
    const viewportMaxWidth = Math.max(240, viewport.width - margin * 2);
    const viewportMaxHeight = Math.max(320, viewport.height - margin * 2);
    const effectiveMaxWidth = Math.min(maxWidth ?? viewportMaxWidth, viewportMaxWidth);
    const effectiveMaxHeight = Math.min(maxHeight ?? viewportMaxHeight, viewportMaxHeight);
    const effectiveMinWidth = Math.min(minWidth, effectiveMaxWidth);
    const effectiveMinHeight = Math.min(minHeight, effectiveMaxHeight);

    return {
      width: Math.min(Math.max(size.width, effectiveMinWidth), effectiveMaxWidth),
      height: Math.min(Math.max(size.height, effectiveMinHeight), effectiveMaxHeight),
    };
  };

  const resolveDefaultPanelSize = (): FloatingPanelSize => {
    const viewport = getViewportSize();
    return clampPanelSize({
      width: viewport.width * widthRatio,
      height: viewport.height * heightRatio,
    });
  };

  const clampPanelPosition = (
    position: FloatingPanelPosition,
    size: FloatingPanelSize,
  ): FloatingPanelPosition => {
    const viewport = getViewportSize();
    const margin = getPanelMargin();
    const maxX = Math.max(margin, viewport.width - size.width - margin);
    const maxY = Math.max(margin, viewport.height - size.height - margin);

    return {
      x: Math.min(Math.max(position.x, margin), maxX),
      y: Math.min(Math.max(position.y, margin), maxY),
    };
  };

  const resolveAnchorPosition = (size: FloatingPanelSize) => {
    const anchor = options.getAnchorRect?.();
    if (!anchor) {
      return undefined;
    }

    const viewport = getViewportSize();
    const margin = getPanelMargin();
    const fallbackGap = 8;
    const anchorCenterX = anchor.x + anchor.width / 2;
    const anchorCenterY = anchor.y + anchor.height / 2;
    const topPosition = anchor.y - size.height + anchorOverlap;
    const bottomPosition = anchor.y + anchor.height + fallbackGap;
    const shouldOpenBelow = anchorCenterY < viewport.height / 2;
    const preferredTop = shouldOpenBelow ? bottomPosition : topPosition;
    const fallbackTop = shouldOpenBelow ? topPosition : bottomPosition;

    return {
      x: anchorCenterX < viewport.width / 2
        ? anchor.x - anchorOverlap
        : anchor.x + anchor.width - size.width + anchorOverlap,
      y: preferredTop >= margin && preferredTop + size.height <= viewport.height - margin
        ? preferredTop
        : fallbackTop,
    };
  };

  const resolveInitialPosition = (size: FloatingPanelSize) => {
    const viewport = getViewportSize();
    const margin = getPanelMargin();
    const bottomGap = viewport.width < mobileBreakpoint ? margin : bubbleGap;

    return clampPanelPosition(
      resolveAnchorPosition(size) || {
        x: viewport.width - size.width - margin,
        y: viewport.height - size.height - bottomGap,
      },
      size,
    );
  };

  return {
    clampPanelSize,
    clampPanelPosition,
    resolveDefaultPanelSize,
    resolveInitialPosition,
  };
};
