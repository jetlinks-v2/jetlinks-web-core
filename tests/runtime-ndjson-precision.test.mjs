import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createRequire} from 'node:module'
import {transformSync} from 'esbuild'
import {lastValueFrom,firstValueFrom,toArray} from 'rxjs'
import {parse,isSafeNumber} from 'lossless-json'
const require=createRequire(import.meta.url)
const sharedCoreRoot=process.env.JETLINKS_SHARED_CORE_ROOT || dirname(require.resolve('@jetlinks-web/core/package.json'))
function load(file) {
  const module={exports:{}}
  new Function('require','module','exports',transformSync(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code)(id=>{
    if(id==='./request-context')return {getRequestBaseApi:()=>'/api',getRequestHeaders:()=>({'X-Access-Token':'mock','X-Project-Id':'project'})}
    if(id==='./json')return {parseJsonWithPrecision:text=>parse(text,undefined,value=>isSafeNumber(value)?Number(value):value)}
    if(id==='./consts')return {langKey:'Accept-Language'}
    if(id==='./ndjson')return load(new URL('../src/utils/ndjson.ts',import.meta.url))
    if(id==='@jetlinks-web/core')return load(resolve(sharedCoreRoot,'src/fetch.ts'))
    if(id==='@jetlinks-web/constants')return {TOKEN_KEY:'token',BASE_API:'/api',LOCAL_BASE_API:'base'}
    if(id==='@jetlinks-web/utils')return {getToken:()=>'',randomString:()=> 'test'}
    return require(id)
  },module,module.exports)
  return module.exports
}
const module={exports:load(new URL('../src/utils/ndjson-precision.ts',import.meta.url))}
function setup(t,fetcher){const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;globalThis.fetch=fetcher;globalThis.localStorage={getItem:()=> 'zh'};t.after(()=>{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage})}
const encoder=new TextEncoder(),headers={'Content-Type':'application/x-ndjson'}

test('stream preserves precision, split UTF8, CRLF and a final line without newline',async t=>{
  const bytes=encoder.encode('{"pointId":"温度","parsedData":9007199254740993}\r\n{"parsedData":0.123456789012345678901}')
  let request
  setup(t,async(url,options)=>{request={url,options};return new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,14));c.enqueue(bytes.slice(14,23));c.enqueue(bytes.slice(23));c.close()}}),{headers})})
  const rows=await lastValueFrom(module.exports.postRuntimeNdJson('/points/_read',['p']).pipe(toArray()))
  assert.equal(rows[0].pointId,'温度');assert.equal(rows[0].parsedData,'9007199254740993');assert.equal(rows[1].parsedData,'0.123456789012345678901')
  const sentHeaders=new Headers(request.options.headers)
  assert.equal(request.url,'/api/points/_read');assert.equal(sentHeaders.get('X-Project-Id'),'project');assert.equal(sentHeaders.get('Accept-Language'),'zh')
  assert.equal(sentHeaders.get('Content-Type'),'application/json');assert.deepEqual(JSON.parse(request.options.body),['p'])
})

test('cancellation aborts fetch and cancels the reader after the first result',async t=>{
  let options,cancelled=0
  setup(t,async(url,value)=>{options=value;return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode('{"pointId":"p"}\n'))},cancel(){cancelled++}}),{headers})})
  const first=await firstValueFrom(module.exports.postRuntimeNdJson('/read',[]))
  assert.equal(first.pointId,'p');assert.equal(options.signal.aborted,true);assert.equal(cancelled,1)
})

test('HTTP and non-stream responses fail explicitly',async t=>{
  setup(t,async()=>new Response('denied',{status:403}))
  await assert.rejects(lastValueFrom(module.exports.postRuntimeNdJson('/read',[])),/403/)
  globalThis.fetch=async()=>new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})
  await assert.rejects(lastValueFrom(module.exports.postRuntimeNdJson('/read',[])),/NDJSON/)
})

test('terminal server error preserves already received values',async t=>{
  setup(t,async()=>new Response('{"pointId":"p"}\n{"status":500,"message":"timeout"}\n',{headers}))
  const received=[]
  await assert.rejects(new Promise((resolve,reject)=>module.exports.postRuntimeNdJson('/read',[]).subscribe({next:value=>received.push(value),complete:resolve,error:reject})),/timeout/)
  assert.equal(received.length,1)
})

test('HTTP error exposes the server explanation without treating it as point data',async t=>{
  setup(t,async()=>new Response('{"status":500,"message":"该点位仅订阅，无法主动读取"}\n',{status:500,headers}))
  await assert.rejects(lastValueFrom(module.exports.postRuntimeNdJson('/read',[])),/仅订阅/)
})
