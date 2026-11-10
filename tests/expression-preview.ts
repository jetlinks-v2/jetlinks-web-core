import { createApp,defineComponent,h } from 'vue'
import { createI18n } from 'vue-i18n'
import { Button,Modal,Dropdown,Menu,MenuItem,MenuItemGroup,MenuDivider,Input,Select,Textarea,Tooltip,Switch,Popover } from 'ant-design-vue'
import * as icons from '@ant-design/icons-vue'
import Preview from './ExpressionPreview.vue'
import 'ant-design-vue/dist/reset.css'
const AIcon=defineComponent({props:{type:String},setup:props=>()=>{const icon=icons[props.type as keyof typeof icons];return icon ? h(icon) : null}})
createApp(Preview).use(createI18n({legacy:false,locale:'zh',messages:{zh:{},en:{}},missingWarn:false,fallbackWarn:false}))
  .component('a-button',Button).component('a-modal',Modal).component('a-dropdown',Dropdown).component('a-menu',Menu).component('a-menu-item',MenuItem).component('a-menu-item-group',MenuItemGroup).component('a-menu-divider',MenuDivider).component('a-input',Input).component('a-select',Select).component('a-textarea',Textarea).component('a-tooltip',Tooltip).component('a-switch',Switch).component('a-popover',Popover).component('AIcon',AIcon).mount('#app')
