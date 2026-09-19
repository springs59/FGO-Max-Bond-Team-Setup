const CLASS_ADV = {
  saber: { archer: 0.5, lancer: 2, berserker: 1.5 },
  archer: { saber: 2, lancer: 0.5, berserker: 1.5 },
  lancer: { saber: 0.5, archer: 2, berserker: 1.5 },
  rider: { caster: 2, assassin: 0.5, berserker: 1.5 },
  caster: { rider: 0.5, assassin: 2, berserker: 1.5 },
  assassin: { rider: 2, caster: 0.5, berserker: 1.5 },
  berserker: { saber: 1.5, archer: 1.5, lancer: 1.5, rider: 1.5, caster: 1.5, assassin: 1.5, ruler: 1.5, avenger: 1.5, moonCancer: 1.5, alterEgo: 1.5, foreigner: 1.5, pretender: 1.5, shielder: 1.5 },
  ruler: { saber: 0.5, archer: 0.5, lancer: 0.5, rider: 0.5, caster: 0.5, assassin: 0.5, berserker: 2, moonCancer: 2, avenger: 0.5 },
  avenger: { ruler: 2, moonCancer: 0.5, berserker: 2 },
  moonCancer: { ruler: 0.5, avenger: 2, berserker: 2 },
  alterEgo: { saber: 0.5, archer: 1.5, lancer: 1.5, rider: 0.5, caster: 1.5, assassin: 0.5, berserker: 2 },
  foreigner: { foreigner: 2, berserker: 2 },
  pretender: { saber: 1.5, archer: 0.5, lancer: 1.5, rider: 0.5, caster: 1.5, assassin: 0.5, berserker: 2 },
  shielder: {},
}

const ATTR_ADV = {
  man: { sky: 1.1, earth: 0.9 },
  sky: { earth: 1.1, man: 0.9 },
  earth: { man: 1.1, sky: 0.9 },
  star: { star: 1.1 },
  beast: { star: 1.1, beast: 1.1 },
}

export function classAdvantage(attacker, defender) {
  const row = CLASS_ADV[attacker] || {}
  if (row[defender] != null) return row[defender]
  if (attacker === 'berserker') return 1.5
  return 1
}

export function attrAdvantage(attacker, defender) {
  const row = ATTR_ADV[attacker] || {}
  return row[defender] != null ? row[defender] : 1
}

export function createRng(seed = 1) {
  let s = seed >>> 0 || 1
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function cloneEnemy(enemy) {
  return {
    id: enemy.id,
    name: enemy.name || 'enemy',
    className: enemy.className || 'saber',
    attribute: enemy.attribute || 'man',
    hp: Number(enemy.hp) || 0,
    maxHp: Number(enemy.hp) || 0,
    traits: enemy.traits || [],
    specialDef: Number(enemy.specialDef) || 0,
    atk: Number(enemy.atk) || 0,
  }
}

function cloneServant(svt, index) {
  return {
    id: svt.id,
    name: svt.name || `svt${index}`,
    className: svt.className || 'saber',
    attribute: svt.attribute || 'man',
    atk: Number(svt.atk) || 0,
    hp: Number(svt.hp) || 0,
    np: Number(svt.np) || 0,
    npRate: Number(svt.npRate) || 0,
    npGain: Number(svt.npGain) || 0,
    npMultiplier: Number(svt.npMultiplier) || 0,
    specialAtk: Number(svt.specialAtk) || 0,
    skills: (svt.skills || []).map((skill) => ({
      name: skill.name || 'skill',
      cd: Number(skill.cd) || 7,
      left: 0,
      npCharge: Number(skill.npCharge) || 0,
      atkUp: Number(skill.atkUp) || 0,
      npDmgUp: Number(skill.npDmgUp) || 0,
      target: skill.target || 'self',
    })),
    atkUp: 0,
    npDmgUp: 0,
    defUp: 0,
    dead: false,
  }
}

export function npDamage(attacker, defender, rng, opts = {}) {
  const random = opts.fixedRandom != null ? opts.fixedRandom : 0.9 + rng() * 0.2
  const adv = classAdvantage(attacker.className, defender.className)
  const attr = attrAdvantage(attacker.attribute, defender.attribute)
  const special = 1 + (attacker.specialAtk || 0)
  const atkBuff = 1 + (attacker.atkUp || 0)
  const npBuff = 1 + (attacker.npDmgUp || 0)
  const defBuff = Math.max(0.1, 1 - (defender.specialDef || 0) - (attacker.defUp || 0))
  return Math.floor(attacker.atk * attacker.npMultiplier * adv * attr * special * atkBuff * npBuff * defBuff * random)
}

function aliveEnemies(wave) {
  return wave.filter((enemy) => enemy.hp > 0)
}

function pickTarget(enemies, rng, rule = 'first') {
  const live = aliveEnemies(enemies)
  if (!live.length) return null
  if (rule === 'random') return live[Math.floor(rng() * live.length)]
  if (rule === 'lowestHp') return live.slice().sort((a, b) => a.hp - b.hp)[0]
  return live[0]
}

function applySkill(actor, allies, skill) {
  if (!skill || skill.left > 0) return false
  const targets = skill.target === 'party' ? allies.filter((item) => !item.dead) : [actor]
  for (const target of targets) {
    target.np = Math.min(300, (target.np || 0) + (skill.npCharge || 0))
    target.atkUp += skill.atkUp || 0
    target.npDmgUp += skill.npDmgUp || 0
  }
  skill.left = skill.cd
  return true
}

function tickCds(allies) {
  for (const svt of allies) {
    for (const skill of svt.skills || []) {
      if (skill.left > 0) skill.left -= 1
    }
  }
}

function enemyStrike(wave, allies, rng, log, turns, waveIndex) {
  const liveAllies = allies.filter((item) => !item.dead)
  if (!liveAllies.length) return
  for (const enemy of aliveEnemies(wave)) {
    const atk = Number(enemy.atk) || 0
    if (!atk) continue
    const victim = liveAllies.find((item) => !item.dead)
    if (!victim) return
    const dmg = Math.floor(atk * classAdvantage(enemy.className, victim.className) * (0.9 + rng() * 0.2))
    victim.hp -= dmg
    log.push({ turn: turns, wave: waveIndex + 1, type: 'enemy-atk', enemyId: enemy.id, dmg, target: victim.id })
    if (victim.hp <= 0) victim.dead = true
  }
}

function runBattle({ quest, team, strategy, rng, cardRandom, targetRandom }) {
  const wavesSrc = (quest && quest.waves) || []
  const allies = (team || []).map((svt, i) => cloneServant(svt, i))
  const waves = wavesSrc.map((wave) => (wave.enemies || []).map(cloneEnemy))
  if (!waves.length || waves.some((wave) => !wave.length)) {
    return { cleared: false, turns: 0, failReason: 'missing-enemy-data', log: [] }
  }
  let turns = 0
  let cleared = true
  let failReason = ''
  const log = []
  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w]
    const wavePlan = ((strategy && strategy.waves) || [])[w] || {}
    let guard = 0
    while (aliveEnemies(wave).length && guard < 40) {
      guard += 1
      turns += 1
      tickCds(allies)
      const liveAllies = allies.filter((item) => !item.dead)
      if (!liveAllies.length) {
        cleared = false
        failReason = 'allies-down'
        break
      }
      const actions = wavePlan.actions || []
      for (const action of actions) {
        const actor = liveAllies.find((item) => item.id === action.svtId) || liveAllies[0]
        if (action.type === 'skill') {
          const skill = (actor.skills || [])[action.skillIndex || 0]
          applySkill(actor, allies, skill)
          log.push({ turn: turns, wave: w + 1, type: 'skill', svtId: actor.id, skill: skill && skill.name })
        }
      }
      const npOrder = wavePlan.npOrder && wavePlan.npOrder.length
        ? wavePlan.npOrder.map((id) => liveAllies.find((item) => item.id === id)).filter(Boolean)
        : liveAllies.filter((item) => item.np >= 100)
      if (!npOrder.length) {
        const attacker = liveAllies[0]
        const target = pickTarget(wave, rng, targetRandom ? 'random' : wavePlan.targetRule || 'first')
        if (!target) break
        const dmg = Math.floor(attacker.atk * 0.3 * classAdvantage(attacker.className, target.className) * (cardRandom ? 0.9 + rng() * 0.2 : 1))
        target.hp -= dmg
        attacker.np = Math.min(300, attacker.np + attacker.npGain * 10)
        log.push({ turn: turns, wave: w + 1, type: 'cards', svtId: attacker.id, dmg })
      } else {
        for (const actor of npOrder) {
          if (actor.np < 100) {
            cleared = false
            failReason = failReason || 'np-low'
            continue
          }
          const target = pickTarget(wave, rng, targetRandom ? 'random' : wavePlan.targetRule || 'first')
          if (!target) break
          const dmg = npDamage(actor, target, rng, { fixedRandom: cardRandom ? undefined : 1 })
          target.hp -= dmg
          actor.np -= 100
          log.push({ turn: turns, wave: w + 1, type: 'np', svtId: actor.id, dmg, target: target.name })
        }
      }
      if (aliveEnemies(wave).length) enemyStrike(wave, allies, rng, log, turns, w)
      if (!allies.some((item) => !item.dead)) {
        cleared = false
        failReason = failReason || 'allies-down'
        break
      }
    }
    if (aliveEnemies(wave).length) {
      cleared = false
      failReason = failReason || 'wave-timeout'
      break
    }
  }
  return { cleared, turns, failReason, log }
}

export function hasScriptableStrategy(strategy, quest) {
  if (!strategy || strategy.placeholderEnemies) return false
  if (!quest || !Array.isArray(quest.waves) || !quest.waves.length) return false
  if (quest.waves.some((wave) => !(wave.enemies || []).length)) return false
  return (strategy.waves || []).some(
    (wave) => (wave.actions && wave.actions.length) || (wave.npOrder && wave.npOrder.length),
  )
}

export function simulateBattle({
  quest,
  team,
  strategy,
  seed = 1,
  runs = 1,
  cardRandom = true,
  targetRandom = false,
} = {}) {
  const results = []
  for (let run = 0; run < Math.max(1, runs); run++) {
    const rng = createRng(seed + run * 997)
    results.push(runBattle({ quest, team, strategy, rng, cardRandom, targetRandom }))
  }
  const fails = results.filter((item) => !item.cleared)
  const failRate = fails.length / results.length
  const avgTurns = results.reduce((sum, item) => sum + item.turns, 0) / results.length
  const staticPath = runBattle({
    quest,
    team,
    strategy,
    rng: createRng(1),
    cardRandom: false,
    targetRandom: false,
  })
  return {
    runs: results.length,
    failRate,
    avgTurns,
    theoreticalClear: staticPath.cleared,
    reproducible: hasScriptableStrategy(strategy, quest),
    highStability: failRate === 0,
    results,
    failReasons: [...new Set(fails.map((item) => item.failReason).filter(Boolean))],
  }
}

export function stabilityLabel(evidence) {
  if (!evidence) return 'unknown'
  if (evidence.highStability && evidence.reproducible) return 'high-stability-farming'
  if (evidence.reproducible) return 'reproducible-strategy'
  if (evidence.theoreticalClear) return 'theoretical-clear'
  return 'uncleared'
}
