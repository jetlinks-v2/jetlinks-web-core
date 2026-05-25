<template>
  <div class="bacnet-point-detail">
    <section class="point-card">
      <div class="point-card__title">{{ $lang('BACNetIp.point.20260428-1') }}</div>
      <div class="point-card__grid">
        <div class="info-block info-block--blue">
          <div class="info-block__content">
            <div class="info-block__label">
              {{ $lang('BACNetIp.point.20260427-1') }}
              <a-tooltip :title="$lang('BACNetIp.point.20260428-2')">
                <AIcon type="QuestionCircleOutlined" />
              </a-tooltip>
            </div>
            <div class="info-block__value">{{ objectLabel }}</div>
          </div>
        </div>

        <div class="info-block info-block--green">
          <div class="info-block__content">
            <FormItemEditable
              class="inline-edit inline-edit--strong"
              :label="$lang('BACNetIp.point.20260428-3')"
              :name="['configuration', 'propertyId']"
              :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-7') }]"
              v-model:value="formData.configuration.propertyId"
              :componentProps="{ placeholder: $lang('BACNetIp.point.20260427-7'), disabled: true, options: propertyOptions, showSearch: true, filterOption }"
              type="select"
              @change="(val) => onChange(['configuration', 'propertyId'], val)"
            />
          </div>
        </div>

        <div class="info-block info-block--purple">
          <div class="info-block__content">
            <FormItemEditable
              class="inline-edit inline-edit--strong"
              :label="$lang('BACNetIp.point.20260427-8')"
              :name="['configuration', 'valueType']"
              :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-9') }]"
              v-model:value="formData.configuration.valueType"
              :componentProps="{ placeholder: $lang('BACNetIp.point.20260427-9'), options: valueTypeOptions, showSearch: true, filterOption }"
              type="select"
              @change="(val) => onChange(['configuration', 'valueType'], val)"
            />
          </div>
        </div>
      </div>

      <div class="hidden-fields">
        <FormItemEditable
          :name="['configuration', 'objectId', 'type']"
          :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-3') }]"
          v-model:value="formData.configuration.objectId.type"
          :componentProps="{ placeholder: $lang('BACNetIp.point.20260427-3'), disabled: true }"
          type="string"
          @change="(val) => onObjectChange(['configuration', 'objectId'], { ...formData.configuration.objectId, type: val })"
        />
        <FormItemEditable
          :name="['configuration', 'objectId', 'instanceNumber']"
          :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-5') }]"
          v-model:value="formData.configuration.objectId.instanceNumber"
          :componentProps="{ placeholder: $lang('BACNetIp.point.20260427-5'), disabled: true, min: 0, precision: 0, controls: false }"
          type="number"
          @change="(val) => onObjectChange(['configuration', 'objectId'], { ...formData.configuration.objectId, instanceNumber: val })"
        />
      </div>
    </section>
  </div>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'

const { $lang } = useLocales('BACNetIp')
const formData = inject('plugin-form', {})
const detailEvents = inject('plugin-detail-save-events')
const metadataEvents = inject('point-metadata-events')
const propertyIdList = ref([])
const valueTypeList = ref([])

if (!('configuration' in formData)) formData.configuration = {}
if (!('objectId' in formData.configuration) || !formData.configuration.objectId) formData.configuration.objectId = {}
if (!('type' in formData.configuration.objectId)) formData.configuration.objectId.type = undefined
if (!('instanceNumber' in formData.configuration.objectId)) formData.configuration.objectId.instanceNumber = undefined
if (!('propertyId' in formData.configuration)) formData.configuration.propertyId = 'presentValue'
if (!('valueType' in formData.configuration)) formData.configuration.valueType = undefined

const fallbackPropertyIds = ['presentValue', 'statusFlags', 'eventState', 'outOfService', 'units', 'description', 'objectName']
const fallbackValueTypes = ['Boolean', 'String', 'Number', 'Integer', 'UnsignedInteger', 'Real', 'Double', 'Enum']
const propertyOptions = computed(() => (propertyIdList.value.length ? propertyIdList.value : fallbackPropertyIds).map((item) => ({
  label: item?.label || item?.name || item?.text || item,
  value: item?.value || item?.id || item?.key || item,
})))
const valueTypeOptions = computed(() => (valueTypeList.value.length ? valueTypeList.value : fallbackValueTypes).map((item) => ({
  label: item?.label || item?.name || item?.text || item,
  value: item?.value || item?.id || item?.key || item,
})))
const objectLabel = computed(() => `${formData.configuration.objectId.type || '--'} / ${formData.configuration.objectId.instanceNumber ?? '--'}`)
const filterOption = (input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())
const getValueTypes = async () => {
  const resp = await request.post('/data-collect/BACNetIp/command/QueryValueTypes').catch(() => undefined)
  if (resp?.success) valueTypeList.value = resp.result || []
}
const getPropertyIds = async () => {
  const resp = await request.post('/data-collect/BACNetIp/command/QueryPropertyIds', {
    objectId: formData.configuration.objectId,
    propertyId: formData.configuration.propertyId,
  }).catch(() => undefined)
  if (resp?.success) propertyIdList.value = resp.result || []
}
const onChange = (name, value) => {
  detailEvents?.onValueChange?.([{ name, value }])
}
const onObjectChange = (name, value) => {
  onChange(name, value)
  getPropertyIds()
}
watch(
  () => [formData.configuration.objectId?.type, formData.configuration.objectId?.instanceNumber],
  ([type, instanceNumber]) => {
    if (type && instanceNumber !== undefined && instanceNumber !== null) getPropertyIds()
  },
  { immediate: true },
)
watch(
  () => [formData.configuration.objectId?.type, formData.configuration.objectId?.instanceNumber, formData.configuration.propertyId, formData.configuration.valueType],
  ([type, instanceNumber, propertyId, valueType]) => {
    if (type && instanceNumber !== undefined && instanceNumber !== null && propertyId && valueType) {
      metadataEvents?.pointMetadataEvents?.(formData.provider, { configuration: formData.configuration })
    } else {
      metadataEvents?.pointMetadataEvents?.(formData.provider, false)
    }
  },
  { immediate: true, deep: true },
)
getValueTypes()
</script>
<style scoped>
.bacnet-point-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;
}

.point-card {
  padding: 22px 32px 26px;
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  background: #fff;
}

.point-card__title {
  margin-bottom: 24px;
  color: #1f2329;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.point-card__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 64px;
  row-gap: 24px;
}

.info-block {
  display: flex;
  min-width: 0;
  gap: 18px;
}

.info-block__content {
  min-width: 0;
  flex: 1;
}

.info-block__label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #555b66;
  font-size: 15px;
  line-height: 22px;
}

.info-block__value {
  margin-top: 8px;
  overflow: hidden;
  color: #1f2329;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-block__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.tag {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  border-radius: 3px;
  background: #f4f6fa;
  color: #3f4652;
  font-size: 14px;
  line-height: 32px;
}

.tag span {
  flex: none;
  padding: 0 12px;
  background: #eef1f6;
}

.tag strong {
  min-width: 0;
  overflow: hidden;
  padding: 0 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-edit {
  margin: 6px 0 0;
}

.inline-edit--strong :deep(.text) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  color: #1f2329;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-edit--strong :deep(.text:hover) {
  background: transparent;
  color: #1677ff;
}

.inline-edit :deep(.ant-form-item) {
  margin-bottom: 0;
}

.inline-edit :deep(.ant-form-item-control-input) {
  min-height: 28px;
}

.hidden-fields {
  display: none;
}

@media (max-width: 1200px) {
  .point-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
