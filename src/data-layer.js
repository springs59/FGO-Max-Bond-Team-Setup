export const SCHEMA_VERSION = 1

export function createGameData({
  servants = [],
  craftEssences = [],
  quests = [],
  enemies = [],
  traits = [],
  skills = [],
  noblePhantasms = [],
  version = null,
} = {}) {
  return {
    servants,
    craftEssences,
    quests,
    enemies,
    traits,
    skills,
    noblePhantasms,
    version,
  }
}

function recMap(list, field) {
  const out = {}
  for (const item of list || []) {
    if (!item || item.id == null) continue
    out[item.id] = item[field]
  }
  return out
}

export function createAccountData(game, { mode = 'free', account = null } = {}) {
  const virtual = mode !== 'account' || !account
  if (virtual) {
    const ces = (game && game.craftEssences) || []
    const servants = (game && game.servants) || []
    return {
      virtual: true,
      servantsOwned: servants,
      craftEssencesOwned: ces,
      levels: {},
      bondLevels: {},
      mlb: Object.fromEntries(ces.map((ce) => [ce.id, true])),
      costumes: {},
      masterCost: null,
      raw: null,
    }
  }
  const ownedSvts = account.servants || []
  const ownedCes = account.ces || []
  const svtById = new Map(((game && game.servants) || []).map((item) => [item.id, item]))
  const ceById = new Map(((game && game.craftEssences) || []).map((item) => [item.id, item]))
  return {
    virtual: false,
    servantsOwned: ownedSvts.map((rec) => svtById.get(rec.id)).filter(Boolean),
    craftEssencesOwned: ownedCes.map((rec) => ceById.get(rec.id)).filter(Boolean),
    levels: recMap(ownedSvts, 'lv'),
    bondLevels: recMap(ownedSvts, 'bondLv'),
    mlb: Object.fromEntries(ownedCes.map((rec) => [rec.id, Boolean(rec.mlb)])),
    costumes: Object.fromEntries(ownedSvts.map((rec) => [rec.id, rec.unlockedCostumes || []])),
    masterCost: account.masterCost || account.maxCost || null,
    raw: account,
  }
}

export function solverInputs(game, accountData) {
  const virtual = !accountData || accountData.virtual
  return {
    servants: virtual ? game.servants : accountData.servantsOwned,
    ces: virtual ? game.craftEssences : accountData.craftEssencesOwned,
    mode: virtual ? 'free' : 'account',
    account: virtual ? null : accountData.raw,
  }
}

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatChinaDateTime(iso) {
  const raw = String(iso || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 19)
  const china = new Date(date.getTime() + CHINA_OFFSET_MS)
  return `${china.getUTCFullYear()}-${pad2(china.getUTCMonth() + 1)}-${pad2(china.getUTCDate())} ${pad2(china.getUTCHours())}:${pad2(china.getUTCMinutes())}:${pad2(china.getUTCSeconds())}`
}

export function dataVersionLine(version) {
  if (!version) return ''
  const updated = version.updatedAt || version.dataVersion || ''
  const when = formatChinaDateTime(updated)
  const schema = version.schemaVersion != null ? `schema ${version.schemaVersion}` : ''
  const source = version.sourceVersion || ''
  return [when, source, schema].filter(Boolean).join(' · ')
}
