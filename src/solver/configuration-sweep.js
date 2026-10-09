// Exhaustive, lazy Cartesian expansion for a declared fixed roster. This is a
// parameter experiment, not an assertion that the game grants every rate or
// that one account owns every CE copy. CE hits remain the original engine's job.
function uniqueNumbers(list) {
  return [...new Set(list.map(Number))].filter(x => Number.isFinite(x) && x >= 0)
}

export function configurationSweepDomain(config, { eventLevels = null, ceStates = null, ownSix = false } = {}) {
  if (!Array.isArray(config?.slots) || config.slots.length !== 6) throw new Error('需要六个明确槽位')
  if (ownSix && config.slots.some(s => s.filled && !s.svtId)) throw new Error('已启用槽位需要真实从者；助战占位符请换成己方或设为空位')
  const supportPosition = ownSix ? 0 : config.supportPosition
  const levels = eventLevels == null ? null : uniqueNumbers(eventLevels)
  if (levels && !levels.length) throw new Error('活动倍率列表为空')
  const states = ceStates == null ? null : [...new Map(ceStates.map(s => [`${Number(s.ceId)}:${Boolean(s.ceMlb)}`, {
    ceId: Number(s.ceId), ceMlb: Boolean(s.ceMlb),
  }])).values()]
  if (states && (!states.length || states.some(s => !Number.isSafeInteger(s.ceId) || s.ceId < 0))) throw new Error('礼装状态列表无效')
  const choices = config.slots.map((slot, i) => {
    if (!slot.filled) return [{ ...slot }]
    const events = levels && i + 1 !== supportPosition ? levels : [Number(slot.selfEvent) || 0]
    return events.flatMap(selfEvent => (states || [{ ceId: slot.ceId || 0, ceMlb: Boolean(slot.ceMlb) }])
      .map(state => ({ ...slot, ...state, selfEvent })))
  })
  const count = choices.reduce((n, rows) => n * BigInt(rows.length), 1n)
  return { choices, count, supportPosition, scope: 'fixed-roster-parameters', accountLegalityChecked: false,
    eventSelectionRecognized: false }
}

export function* iterateConfigurationSweep(config, options = {}) {
  const domain = configurationSweepDomain(config, options)
  const slots = []
  function* visit(i) {
    if (i === 6) {
      yield { ...config, supportPosition: domain.supportPosition, slots: slots.map(s => ({ ...s })) }
      return
    }
    for (const slot of domain.choices[i]) { slots.push(slot); yield* visit(i + 1); slots.pop() }
  }
  yield* visit(0)
}
