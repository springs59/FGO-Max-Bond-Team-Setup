import { slimBondCes } from '../src/game-data.js'

export async function loadPhasePartyMetadata(raw, pullNice, now = Math.floor(Date.now() / 1000)) {
  const followers = (raw?.npcFollower || []).filter(row =>
    (!row.openedAt || now >= row.openedAt) && (!row.closedAt || now <= row.closedAt))
  const npcSupportCount = followers.length
  if (!raw?.mstQuestRestriction?.length && !npcSupportCount) {
    return { restrictions: [], npcSupportCount: 0, supportServants: [], partyMetadataComplete: true }
  }
  let detail
  try {
    detail = await pullNice()
  } catch (error) {
    // Old daily phases can have valid raw bond data but no Nice endpoint.
    // Preserve that phase without declaring its unknown party rules legal.
    if (!/\bHTTP 404\b/.test(String(error?.message))) throw error
    return { restrictions: [{ restriction: { type: 'unresolvedQuestPartyMetadata',
      name: '系统助战或编成限制详情暂不可读取' } }], npcSupportCount, supportServants: [] }
  }
  return { flags: detail?.flags, restrictions: detail?.restrictions || [], npcSupportCount,
    supportServants: slimSystemSupports(detail, followers), partyMetadataComplete: true }
}

export function slimSystemSupports(detail, followers = null) {
  return (detail?.supportServants || []).filter(row => !followers || followers.some(f => f.id === row.id)).map(row => {
    const equips = row.equips || []
    const window = followers?.find(f => f.id === row.id)
    return { id: row.id, svtId: row.svt?.id || 0, name: row.name || row.svt?.name || '系统助战',
      ...(window ? { openedAt: window.openedAt || 0, closedAt: window.closedAt || 0 } : {}),
      className: row.svt?.className || '', traitIds: (row.traits || []).map(t => Number(t.id ?? t)),
      required: (row.followerFlags || []).includes('fixedNpc'),
      releaseConditions: (row.releaseConditions || []).map(c => ({ type: c.type, targetId: c.targetId, value: c.value })),
      equips: equips.map(eq => ({ ceId: eq.equip?.id || 0, ceMlb: Number(eq.limitCount) >= 4,
        ce: slimBondCes([eq.equip]).find(c => c.id === eq.equip?.id) || { id: eq.equip?.id || 0, name: eq.equip?.name || '', skills: [] } })),
    }
  })
}
