<template>
  <a-modal open :title="$t('BatchImport.index.250528-1')" :width="width" :mask-closable="false" @cancel="emits('close')">
    <slot name="alert">
      <div class="alert" v-if="message">
        <div>
          <AIcon type="InfoCircleFilled" style="color: var(--accent); margin-right: 0.625rem;"/>
        </div>
        <span v-html="message"></span>
      </div>
    </slot>
    <slot name="content"></slot>
    <p>{{ $t('BatchImport.index.250528-2') }}</p>
    <a-upload-dragger
        v-model:fileList="value"
        name="file"
        :action="FileStaticPath()"
        :headers="getUploadHeaders()"
        :maxCount="1"
        :showUploadList="false"
        @change="uploadChange"
        :accept="'.xlsx,.csv'"
        :before-upload="beforeUpload"
        :disabled="disabled"
    >
      <div class="draggable-box">
        <AIcon class="icon" type="PlusCircleFilled"/>
        <span style="margin: 1rem 0 0.5rem 0">{{ $t('BatchImport.index.250528-3') }}</span>
        <span>{{ $t('BatchImport.index.250528-4') }}</span>
      </div>
    </a-upload-dragger>
    <div class="result" v-if="loading">
      <div v-if="result.loading">
        <a-spin size="small" style="margin-right: 0.625rem"/>
        {{ $t('BatchImport.index.250528-5') }}
      </div>
      <div v-else>
        <AIcon style="color: var(--ok); margin-right: 0.625rem;font-size: var(--fs-16);" type="CheckCircleOutlined"/>
        {{ $t('BatchImport.index.250528-6') }}
      </div>
      <div>{{ $t('BatchImport.index.250528-7') }}{{ result.success }}</div>
      <div>
        {{ $t('BatchImport.index.250528-8') }}<span style="color: var(--err)">{{ result.error }}</span>
        <a
            v-if="result.errMessage && result.error > 0"
            style="margin-left: 1.25rem"
            @click="downError"
        >
          {{ $t('BatchImport.index.250528-9') }}
        </a>
      </div>
    </div>
    <div class="file-download" v-if="downloadUrlBuilder">
      <p>{{ $t('BatchImport.index.250528-10') }}</p>
      <a-space>
        <a-button :loading="templateLoading" ghost type="primary" @click="downTemplate('xlsx')">
          {{ $t('BatchImport.index.250528-11') }}
        </a-button>
        <a-button :loading="templateLoading" ghost type="primary" @click="downTemplate('csv')">
          {{ $t('BatchImport.index.250528-12') }}
        </a-button>
      </a-space>
    </div>

    <template #footer>
      <a-button :loading="result.loading" @click="emits('close')">{{ $t('Detail.index.551010-9') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup name="BatchImport">
import {FileStaticPath} from "@jetlinks-web-core/api/comm";
import {downloadFileByUrl, onlyMessage} from "@jetlinks-web/utils";
import {useI18n} from "vue-i18n";
import { getUploadHeaders } from '../../utils'

const props = defineProps({
  beforeUpload: {
    type: Function,
    default: undefined
  },
  message: {
    type: String,
    default: '',
  },
  downloadUrlBuilder: {
    type: Function,
    default: undefined
  },
  templateName: {
    type: String,
    default: ''
  },
  request: {
    type: Function,
    default: undefined
  },
  width: {
    type: Number || String,
    default: 600
  },
})
const emits = defineEmits(['close', 'save'])

const {t: $t} = useI18n();
const value = ref()
const loading = ref(false)
const result = reactive({
  loading: false,
  success: 0,
  error: 0,
  errMessage: undefined
})
const disabled = ref(false)
const templateLoading = ref(false)

const submitData = (url) => {
  if (props.request) {
    result.loading = true
    result.success = 0
    result.error = 0
    result.errMessage = undefined
    props.request(url).subscribe({
      next: data => {// 处理数据
        console.log('Received data:', data)
        if(data.success ){
          result.success = data.result.total
        }else{
          if(data.detailFile){
            result.errMessage = data.detailFile
          }else{
            result.error = data.result.total
          }
        }

        // if(data.success) {
        //   result.success = data.result.added + data.result.updated
        // } else if(!data.success && data.rowNumber !== -1) {
        //   result.error = data.result.total
        // } else if(!data.success && data.rowNumber === -1) {
        //   result.errMessage = data.detailFile
        // }
        // result.success
      },
      error: err => {
        console.error('Error:', err)
        //   result.error
        // result.errMessage
      },
      complete: () => {
        console.log('Stream complete')
        emits('save')
        disabled.value = false
        result.loading = false
      }
    });
  } else {
    disabled.value = false
  }
}

const uploadChange = async (info) => {
  disabled.value = true;
  loading.value = true
  if (info.file.status === 'done') {
    const resp = info.file.response?.result || {accessUrl: ''};
    submitData(resp?.accessUrl || '');
  } else {
    disabled.value = false;
  }
}

const beforeUpload = (_file, fileList) => {
  if (props.beforeUpload) {
    return props.beforeUpload(_file, fileList)
  }
  const isCsv = _file.type === 'text/csv';
  const isXlsx = _file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!isCsv && !isXlsx) {
    onlyMessage($t('BatchImport.index.250528-13'), 'warning');
  }
  return isCsv || isXlsx;
};

const downError = () => {
  window.open(result.errMessage);
};

const downTemplate = async (type) => {
  templateLoading.value = true;
  const resp = await props.downloadUrlBuilder(type).finally(() => {
    templateLoading.value = false;
  })
  if (resp) {
    const blob = new Blob([resp], {type: type});
    const url = URL.createObjectURL(blob);
    downloadFileByUrl(url, props.templateName || '导入模板', type);
  }
};
</script>

<style scoped>
.alert {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--r-1);
  margin-bottom: var(--space-4);
  background-color: var(--canvas);
  display: flex;
  align-items: center;
}
.draggable-box {
  margin: 2.875rem 0;
  display: flex;
  flex-direction: column;
  color: var(--ink-3);
  align-items: center;
}
.draggable-box .icon {
  font-size: var(--fs-30);
  color: var(--jet-theme-primary, var(--accent));
}
.result,
.file-download {
  margin-top: var(--space-4);
}</style>
