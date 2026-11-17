import { Observable } from 'rxjs'
import { getRequestBaseApi, getRequestHeaders } from './request-context'
import { parseJsonWithPrecision } from './json'
import { langKey } from './consts'

/**
 * 需要保留大整数与小数的运行时流。现有NdJson在响应钩子前已JSON.parse，无法恢复精度；
 * 此入口在文本边界复用无损解析和统一认证上下文，不修改依赖包或其他订阅的生命周期。
 * 每个订阅仅持有reader及未完成的一行；取消立即中止请求，无重试、历史缓存或连接池。
 */
export function postRuntimeNdJson<T>(url:string,body:unknown):Observable<T> {
  return new Observable<T>(observer=>{
    const controller=new AbortController()
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
    const emit=(line:string)=>{
      if(!line.trim() || observer.closed)return
      const value=parseJsonWithPrecision(line)
      if(value && typeof value === 'object' && 'status' in value && Number(value.status)>=400){
        throw new Error('message' in value ? String(value.message) : `HTTP ${value.status}`)
      }
      observer.next(value as T)
    }
    void (async()=>{
      try {
        const headers=new Headers(getRequestHeaders())
        headers.set('Accept','application/x-ndjson');headers.set('Content-Type','application/json')
        const language=localStorage.getItem(langKey)
        if(language)headers.set(langKey,language)
        const response=await fetch(`${getRequestBaseApi().replace(/\/$/,'')}/${url.replace(/^\//,'')}`,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal})
        if(!response.ok){
          const text=await response.text()
          let message=`HTTP ${response.status}`
          try {
            const error=parseJsonWithPrecision(text.trim().split('\n')[0])
            if(error && typeof error === 'object' && 'message' in error && error.message)message=String(error.message)
          } catch { /* 网关可能返回HTML或纯文本，保留HTTP状态即可。 */ }
          throw new Error(message)
        }
        if(!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson'))throw new Error('Expected NDJSON response')
        reader=response.body.getReader()
        const decoder=new TextDecoder()
        let pending=''
        while(!observer.closed){
          const {done,value}=await reader.read()
          pending+=done ? decoder.decode() : decoder.decode(value,{stream:true})
          let newline:number
          while(!observer.closed && (newline=pending.indexOf('\n'))>=0){emit(pending.slice(0,newline));pending=pending.slice(newline+1)}
          if(done){emit(pending);observer.complete();break}
        }
      } catch(cause){if(!observer.closed)observer.error(cause)}
      finally{reader?.releaseLock()}
    })()
    return ()=>{
      controller.abort()
      // 请求已经取消，reader的取消失败不能再次变成可见的读取错误。
      void reader?.cancel().catch(cause=>{if(!observer.closed)observer.error(cause)})
    }
  })
}
