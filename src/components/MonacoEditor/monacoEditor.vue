<!-- 代码编辑器 -->
<template>
  <div ref="dom" class="j-monaco-editor"></div>
</template>

<script setup>
import {
  ref,
  onMounted,
  watch,
  onUnmounted,
  nextTick
} from 'vue';
import * as monaco from 'monaco-editor';
import { omit } from 'lodash-es';

defineOptions({
  name: 'MonacoEditor'
})

const props = defineProps({
  modelValue: [String, Number],
  theme: {type: String, default: 'vs-dark'},
  language: {type: String, default: 'json'},
  codeTips: {type: Array, default: () => []},
  init: {type: Function, default: undefined},
  registrationTips: {type: Object, default: () => ({})},
  registrationTypescript: {type: Object, default: () => ({})},
  blurFormat: {type: Boolean, default: true},
  readOnly: {type: Boolean, default: false},
  options: {type: Object, default: () => ({})},
});

const emit = defineEmits([
  'update:modelValue',
  'blur',
  'focus',
  'change',
  'errorChange',
]);

const dom = ref();

let instance
let modelInstance
let markerDisposable
let formatTimer
let readOnlyTimer
let initialFormatTimer

const monacoProviderRef = ref();
const monacoTypescriptProviderRef = ref();

// codeTipItem.dispose() // 销毁自定义提示

const handleSuggestions = (suggestions, range) => {
  return Array.isArray(suggestions)
    ? suggestions.map((item) => ({...item, range}))
    : [];
};

const disposeRegister = () => {
  monacoProviderRef.value?.dispose();
  monacoProviderRef.value = null;
};
/**
 * 代码提示注册
 */
const registerCompletionItemProvider = () => {
  disposeRegister();
  if (monaco.languages && props.registrationTips?.suggestions) {
    const {name, suggestions} = props.registrationTips;
    monacoProviderRef.value =
      monaco.languages.registerCompletionItemProvider(name || 'json', {
        provideCompletionItems: function (model, position) {
          const word = model.getWordUntilPosition(position); // 获取提示代码范围位置
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: handleSuggestions(suggestions, range),
          };
        },
      });
  }
};

const disposeTypescript = () => {
  monacoTypescriptProviderRef.value?.dispose();
  monacoTypescriptProviderRef.value = null;
};

const registerTypescript = () => {
  disposeTypescript();
  if (monaco.languages && props.registrationTypescript?.typescript) {
    const {name, typescript} = props.registrationTypescript;
    monacoTypescriptProviderRef.value =
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        typescript,
      );
  }
};

/**
 * 代码格式化
 */
const editorFormat = () => {
  if (!instance) return;
  window.clearTimeout(formatTimer);
  formatTimer = window.setTimeout(() => {
    formatTimer = undefined;
    instance?.getAction('editor.action.formatDocument')?.run();
  }, 300)
  if (props.hasOwnProperty('readOnly')) {
    window.clearTimeout(readOnlyTimer);
    readOnlyTimer = window.setTimeout(() => {
      readOnlyTimer = undefined;
      instance?.updateOptions({
        readOnly: props.readOnly !== false,
      });
    }, 400);
  }
};

markerDisposable = monaco.editor.onDidChangeMarkers(([uri]) => {
  const markers = monaco.editor.getModelMarkers({resource: uri});
  emit('errorChange', markers);
});

onMounted(() => {
  modelInstance = monaco.editor.createModel(props.modelValue, props.language);

  instance = monaco.editor.create(dom.value, {
    model: modelInstance,
    tabSize: 2,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    theme: props.theme, // 主题色: vs(默认高亮), vs-dark(黑色), hc-black(高亮黑色)
    formatOnPaste: true,
    ...(omit(props.options, ['readOnly']) || {}),
  });

  instance.onDidChangeModelContent(() => {
    //
    const value = instance.getValue();
    nextTick(() => {
      emit('update:modelValue', value);
      emit('change', value);
    });
  });

  instance.onDidBlurEditorText(() => {
    emit('blur');
    if (props.blurFormat) {
      editorFormat();
    }
  });

  instance.onDidFocusEditorText(() => {
    emit('focus');
  });

  if (props.modelValue) {
    initialFormatTimer = window.setTimeout(() => {
      initialFormatTimer = undefined;
      editorFormat();
    }, 200);
  }

  props.init?.(instance, monaco);
});

/**
 * 光标位置插入内容
 * @param {String} val
 * @param position
 */
const insert = (val, position) => {
  if (!instance) return;
  const _position = position || instance.getPosition();
  const value = instance.getValue();

  if (position && position.lineNumber) {
    instance.setPosition(position);
  }

  instance.executeEdits(value, [
    {
      range: new monaco.Range(
        _position?.lineNumber,
        _position?.column,
        _position?.lineNumber,
        _position?.column,
      ),
      text: val,
    },
  ]);
};

watch(
  () => props.modelValue,
  (val) => {
    if (
      !instance ||
      (instance &&
        props.modelValue === instance.getValue())
    )
      return;
    // setValue之前获取光标位置
    const position = instance.getPosition();

    // setValue之后光标位置改变
    instance.setValue(val);
    // 设置光标位置为setValue之前的位置
    instance.setPosition(position);

    editorFormat();
  },
);

watch(
  () => JSON.stringify(props.registrationTips),
  () => {
    registerCompletionItemProvider();
  },
  {immediate: true},
);

watch(
  () => JSON.stringify(props.registrationTypescript),
  () => {
    registerTypescript();
  },
  {immediate: true},
);

onUnmounted(() => {
  disposeRegister();
  disposeTypescript();
  markerDisposable?.dispose();
  markerDisposable = undefined;
  window.clearTimeout(formatTimer);
  window.clearTimeout(readOnlyTimer);
  window.clearTimeout(initialFormatTimer);

  // 主题切换会重建编辑器，卸载可能早于初始化完成；createModel 及全局监听需显式释放。
  const editor = instance;
  const model = modelInstance || editor?.getModel?.();
  editor?.dispose?.();
  model?.dispose?.();
  instance = undefined;
  modelInstance = undefined;
});

defineExpose({
  editorFormat,
  insert,
});
</script>
<style scoped>
.j-monaco-editor {
  min-height: 3.125rem;
  height: 100%;
}</style>
