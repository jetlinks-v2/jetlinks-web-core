type EditorUpdate='reset'|'catalog'|'configure'

/** Vue 装饰挂载会同步刷新 watcher；将编辑器写入合并到当前更新结束后，避免重入。 */
export function createEditorUpdates(apply:(kind:EditorUpdate)=>void) {
  let reset=false,catalog=false,configure=false,queued=false,disposed=false
  function schedule(kind:EditorUpdate) {
    if(disposed)return
    if(kind === 'reset')reset=true
    else if(kind === 'catalog')catalog=true
    else configure=true
    if(queued)return
    queued=true
    queueMicrotask(()=>{
      queued=false
      if(disposed)return
      const next={reset,catalog,configure}
      reset=catalog=configure=false
      // 重建已读取最新目录及权限，不能再写入旧文档上的目录事务。
      if(next.reset)apply('reset')
      else {if(next.catalog)apply('catalog');if(next.configure)apply('configure')}
    })
  }
  return {schedule,dispose(){disposed=true}}
}
