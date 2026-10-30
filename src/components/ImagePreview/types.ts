/** 图片原始坐标或百分比坐标中的叠加标注。 */
export interface ImagePreviewBox {
  top: number
  left: number
  right: number
  bottom: number
  unit: 'percent' | 'pixel'
  color: 'red' | 'amber' | 'blue' | 'green' | 'violet' | 'cyan' | 'pink'
  label: string
}

export interface ImagePreviewProps {
  open: boolean
  url: string
  title?: string
  boxes?: ImagePreviewBox[]
}
