export function slimServants(list) {
  return (list || [])
    .filter((svt) => svt.collectionNo > 0)
    .map((svt) => ({
      id: svt.id,
      collectionNo: svt.collectionNo,
      name: svt.name,
      className: svt.className,
      attribute: svt.attribute,
      rarity: svt.rarity,
      face: svt.face,
      traitIds: (svt.traits || []).map((trait) => trait.id || trait),
    }))
}

function faceOf(ce) {
  const faces = ce.extraAssets?.faces?.equip || {}
  return faces[String(ce.id)] || faces[ce.id] || ''
}

function slimFunc(fn) {
  const s0 = (fn.svals || [{}])[0] || {}
  const f0 = (fn.followerVals || [])[0] || {}
  return {
    target: fn.funcTargetType,
    rate: s0.RateCount || 0,
    add: s0.AddCount || 0,
    eventId: s0.EventId || 0,
    indiv: s0.Individuality || 0,
    applySupport: fn.script?.ApplySupport ?? null,
    followerRate: f0.RateCount ?? null,
    tvals: (fn.functvals || []).map((trait) => ({ id: trait.id, name: trait.name })),
    andTvals: (fn.overWriteTvalsList || []).map((group) =>
      (group || []).map((trait) => ({ id: trait.id, name: trait.name })),
    ),
  }
}

export function slimBondCes(equips) {
  return (equips || [])
    .map((ce) => ({
      id: ce.id,
      collectionNo: ce.collectionNo,
      name: ce.name,
      rarity: ce.rarity,
      face: faceOf(ce) || ce.face || '',
      skills: (ce.skills || []).map((skill) => ({
        name: skill.name,
        condLimitCount: skill.condLimitCount,
        funcs: (skill.functions || []).filter((fn) => fn.funcType === 'servantFriendshipUp').map(slimFunc),
      })),
    }))
    .filter((ce) => ce.skills.some((skill) => skill.funcs.length))
}
