/** 尺寸钳制前的拖动意图，折叠等布局行为由宿主管理。 */
export interface PanelResizeDragEvent {
  phase: 'start' | 'move' | 'end' | 'cancel'
  initialSize: number
  requestedSize: number
}
