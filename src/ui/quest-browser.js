import { isLiveQuest, isLimitedEventQuest, isBattleQuest, questKindOf, questSelectKey } from '../game-data.js'
import { questAvailability, questUnlockTags, permanentEnd } from '../quest-availability.js'

export const QUEST_CATEGORIES = [['event', '当前限时活动'], ['permanent', '常驻 / 主线物语'], ['free', '自由本'], ['main', '主线剧情'],
  ['daily', '每日任务'], ['grand', '冠位研钻'], ['once', '一次通关'], ['all', '全部关卡']]
const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

export function decorateQuest(quest, index, region = 'CN') {
  const meta = index?.region === region ? index.quests?.[quest.id] : null
  return meta ? { ...meta, ...quest, region, afterClear: quest.afterClear || meta.afterClear } : { ...quest, region }
}

export function questRepeatability(quest) {
  if (['repeatFirst', 'repeatLast'].includes(quest.afterClear)) return ['repeat', '可反复挑战']
  if (['close', 'closeDisp'].includes(quest.afterClear)) return ['once', '一次通关']
  if (quest.afterClear === 'resetInterval') return ['reset', '定期重置']
  return ['unknown', '重复规则未标注']
}

export function questCategory(quest) {
  const availability = questAvailability(quest)
  if (['main-interlude', 'permanent-event'].includes(availability)) return 'permanent'
  if (availability === 'main-story' && quest.type !== 'free') return 'main'
  const kind = questKindOf(quest)
  if (kind === 'event') return 'event'
  if (['train', 'vault', 'daily'].includes(kind)) return 'daily'
  if (kind === 'grand') return 'grand'
  if (quest.type === 'main') return 'main'
  if (quest.type === 'free') return 'free'
  if (questRepeatability(quest)[0] === 'once') return 'once'
  return 'other'
}

export function questContent(quest) {
  if (questCategory(quest) === 'permanent') {
    if (quest.type === 'main') return ['story', '主线物语']
    if (questRepeatability(quest)[0] === 'repeat' || quest.type === 'free') return ['farm', '常驻周回']
    return ['once', '常驻一次通关']
  }
  if (quest.type === 'main') return ['story', questCategory(quest) === 'event' ? '活动主线' : '主线剧情']
  if (questCategory(quest) === 'daily') return ['farm', ({ train: '修炼场', vault: '宝物库', daily: '每日其他' })[questKindOf(quest)]]
  if (quest.type === 'free' || questRepeatability(quest)[0] === 'repeat') return ['farm', questCategory(quest) === 'event' ? '活动周回' : '自由本']
  if (questRepeatability(quest)[0] === 'once') return ['once', '一次通关']
  if (questCategory(quest) === 'grand') return ['farm', '冠位研钻']
  return ['other', '其他关卡']
}

export function questWindow(quest, now = Date.now() / 1000) {
  if (Number(quest.openedAt) > now) return ['future', '尚未开放']
  if (!isLiveQuest(quest, now)) return ['expired', '已结束']
  if (['main-story', 'main-interlude', 'permanent-event'].includes(questAvailability(quest))) return ['permanent', '常驻内容']
  if (isLimitedEventQuest(quest) || (Number(quest.closedAt) > 0 && Number(quest.closedAt) < permanentEnd(quest.region))) return ['limited', '限时开放']
  return ['permanent', '常驻']
}

export function questTags(quest, now) {
  return [...new Set([questContent(quest)[1], questRepeatability(quest)[1], questWindow(quest, now)[1], ...questUnlockTags(quest)])]
}

export function browseQuests(list, { category = 'all', content = '', war = '', query = '', scope = 'live', now = Date.now() / 1000 } = {}) {
  const words = clean(query).split(' ').filter(Boolean)
  return (list || []).filter(quest => {
    if (!isBattleQuest(quest)) return false
    if (scope === 'live' && !isLiveQuest(quest, now)) return false
    if (category === 'once' ? questRepeatability(quest)[0] !== 'once' : category === 'main' ? questContent(quest)[0] !== 'story' : category !== 'all' && questCategory(quest) !== category) return false
    if (content && questContent(quest)[0] !== content) return false
    if (war && clean(quest.war) !== clean(war)) return false
    const text = clean([quest.name, quest.display, quest.spot, quest.war, quest.id, quest.bond,
      ...(quest.aliases || []), ...questTags(quest, now)].join(' '))
    return words.every(word => text.includes(word))
  }).sort((a, b) => {
    const live = q => isLiveQuest(q, now) ? 0 : 1
    const farm = q => questContent(q)[0] === 'farm' ? 0 : 1
    return live(a) - live(b) || farm(a) - farm(b) || Number(b.bond) - Number(a.bond) || Number(a.id) - Number(b.id)
  })
}

export function rememberQuest(keys, quest, limit = 6) {
  const key = questSelectKey(quest)
  return [key, ...(keys || []).filter(item => typeof item === 'string' && item !== key)].slice(0, limit)
}

export function loadRecentQuests(region, store) {
  try { const data = JSON.parse((store || globalThis.localStorage)?.getItem(`fgo_recent_quests_${region}`) || '[]'); return Array.isArray(data) ? data.filter(x => typeof x === 'string').slice(0, 6) : [] } catch { return [] }
}

export function saveRecentQuests(keys, region, store) {
  try { (store || globalThis.localStorage)?.setItem(`fgo_recent_quests_${region}`, JSON.stringify(keys)); return true } catch { return false }
}
