import { createApp, defineComponent, h } from 'vue'
import Antd from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import { ApartmentOutlined, PlusOutlined, DownOutlined, FunctionOutlined, FieldStringOutlined, CloseOutlined, CodeOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons-vue'
import Preview from './ProcessPreview.vue'
import 'ant-design-vue/dist/reset.css'
const icons = {ApartmentOutlined,PlusOutlined,DownOutlined,FunctionOutlined,FieldStringOutlined,CloseOutlined,CodeOutlined,ExpandOutlined,CompressOutlined}
const AIcon = defineComponent({props:{type:String},setup:props=>()=>props.type && Reflect.get(icons,props.type) ? h(Reflect.get(icons,props.type)) : null})
createApp(Preview).use(Antd).use(createI18n({legacy:false,locale:'zh',fallbackLocale:'en',messages:{zh:{},en:{}}})).component('AIcon',AIcon).mount('#app')
