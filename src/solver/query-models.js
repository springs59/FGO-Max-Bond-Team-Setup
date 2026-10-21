import { QUERY_POLICY as teacher } from './query-policies/T.js'
import { QUERY_POLICY as large } from './query-policies/N8192.js'

export const QUERY_MODELS = Object.freeze([
  { id: 'baseline', label: '经典高起点 AI', description: '采用原有高起点方案，在未见组合测试中表现较稳。启用 AI 时建议优先选择。' },
  { id: 'teacher', label: '扩展策略 AI', description: '从更丰富的固定策略中，为当前配队条件选择起点方案。' },
  { id: 'neural-large', label: '大数据神经 AI', description: '使用大量配队数据训练，公开图鉴测试中起点质量较高；未见组合可能退化。' },
].map(Object.freeze))
export const AI_CHOICES = Object.freeze([
  Object.freeze({ id: 'off', label: '不使用 AI', description: '直接使用精确求解器，不调用模型。' }),
  ...QUERY_MODELS,
])
const policies = { teacher, 'neural-large': large }
const models = new WeakMap()
export const validQueryModelId = id => QUERY_MODELS.some(model => model.id === id)

// Select one frozen query policy before the Worker request; no inference here.
export function selectQueryModel(base, id = 'baseline') {
  if (!Object.hasOwn(policies, id) || !base || typeof base !== 'object') return base
  if (!models.has(base)) models.set(base, new Map())
  const cache = models.get(base)
  if (!cache.has(id)) cache.set(id, { ...base, queryPolicy: policies[id], version: `${base.version}/${policies[id].version}` })
  return cache.get(id)
}
