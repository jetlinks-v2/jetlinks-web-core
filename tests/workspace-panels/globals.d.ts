import type { DefineComponent } from 'vue'
import 'ant-design-vue/typings/global'

declare module 'vue' {
  interface GlobalComponents {
    AIcon: DefineComponent<{ type: string }>
  }
}
