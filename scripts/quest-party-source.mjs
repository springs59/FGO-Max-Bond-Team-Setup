import { slimBondCes } from '../src/game-data.js'

export function slimSystemSupports(detail) {
  return (detail?.supportServants || []).map(row => {
    const equips = row.equips || []
    return { id: row.id, svtId: row.svt?.id || 0, name: row.name || row.svt?.name || '系统助战',
      className: row.svt?.className || '', traitIds: (row.traits || []).map(t => Number(t.id ?? t)),
      required: (row.followerFlags || []).includes('fixedNpc'),
      releaseConditions: (row.releaseConditions || []).map(c => ({ type: c.type, targetId: c.targetId, value: c.value })),
      equips: equips.map(eq => ({ ceId: eq.equip?.id || 0, ceMlb: Number(eq.limitCount) >= 4,
        ce: slimBondCes([eq.equip]).find(c => c.id === eq.equip?.id) || { id: eq.equip?.id || 0, name: eq.equip?.name || '', skills: [] } })),
    }
  })
}
