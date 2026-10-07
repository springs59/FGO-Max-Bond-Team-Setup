// Search text and open/closed panels do not change the calculation.
const CONDITION_FIELDS = ['region', 'mode', 'accountSavedAt', 'base', 'teapot',
  'questId', 'questPhase', 'questType', 'questClass', 'costLimit', 'solverMode',
  'farmPref', 'allowSupport', 'bond15Aura', 'optimizeBy', 'preferIds', 'lockIds',
  'filter', 'frontIds', 'slotPins', 'pinCes', 'spriteMode', 'pinSprites',
  'grandPosition', 'priorities']

export function queryConditionKey(state) {
  const slots = (state.slots || []).map(slot => ['filled', 'svtId', 'svtArtKey',
    'ceId', 'ceMlb', 'bondLv', 'bondCap', 'bondMaxed', 'isSupport', 'isGrand',
    'ceBondId', 'ceBondMlb', 'ceRewardId', 'ceRewardMlb', 'pinned']
    .map(field => slot[field] ?? null))
  return JSON.stringify([CONDITION_FIELDS.map(field => state[field] ?? null),
    state.data?.game?.version?.dataVersion || null, slots])
}

export function queryContext({ region, mode, quest, base, costLimit, live, version = '' }) {
  const bonusCount = (live?.extraPassives || []).length + (live?.questFriendships || []).length
  return {
    region: region === 'JP' ? '日服' : '国服',
    pool: mode === 'account' ? '账号库存 · 按持有与满破状态' : '自由图鉴 · 按自由配队条件',
    quest: quest?.id ? quest.name || `关卡 ${quest.id}` : '未选择关卡 · 手动基础羁绊',
    bonus: !quest?.id ? '未应用具体活动关卡加成' : bonusCount
      ? '已纳入该关卡适用加成 · 按从者与作用对象结算' : '该关卡无额外活动羁绊加成',
    base: Number(base) || 0,
    cost: costLimit === '' || costLimit == null ? '不限' : String(costLimit),
    version,
  }
}

export function searchStatusLabel(status) {
  if (status?.optimality === 'default-query-complete') return '默认条件预计算完成'
  if (status?.optimality === 'search-complete') return '当前条件搜索完成'
  return '候选结果 · 尚未证明最优'
}
