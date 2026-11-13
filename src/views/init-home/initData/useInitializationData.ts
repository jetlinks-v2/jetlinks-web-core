import { onMounted, reactive, ref } from 'vue'
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useI18n } from 'vue-i18n'
import { regular, onlyMessage } from '@jetlinks-web/utils'
import { saveNetwork, getResourcesCurrent, saveProtocol, getProtocol, saveAccessConfig, saveProduct, saveDevice, changeDeploy, deployDevice } from '@jetlinks-web-core/api/initHome'

export function useInitializationData() {
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const flag = ref(false)
  const visible = ref(false)
  const modalForm = reactive<{ host: string; port?: number; publicHost: string; publicPort?: string }>({ host: '0.0.0.0', publicHost: '' })
  const optionPorts = ref<{ label: number; value: number }[]>([])
  const loadingPorts = ref(false)
  const portError = ref('')
  const rulesModule: Record<string, Rule[]> = {
    host: [{ required: true, message: t('init-home.index.011072-17') }],
    port: [{ required: true, message: t('init-home.index.011072-10') }],
    publicHost: [{ required: true, trigger: 'change', validator: async (_rule, value: string) => {
      if (!value) throw new Error(t('init-home.index.011072-7'))
      if (!regular.isIpReg(value) && !regular.isIpv6(value) && !/^[a-zA-Z0-9]+([\-.][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/.test(value)) throw new Error(t('init-home.index.011072-15'))
    } }],
    publicPort: [{ required: true, trigger: 'change', validator: async (_rule, value: string) => {
      if (!value) throw new Error(t('init-home.index.011072-13'))
      if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) throw new Error(t('init-home.index.011072-16'))
    } }],
  }
  async function loadPorts() {
    loadingPorts.value = true; portError.value = ''
    try {
      const response = await getResourcesCurrent()
      if (!response.success) throw new Error('ports')
      const resources = response.result as { host: string; ports?: { TCP?: number[] } }[]
      optionPorts.value = (resources?.find(item => item.host === '0.0.0.0')?.ports?.TCP || []).map(port => ({ label: port, value: port }))
    } catch { portError.value = t('PlatformSettings.loadFailed') }
    finally { loadingPorts.value = false }
  }
  const showModal = () => { if (flag.value) flag.value = false; else visible.value = true }
  const cancel = () => { formRef.value?.resetFields() }
  async function handelSave() {
    try { await formRef.value?.validate() } catch { return }
    onlyMessage(t('init-home.index.011430-6'))
    flag.value = true; visible.value = false
  }
  async function save() {
    if (!flag.value) return true
    if (!formRef.value) return false
    await formRef.value.validate()
    // Each stage consumes identifiers from the previous one; no downstream writes may follow a failed result.
    const network = await saveNetwork({ type: 'MQTT_SERVER', shareCluster: true, name: t('init-home.index.011072-18'), configuration: {
      host: '0.0.0.0', secure: false, port: modalForm.port, publicHost: modalForm.publicHost, publicPort: modalForm.publicPort, maxMessageSize: 8192,
    } })
    if (!network.success || !network.result?.id) return false
    if (!(await saveProtocol()).success) return false
    const protocols = await getProtocol()
    if (!protocols.success) return false
    const protocol = (protocols.result as { id: string; name: string }[] || []).find(item => item.name === t('init-home.index.011072-19'))
    if (!protocol?.id) return false
    const access = await saveAccessConfig({ name: t('init-home.index.011072-20'), provider: 'mqtt-server-gateway', protocol: protocol.id, transport: 'MQTT', channel: 'network', channelId: network.result.id })
    if (!access.success || !access.result?.id) return false
    const product = await saveProduct({ name: t('init-home.index.011072-21'), messageProtocol: protocol.id, protocolName: protocol.name, transportProtocol: 'MQTT', deviceType: 'device', accessId: access.result.id, accessName: access.result.name, accessProvider: 'mqtt-server-gateway' })
    if (!product.success || !product.result?.id) return false
    const device = await saveDevice({ name: t('init-home.index.011072-22'), productId: product.result.id, productName: product.result.name })
    if (!device.success || !device.result?.id) return false
    if (!(await changeDeploy(product.result.id)).success) return false
    return (await deployDevice(device.result.id)).success
  }
  onMounted(loadPorts)
  return { formRef, flag, visible, modalForm, optionPorts, loadingPorts, portError, rulesModule, showModal, cancel, handelSave, save, loadPorts }
}
