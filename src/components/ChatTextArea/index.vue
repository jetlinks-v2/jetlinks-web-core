<template>
  <div class="upload-text-area-wrapper" :style="{ height: areaWrapperHeight + 'px' }">
    <div
      class="input-area-content"
      :class="{ 'only-image-mode': isOnlyImageUpload }"
      dragover.prevent="handleDragOver"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @mousedown.stop>
      <div class="file-list" v-if="!isOnlyImageUpload && !isLoading && uploadedFiles.length > 0">
        <div class="file-list-header">
          <span>已选择文件 ({{ uploadedFiles.length }})</span>
          <button class="clear-all-btn" @click="clearAllFiles">清空全部</button>
        </div>

        <div class="progress-items">
          <div class="progress-item" v-for="(file, index) in uploadedFiles" :key="file.uid">
            <div class="file-icon">
              <img class="icon" :src="handleSetFileIcon(file.category)" alt="" />
            </div>
            <div class="file-info">
              <span class="name">{{ file.name }}</span>
              <div class="progress">
                <a-progress :percent="file.percent || 0" :status="file.status" :showInfo="false" />
              </div>
            </div>
            <div class="file-size">
              {{ file.size ? formatFileSize(file.size || 0) : '--' }}
            </div>
            <div class="file-action">
              <a-button type="text" size="small" @click="removeFile(index)" danger>
                <AIcon type="DeleteOutlined" />
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <div class="only-image-wrapper" v-if="isOnlyImageUpload && !isLoading && uploadedFiles.length > 0">
        <div class="image-items">
          <div class="image-item" v-for="(file, index) in uploadedFiles" :key="file.uid">
            <img class="image" :src="file.url" :alt="file.name" />
            <a-button class="delete-btn" type="text" size="small" @click="removeFile(index)" danger>
              <AIcon type="DeleteOutlined" />
            </a-button>
          </div>
        </div>
      </div>

      <div class="textarea">
        <textarea ref="textareaRef" wrap="hard" :value="inputMessage" :disabled="isInputDisabled" @input="handleInput" @keydown="handleTextAreaKeydown" :placeholder="textareaEditorPlaceholder" />
        <div class="drag-overlay" v-if="isDragOver">
          <div class="icon">📁</div>
          <div class="text">释放文件到此处</div>
        </div>
      </div>
    </div>

    <div class="button-area">
      <slot name="leftOperate"></slot>

      <a-space :size="16">
        <slot name="rightOperate"></slot>
        <a-button v-if="isLoading" shape="circle" type="primary" loading />
        <a-button v-else shape="circle" type="primary" :disabled="disabled" :icon="h(ArrowUpOutlined)" @click="handleSendMessage" />
      </a-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, watch, inject, onMounted, onBeforeUnmount } from 'vue';
import { pick, cloneDeep } from 'lodash-es';
import { onlyMessage } from '@jetlinks-web/utils';
import { ArrowUpOutlined } from '@ant-design/icons-vue';
import { handleSliceUploadFile, ConcurrencyControl } from '@jetlinks-web-core/utils';
import { formatFileSize, handleSetFileIcon } from './utils';
import { fileShardingUpload } from '@jetlinks-web-core/api/comm';

interface FileWithUid extends File {
  uid?: string;
}

interface IUploadFile {
  uid: string;
  name: string;
  type: string;
  category: string;
  percent: number;
  url: string;
  size: number;
  status: 'active' | 'exception' | 'success';
}

interface Props {
  isLoading?: boolean;
  inputHeight?: number;
  uploadCategories?: string[]; // 上传文件类型
  textareaPlaceholder?: string;
  disabledWithValueTextareaPlaceholder?: string; // 禁止输入后有值显示
  originFiles?: FileWithUid[]; // 待上传的文件
  uploadedFiles?: FileWithUid[]; // 已上传的文件
  isClearAll?: boolean; // 是否清空所有数据
  defaultInput?: string; // 默认输入框输入的值
  isInputDisabled?: boolean; // 输入框是否禁止输入
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  inputHeight: 148,
  originFiles: () => [],
  uploadedFiles: () => [],
  uploadCategories: () => ['video', 'document', 'image', 'audio'],
  isClearAll: false,
  defaultInput: '',
  isInputDisabled: false,
  disabledWithValueTextareaPlaceholder: '',
  textareaPlaceholder: '请描述你的问题或拖拽文件到此处...(Enter发送，Ctrl+Enter换行)',
});

interface Emits {
  (e: 'send', message: string, files: any[]): void;
  (e: 'update:inputHeight', value: number): void;
  (e: 'update:inputMessage', value: string): void;
}

const emit = defineEmits<Emits>();

const inputMessage = ref('');
const isLoading = ref(false);
const isDragOver = ref(false);
const isUploadingFiles = ref(false);
const uploadedFiles = ref<IUploadFile[]>([]);

const isOnlyImageUpload = computed(() => props.uploadCategories?.length === 1 && props.uploadCategories?.[0] === 'image');

const areaWrapperHeight = computed(() => {
  if (!uploadedFiles.value.length) {
    return 148;
  }

  return isOnlyImageUpload.value ? 236 : 350;
});

const textareaEditorPlaceholder = computed(() => {
  if (props.isInputDisabled && uploadedFiles.value.length) {
    return props.disabledWithValueTextareaPlaceholder;
  }

  return props.textareaPlaceholder;
});

const FileValidationRules: Record<
  string,
  {
    extensions: string[];
    maxSizeMB: number;
    limitErrorMsg: string;
  }
> = {
  video: {
    extensions: ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
    maxSizeMB: 200,
    limitErrorMsg: '视频类文件大小不能超过200M',
  },
  document: {
    extensions: ['.pdf', '.docx', '.txt', '.md'],
    maxSizeMB: 50,
    limitErrorMsg: '文档类文件大小不能超过50M',
  },
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSizeMB: 10,
    limitErrorMsg: '图片类文件大小不能超过10M',
  },
  audio: {
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.aiff', '.opus'],
    maxSizeMB: 100,
    limitErrorMsg: '音频类文件大小不能超过100M',
  },
};

const customUploadFileValidationRules = computed(() => {
  return props.uploadCategories.length ? pick(cloneDeep(FileValidationRules), props.uploadCategories) : cloneDeep(FileValidationRules);
});

const MAX_CONTROL = 6;
const uploadController = new ConcurrencyControl(MAX_CONTROL);

const clearAllFiles = () => {
  uploadedFiles.value = [];

  if (props.isClearAll) {
    handleInitReset();
  }
};

const removeFile = (index: number) => {
  uploadedFiles.value.splice(index, 1);
};

// 根据当前允许的文件类型生成错误消息
const getSupportedFormats = () => {
  const rules = customUploadFileValidationRules.value as Record<string, { extensions: string[]; maxSizeMB: number; limitErrorMsg: string }>;
  const allExtensions = Object.keys(rules).reduce((acc, category) => {
    return [...acc, ...rules[category].extensions];
  }, [] as string[]);

  return allExtensions.join('、').replace(/\./g, '');
};

const handleDragOver = (e: DragEvent) => {
  if (props.isLoading) {
    return;
  }
  e.preventDefault();
  isDragOver.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  if (props.isLoading) {
    return;
  }
  e.preventDefault();
  isDragOver.value = false;
};

const handleDrop = async (e: DragEvent) => {
  if (props.isLoading) {
    return false;
  }

  e.preventDefault();
  isDragOver.value = false;

  const files = e.dataTransfer?.files as unknown as FileWithUid[];
  await handleUploadFiles(files);
};

const handleUploadFiles = async (files: FileWithUid[]) => {
  if (!files || files.length === 0) {
    return false;
  }

  const fileArray = Array.from(files);

  const uploadPromises = fileArray.map(async file => {
    const fileWithUid = file as FileWithUid;

    if (!fileWithUid.uid) {
      fileWithUid.uid = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    // 检查文件扩展名
    if (!extension || extension === '.') {
      onlyMessage(`文件 ${file.name} 缺少有效的文件扩展名`, 'error');
      return false;
    }

    // 检查是否已存在同名文件
    const existingFile = uploadedFiles.value.find(f => f.name === file.name);
    if (existingFile) {
      onlyMessage(`文件 ${file.name} 已存在`, 'error');
      return false;
    }

    // 检查文件类型是否支持
    const category =
      Object.keys(customUploadFileValidationRules.value).find(category => {
        const rules = customUploadFileValidationRules.value as Record<string, { extensions: string[]; maxSizeMB: number; limitErrorMsg: string }>;
        return rules[category]?.extensions.includes(extension);
      }) || '';

    if (!category) {
      const supportedFormats = getSupportedFormats();
      const errorMsg = `不支持的文件格式！仅允许上传：${supportedFormats}`;
      onlyMessage(errorMsg, 'error');
      return false;
    }

    // 检查文件大小
    const rules = customUploadFileValidationRules.value as Record<string, { extensions: string[]; maxSizeMB: number; limitErrorMsg: string }>;
    const maxSizeBytes = rules[category].maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      onlyMessage(rules[category].limitErrorMsg, 'error');
      return false;
    }

    isUploadingFiles.value = true;
    const rowFile: IUploadFile = {
      name: file.name.length > 64 ? file.name.substring(0, 64) : file.name,
      type: 'file',
      url: '',
      category,
      uid: fileWithUid.uid!,
      size: file.size,
      percent: 0,
      status: 'active',
    };

    // 添加到上传列表
    uploadedFiles.value.push(rowFile);

    const currentFileIndex = uploadedFiles.value.findIndex(item => item.uid === file.uid);

    try {
      let uploadNum = 0;
      const result = (await handleSliceUploadFile(file)) as any[];

      const uploadPromises = result.map(chunk => {
        return uploadController.add(async () => {
          try {
            const fd = new FormData();
            fd.append('file', chunk.chunkFile as File, chunk.fileName);

            const uploadResult = await fileShardingUpload(`${chunk.fileHash}.${chunk.fileType}`, chunk.chunkOffset, chunk.fileSize, fd);
            uploadNum += 1;

            // 更新进度
            if (uploadedFiles.value[currentFileIndex] && uploadedFiles.value[currentFileIndex].uid) {
              uploadedFiles.value[currentFileIndex].percent = Math.max(0, Math.min(100, (uploadNum / result.length) * 100));
            }

            return uploadResult.result;
          } catch (error) {
            onlyMessage(`文件 ${file.name} 处理失败`, 'error');
            throw error;
          }
        });
      });

      // 等待所有切片上传完成
      const uploadResults = (await Promise.allSettled(uploadPromises)) as any[];
      const lastChunkRes = uploadResults.filter(item => item.value?.accessUrl);

      if (lastChunkRes && lastChunkRes.length) {
        const value = lastChunkRes[0]?.value;
        uploadedFiles.value[currentFileIndex].status = 'success';
        uploadedFiles.value[currentFileIndex].url = value.accessUrl;
      }

      return true;
    } catch (error) {
      onlyMessage(`文件 ${file.name} 处理失败`, 'error');
      // 上传失败时更新状态
      if (uploadedFiles.value[currentFileIndex]) {
        uploadedFiles.value[currentFileIndex].status = 'exception';
      }
      return false;
    }
  });

  try {
    const results = await Promise.allSettled(uploadPromises);

    const failedCount = results.filter(result => result.status === 'rejected').length;
    if (failedCount > 0) {
      onlyMessage(`有${failedCount}个文件上传失败`, 'warning');
    }
    // 返回上传是否成功（至少有一个文件上传成功）
    return results.some(result => result.status === 'fulfilled' && result.value === true);
  } catch (error) {
    return false;
  } finally {
    isUploadingFiles.value = false;
  }
};

watch(
  () => props.originFiles,
  async newFiles => {
    if (Array.isArray(newFiles) && newFiles.length) {
      await handleUploadFiles(newFiles);
    }
  },
  { deep: true }
);

watch(
  () => props.uploadedFiles,
  async newFiles => {
    if (Array.isArray(newFiles)) {
      uploadedFiles.value = newFiles as unknown as IUploadFile[];
    }
  },
  { deep: true }
);

watch(
  () => uploadedFiles.value.length,
  () => {
    emit('update:inputHeight', areaWrapperHeight.value);
  },
  { deep: true }
);

watch(
  () => props.defaultInput,
  val => {
    if (typeof val === 'string') {
      inputMessage.value = val;
    }
  },
  { deep: true }
);

const handleInput = (event: Event) => {
  inputMessage.value = (event.target as HTMLTextAreaElement)?.value;
};

const handleTextAreaKeydown = async (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.keyCode === 13) {
    if (event.ctrlKey || event.metaKey) {
      inputMessage.value += '\n';
      event.preventDefault();
    } else {
      await handleSendMessage();
      event.preventDefault();
    }
  }
};

const disabled = computed(() => {
  return !inputMessage.value && !uploadedFiles.value.length;
});

const handleSendMessage = async (): Promise<void> => {
  if (isUploadingFiles.value) {
    onlyMessage('文件正在上传中，请稍候...', 'error');
    return;
  }

  emit('send', inputMessage.value, uploadedFiles.value);

  setTimeout(() => {
    uploadedFiles.value = [];
  }, 100);
};

// 重置所有数据
const handleInitReset = () => {
  isLoading.value = false;
  isDragOver.value = false;
  inputMessage.value = '';
  uploadedFiles.value = [];
};

const registerReset = inject<(fn?: () => void) => void>('CHAT_TEXT_AREA_RESET_REGISTER');

onMounted(() => registerReset?.(handleInitReset));

onBeforeUnmount(() => registerReset?.(undefined));
</script>

<style scoped>
.upload-text-area-wrapper {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--r-2);
  background: var(--bg);
  box-sizing: border-box;
  border: 0.03125rem solid var(--line);
}
.upload-text-area-wrapper .input-area-content {
  flex: 1;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-3);
  box-sizing: border-box;
}
.upload-text-area-wrapper .input-area-content.only-image-mode .only-image-wrapper {
  border-top-left-radius: var(--r-2);
  border-top-right-radius: var(--r-2);
  box-sizing: border-box;
  background: var(--bg-hover);
  border-bottom: 0.03125rem solid var(--line);
}
.upload-text-area-wrapper .input-area-content.only-image-mode .only-image-wrapper .image-items {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  box-sizing: border-box;
}
.upload-text-area-wrapper .input-area-content.only-image-mode .only-image-wrapper .image-item {
  flex-shrink: 0;
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: var(--r-2);
  background: var(--line-strong);
}
.upload-text-area-wrapper .input-area-content.only-image-mode .only-image-wrapper .image-item .image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--r-2);
}
.upload-text-area-wrapper .input-area-content.only-image-mode .only-image-wrapper .image-item .delete-btn {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  width: 1.125rem;
  height: 1.125rem;
  min-width: 1.125rem;
  padding: 0;
  border-radius: 0.5625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
}
.upload-text-area-wrapper .input-area-content .file-list {
  border-top-left-radius: var(--r-2);
  border-top-right-radius: var(--r-2);
  box-sizing: border-box;
  border-bottom: 0.03125rem solid var(--line);
  overflow: hidden;
  background: var(--bg-hover);
}
.upload-text-area-wrapper .input-area-content .file-list .file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--ink-2);
}
.upload-text-area-wrapper .input-area-content .file-list .clear-all-btn {
  padding: 0.25rem 0.75rem;
  background: var(--err);
  color: var(--accent-ink);
  border: none;
  border-radius: var(--r-2);
  font-size: var(--fs-12);
  cursor: pointer;
  transition: background-color 0.3s ease;
}
.upload-text-area-wrapper .input-area-content .file-list .clear-all-btn:hover {
  background: var(--err);
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items {
  width: 100%;
  max-height: 9.375rem;
  overflow-y: auto;
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line-strong);
  box-sizing: border-box;
  transition: background-color 0.3s ease;
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin-right: var(--space-4);
  border-radius: var(--r-2);
  background: var(--line-strong);
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-icon .icon {
  width: 1.25rem;
  height: 1.25rem;
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-info {
  flex: 1;
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-info .name {
  margin-bottom: var(--space-2);
  font-size: var(--fs-15);
  line-height: 1.375rem;
  color: var(--ink-1);
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-size {
  width: 5.625rem;
  margin-left: var(--space-6);
  font-size: var(--fs-14);
  line-height: 1.375rem;
  text-align: left;
  color: var(--ink-4);
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item .file-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 1rem;
  background: var(--accent-soft);
  cursor: pointer;
}
.upload-text-area-wrapper .input-area-content .file-list .progress-items .progress-item:last-child {
  border-bottom: none;
}
.upload-text-area-wrapper .input-area-content .textarea {
  position: relative;
  flex: 1;
  flex-shrink: 0;
  min-height: 0;
  width: 100%;
}
.upload-text-area-wrapper .input-area-content .textarea .drag-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  border-radius: 0.125rem;
  pointer-events: none;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.upload-text-area-wrapper .input-area-content .textarea .drag-overlay .text {
  font-size: var(--fs-16);
  color: var(--accent);
}
.upload-text-area-wrapper .input-area-content .textarea .drag-overlay .icon {
  margin-top: -0.375rem;
  font-size: var(--fs-20);
}
.upload-text-area-wrapper .input-area-content .textarea textarea {
  width: 100%;
  height: 100%;
  font-size: var(--fs-14);
  line-height: 1.375rem;
  border: none;
  outline: none;
  resize: none;
  box-sizing: border-box;
}
.upload-text-area-wrapper .input-area-content .textarea textarea:disabled {
  cursor: not-allowed;
  background: var(--canvas);
}
.upload-text-area-wrapper .button-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 2rem;
}</style>
