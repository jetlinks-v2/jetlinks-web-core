import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader } from './helpers/metricRuntime.mjs'

const { metricSourceMatchesSemantics: matches } = createMetricLoader()('components/Metric/sourceSchema.ts')

test('模板按原元数据语义限制输入，开放词汇保留，不以名称推测用途',()=>{
  const declaration = { semanticId:'urn:iot:temperature',semanticTypes:['observation','industry:measurement'],semanticRole:'value' }
  assert.equal(matches(undefined,{}),true)
  assert.equal(matches({semanticId:'urn:iot:temperature',semanticTypes:['observation']},declaration),true)
  assert.equal(matches({semanticTypes:['industry:measurement'],semanticRole:'value'},declaration),true)
  assert.equal(matches({semanticId:'urn:iot:pressure'},declaration),false)
  assert.equal(matches({semanticTypes:['result']},declaration),false)
  assert.equal(matches({semanticRole:'value'},{name:'value'}),false)
  assert.equal(matches({semanticId:'urn:iot:temperature'}),false)
})
