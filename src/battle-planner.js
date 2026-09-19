function teamFromPlan(plan) {
  return (plan && plan.slots ? plan.slots : [])
    .filter((slot) => slot.filled && !slot.isSupport)
    .map((slot) => ({
      id: slot.svtId,
      name: slot.label,
      className: slot.className,
      attribute: slot.attribute,
      atk: Number(slot.atk) || 0,
      hp: Number(slot.hp) || 0,
      np: Number(slot.np) || 0,
      npRate: Number(slot.npRate) || 0,
      npGain: Number(slot.npGain) || 0,
      npMultiplier: Number(slot.npMultiplier) || 0,
      specialAtk: Number(slot.specialAtk) || 0,
      skills: Array.isArray(slot.skills) ? slot.skills : [],
    }))
}

function attachCombatFromGame(members, game) {
  if (!game) return members || []
  const servants = game.servants || []
  const skills = game.skills || []
  const nps = game.noblePhantasms || []
  return (members || []).map((member) => {
    const svt = servants.find((item) => item.id === member.id)
    const knownSkills = (member.skills || []).length
      ? member.skills
      : skills.filter((skill) => skill.svtId === member.id)
    const np = nps.find((item) => item.svtId === member.id)
    return {
      ...member,
      atk: member.atk || Number(svt && (svt.atk || svt.atkMax)) || 0,
      hp: member.hp || Number(svt && (svt.hp || svt.hpMax)) || 0,
      skills: knownSkills,
      npMultiplier: member.npMultiplier || Number(np && np.npMultiplier) || 0,
      npGain: member.npGain || Number(np && np.npGain) || 0,
    }
  })
}

export function withSimWaves(quest, strategy) {
  if (quest && Array.isArray(quest.waves) && quest.waves.length) return quest
  return {
    ...(quest || {}),
    waves: ((strategy && strategy.waves) || []).map((wave) => ({ enemies: wave.enemies || [] })),
  }
}

export function planBattle({ quest, team, bondPlan, game } = {}) {
  const members = attachCombatFromGame(team && team.length ? team : teamFromPlan(bondPlan), game)
  const hasWaves = Boolean(quest && Array.isArray(quest.waves) && quest.waves.length)
  const wavesSrc = hasWaves
    ? quest.waves
    : [{ enemies: [], placeholder: true }]
  const hasSkills = members.some((svt) => (svt.skills || []).some((skill) => skill && skill.npCharge))
  const hasAtk = members.some((svt) => Number(svt.atk) > 0)
  const waves = wavesSrc.map((wave, index) => {
    const npOrder = members
      .filter((svt, i) => i < 3 && ((svt.np || 0) >= 100 || (svt.skills || []).some((skill) => (skill.npCharge || 0) >= 50)))
      .map((svt) => svt.id)
    const actions = members.slice(0, 3).flatMap((svt) =>
      (svt.skills || []).map((skill, skillIndex) => ({
        type: 'skill',
        svtId: svt.id,
        skillIndex,
        target: skill.target || 'self',
      })),
    )
    return {
      turn: index + 1,
      phase: `wave-${index + 1}`,
      enemies: (wave.enemies || []).map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        className: enemy.className,
        attribute: enemy.attribute || '',
        hp: enemy.hp,
        traits: enemy.traits || [],
        mechanics: enemy.mechanics || [],
      })),
      actions,
      targetRules: ['first'],
      targetRule: 'first',
      npOrder,
      reservePlan: members.slice(3).map((svt) => svt.id),
      requiredConditions: [
        'NP 达到 100 才放宝具',
        hasSkills ? '使用已知技能数据' : '技能数据未入库，不假设充能',
        hasAtk ? '使用已知攻击力' : '攻击力未入库，不假设数值',
      ],
      cardConditions: hasWaves ? ['NP 不足时平A补 NP'] : [],
      fallback: {
        if: 'np-low',
        then: '先平A充能，下一回合再放宝具',
      },
    }
  })
  let confidence = 0.2
  if (hasWaves && hasAtk) confidence = 0.45
  if (hasWaves && hasAtk && hasSkills) confidence = 0.7
  return {
    questId: quest && (quest.id || quest.questId) || 0,
    team: members,
    confidence: members.length ? confidence : 0,
    placeholderEnemies: !hasWaves,
    assumedCombatStats: !hasAtk,
    dataNote: hasWaves ? '' : '关卡敌人数据尚未入库，战斗计划只给出结构模板',
    waves,
    failureBranches: [
      { reason: 'np-low', fallback: '平A充能后重试宝具' },
      { reason: 'wave-timeout', fallback: '增加特攻或换职阶克制从者' },
      ...(!hasWaves ? [{ reason: 'missing-enemy-data', fallback: '补齐敌人 HP / 职阶后再模拟' }] : []),
    ],
    clearConditions: ['三波敌人 HP 清零', '己方仍有存活从者'],
  }
}
