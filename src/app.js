import { calcParty } from './bond.js'
import {
  applyCraftEssences,
  attrLabel,
  classLabel,
  fetchQuestBond,
  fetchServantPassives,
  loadCes,
  loadServants,
  searchByName,
} from './atlas.js'
import { accountCeOf, accountServantOf, parseAccount } from './account.js'

const LUNCH = [
  { v: 0, t: '关' },
  { v: 0.02, t: '2%' },
  { v: 0.1, t: '满破 10%' },
]
const TEA_SELF = [
  { v: 0, t: '关' },
  { v: 0.01, t: '1%' },
  { v: 0.02, t: '2%' },
  { v: 0.03, t: '3%' },
  { v: 0.04, t: '4%' },
  { v: 0.05, t: '5%' },
]
const TEA_SUPPORT = [
  { v: 0, t: '关' },
  { v: 0.03, t: '3%' },
  { v: 0.06, t: '6%' },
  { v: 0.09, t: '9%' },
  { v: 0.12, t: '12%' },
  { v: 0.15, t: '15%' },
]
const HOLMES = [
  { v: 0, t: '关' },
  { v: 0.01, t: '1%' },
  { v: 0.05, t: '满破 5%' },
]
const COND = [
  { v: 0, t: '关' },
  { v: 0.04, t: '4%' },
  { v: 0.2, t: '满破 20%' },
]
const EVENT = [
  { v: 0, t: '关' },
  { v: 0.2, t: '+20%' },
  { v: 0.5, t: '+50%' },
]

function blankSlot(position, filled) {
  return {
    position,
    filled,
    isSupport: false,
    bond15: false,
    lunch: 0,
    teaSelf: 0,
    supportTea: 0,
    holmes: 0,
    condCe: 0,
    eventPassive: 0,
    customPercent: 0,
    portrait: false,
    label: '',
    svtId: 0,
    face: '',
    className: '',
    attribute: '',
    traitIds: [],
    ceId: 0,
    ceMlb: true,
    ceLines: [],
    ceMiss: '',
    svtQuery: '',
    ceQuery: '',
  }
}

const state = {
  base: '815',
  teapot: false,
  questId: '',
  questPhase: '1',
  questName: '',
  slots: [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position <= 3)),
  mode: 'free',
  account: null,
  data: {
    servants: [],
    ces: [],
    status: '正在接入 Atlas / Chaldea 国服数据…',
    error: '',
  },
}

function pct(n) {
  return `${Math.round(n * 1000) / 10}%`
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function options(list, current) {
  return list
    .map((item) => `<option value="${item.v}" ${Number(current) === item.v ? 'selected' : ''}>${item.t}</option>`)
    .join('')
}

function resultOf(position, output) {
  return output.results.find((item) => item.position === position)
}

function selectedSvt(slot) {
  return state.data.servants.find((svt) => svt.id === slot.svtId)
}

function selectedCe(slot) {
  return state.data.ces.find((ce) => ce.id === slot.ceId)
}

function ownedServants() {
  if (!state.account) return []
  const ids = new Set(state.account.servants.map((item) => item.id))
  return state.data.servants.filter((svt) => ids.has(svt.id))
}

function ownedCes() {
  if (!state.account) return []
  const ids = new Set(state.account.ces.map((item) => item.id))
  return state.data.ces.filter((ce) => ids.has(ce.id))
}

function servantPool(slot) {
  if (state.mode === 'account' && !slot.isSupport) return ownedServants()
  return state.data.servants
}

function cePool(slot) {
  if (state.mode === 'account' && !slot.isSupport) return ownedCes()
  return state.data.ces
}

function suggestSvt(slot) {
  return searchByName(servantPool(slot), slot.svtQuery, (svt) => `${svt.collectionNo} ${svt.name}`)
}

function suggestCe(slot) {
  return searchByName(cePool(slot), slot.ceQuery, (ce) => `${ce.collectionNo} ${ce.name}`)
}

function accountLine() {
  if (state.account) {
    const src = state.account.source === 'dump' ? '登录回包' : 'Chaldea'
    return `已导入${src}：${state.account.servants.length} 名从者，${state.account.ces.length} 张礼装。`
  }
  if (state.mode === 'account') return '账号配队：请导入 Chaldea userdata.json 或登录回包 JSON。'
  return '自由配队：可从完整图鉴搜索。'
}

function renderSuggest(items, kind, slot) {
  if (!items.length) return ''
  return `<div class="suggest" data-kind="${kind}">${items
    .map((item) => {
      if (kind === 'svt') {
        const rec = accountServantOf(state.account, item.id)
        const bond = rec ? (rec.bondLv >= 15 ? ' · 15绊' : ` · 绊${rec.bondLv}`) : ''
        return `<button type="button" class="suggest-item" data-svt="${item.id}">
          <img src="${esc(item.face)}" alt="" />
          <span>${esc(item.collectionNo)}. ${esc(item.name)} · ${classLabel(item.className)}${attrLabel(item.attribute)}${bond}</span>
        </button>`
      }
      return `<button type="button" class="suggest-item" data-ce="${item.id}">
        <img src="${esc(item.face || '')}" alt="" />
        <span>${esc(item.collectionNo)}. ${esc(item.name)}</span>
      </button>`
    })
    .join('')}</div>`
}

function renderCard(slot, output) {
  const res = resultOf(slot.position, output)
  const teaList = slot.isSupport ? TEA_SUPPORT : TEA_SELF
  const teaValue = slot.isSupport ? slot.supportTea : slot.teaSelf
  const teaField = slot.isSupport ? 'supportTea' : 'teaSelf'
  const finalText = !slot.filled ? '—' : output.ok && res ? String(res.final) : '—'
  const svt = selectedSvt(slot)
  const ce = selectedCe(slot)
  const lines =
    slot.filled && res && res.eligible
      ? res.lines.map((line) => `<div><span>${esc(line.label)}</span><span>+${pct(line.pct)}</span></div>`).join('') +
        `<div><span>两段乘算</span><span>前排后 ${res.afterFront} / 第二层后 ${res.afterRate} / 肖像 ${res.flat} / 乘茶壶前 ${res.beforeTeapot}</span></div>`
      : ''

  return `
    <article class="card ${slot.filled ? '' : 'off'}" data-pos="${slot.position}">
      <div class="card-head">
        <div class="identity">
          <div class="pos">0${slot.position}</div>
          ${svt ? `<img class="face" src="${esc(svt.face)}" alt="" />` : ''}
        </div>
        <div class="final"><small>最终羁绊</small>${finalText}</div>
      </div>
      <div class="search">
        <label>从者（Atlas）</label>
        <input data-q="svtQuery" type="text" placeholder="${state.mode === 'account' && !slot.isSupport ? '从持有从者里搜' : '搜编号或名字'}" value="${esc(slot.svtQuery || (svt ? svt.name : ''))}" />
        ${slot.svtQuery ? renderSuggest(suggestSvt(slot), 'svt', slot) : ''}
      </div>
      <div class="search">
        <label>羁绊礼装（Atlas）</label>
        <input data-q="ceQuery" type="text" placeholder="搜午餐 / 午茶 / 职阶礼装" value="${esc(slot.ceQuery || (ce ? ce.name : ''))}" />
        ${slot.ceQuery ? renderSuggest(suggestCe(slot), 'ce', slot) : ''}
      </div>
      <div class="toggles">
        <label class="check"><input data-k="filled" type="checkbox" ${slot.filled ? 'checked' : ''} /><span>上场</span></label>
        <label class="check"><input data-k="isSupport" type="checkbox" ${slot.isSupport ? 'checked' : ''} /><span>助战</span></label>
        <label class="check"><input data-k="bond15" type="checkbox" ${slot.bond15 ? 'checked' : ''} /><span>15绊</span></label>
        <label class="check"><input data-k="ceMlb" type="checkbox" ${slot.ceMlb ? 'checked' : ''} /><span>礼装满破</span></label>
        <label class="check"><input data-k="portrait" type="checkbox" ${slot.portrait ? 'checked' : ''} /><span>肖像 +50</span></label>
      </div>
      ${svt ? `<div class="meta">${classLabel(svt.className)} · ${attrLabel(svt.attribute)} · ${svt.rarity}星</div>` : ''}
      ${slot.ceMiss ? `<div class="reason">${esc(slot.ceMiss)}</div>` : ''}
      <details class="manual">
        <summary>手填加成</summary>
        <div class="grid">
          <div><label>午餐</label><select data-k="lunch">${options(LUNCH, slot.lunch)}</select></div>
          <div><label>午茶</label><select data-k="${teaField}">${options(teaList, teaValue)}</select></div>
          <div><label>芙尔摩斯</label><select data-k="holmes">${options(HOLMES, slot.holmes)}</select></div>
          <div><label>条件礼装</label><select data-k="condCe">${options(COND, slot.condCe)}</select></div>
          <div><label>活动被动</label><select data-k="eventPassive">${options(EVENT, slot.eventPassive)}</select></div>
          <div><label>自定义 %</label><input data-k="customPercent" type="number" step="1" value="${Math.round((Number(slot.customPercent) || 0) * 100)}" /></div>
        </div>
      </details>
      ${res && !res.eligible && slot.filled ? `<div class="reason">${res.reasonText}</div>` : ''}
      ${lines ? `<div class="lines">${lines}</div>` : ''}
    </article>
  `
}

function parseBase(raw) {
  if (raw === '' || raw === null) return NaN
  if (!/^\d+$/.test(String(raw))) return Number(raw)
  return Number(raw)
}

function preparedSlots() {
  const slots = state.slots.map((slot) => ({ ...slot, ceLines: [] }))
  applyCraftEssences(slots, state.data.ces)
  return slots
}

function render() {
  const slots = preparedSlots()
  const base = parseBase(state.base)
  const output = calcParty(base, state.teapot, slots)
  const app = document.getElementById('app')
  const front = slots.filter((s) => s.position <= 3)
  const back = slots.filter((s) => s.position > 3)
  const dataLine = state.data.error || state.data.status

  app.innerHTML = `
    <header>
      <div>
        <h1>通关羁绊</h1>
        <p class="sub">前排先乘 · 礼装活动15绊再乘 · 肖像最后加 · 茶壶 ×2</p>
      </div>
      <div class="seal">公式<br />已锁定</div>
    </header>
    <section class="controls">
      <div>
        <label>关卡基础羁绊</label>
        <input id="base" type="number" min="0" step="1" value="${esc(state.base)}" />
      </div>
      <div>
        <label>Atlas 关卡 ID / phase</label>
        <div class="quest-row">
          <input id="questId" type="number" placeholder="quest id" value="${esc(state.questId)}" />
          <input id="questPhase" type="number" min="1" value="${esc(state.questPhase)}" />
          <button id="loadQuest" type="button">读取基础羁绊</button>
        </div>
      </div>
      <div class="toggles">
        <button class="teapot ${state.teapot ? 'active' : ''}" id="teapot">${state.teapot ? '茶壶 ×2 开' : '茶壶关闭'}</button>
        <button id="sample" type="button">填入手算样例 1320</button>
        <button id="reset" type="button">重置编队</button>
      </div>
    </section>
    <section class="mode">
        <button type="button" id="modeFree" class="${state.mode === 'free' ? 'active' : ''}">自由配队</button>
        <button type="button" id="modeAccount" class="${state.mode === 'account' ? 'active' : ''}">账号配队</button>
        <label class="file">导入 Chaldea / 登录回包 JSON<input id="accountFile" type="file" accept="application/json,.json" /></label>
      </section>
    <div class="case ${output.ok && !state.data.error ? '' : 'error'}">${esc(output.caseText)} ${esc(accountLine())} ${esc(dataLine)}${state.questName ? ` 关卡：${esc(state.questName)}` : ''}</div>
    <p class="row-title">前排</p>
    <section class="row">${front.map((slot) => renderCard(slot, output)).join('')}</section>
    <p class="row-title">后排</p>
    <section class="row back">${back.map((slot) => renderCard(slot, output)).join('')}</section>
    <p class="formula">
      最终羁绊 = (floor(floor(基础 × (1 + 前排)) × (1 + Σ礼装活动15绊)) + 固定值) × 茶壶<br />
      游戏数据来自 Atlas 国服，失败时用仓库快照。账号 JSON 只留在浏览器。午餐/午茶/福尔摩斯按数据是全队光环。前排单独先乘一层；礼装、活动被动、15绊在第二层加算后乘。
    </p>
  `

  bind(app)
}

function bind(app) {
  document.getElementById('modeFree').addEventListener('click', () => {
    state.mode = 'free'
    render()
  })
  document.getElementById('modeAccount').addEventListener('click', () => {
    state.mode = 'account'
    render()
  })
  document.getElementById('accountFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const parsed = parseAccount(await file.text())
    if (!parsed.ok) {
      state.account = null
      state.data.error = parsed.error
    } else {
      state.account = parsed
      state.mode = 'account'
      state.data.error = ''
    }
    render()
  })
  const baseEl = document.getElementById('base')
  baseEl.addEventListener('input', (event) => {
    const start = event.target.selectionStart
    state.base = event.target.value
    render()
    const next = document.getElementById('base')
    next.focus()
    if (typeof start === 'number') next.setSelectionRange(start, start)
  })
  document.getElementById('teapot').addEventListener('click', () => {
    state.teapot = !state.teapot
    render()
  })
  document.getElementById('sample').addEventListener('click', () => {
    state.base = '815'
    state.teapot = false
    state.slots = [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position === 1))
    state.slots[0].lunch = 0.1
    state.slots[0].teaSelf = 0.05
    state.slots[0].condCe = 0.2
    render()
  })
  document.getElementById('reset').addEventListener('click', () => {
    state.slots = [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position <= 3))
    render()
  })
  document.getElementById('questId').addEventListener('change', (event) => {
    state.questId = event.target.value
  })
  document.getElementById('questPhase').addEventListener('change', (event) => {
    state.questPhase = event.target.value
  })
  document.getElementById('loadQuest').addEventListener('click', async () => {
    const id = Number(state.questId || document.getElementById('questId').value)
    const phase = Number(state.questPhase || document.getElementById('questPhase').value || 1)
    try {
      const quest = await fetchQuestBond(id, phase)
      state.base = String(quest.bond || 0)
      state.questName = quest.name
      state.data.error = ''
    } catch (err) {
      state.data.error = '关卡未找到，检查 ID / phase'
    }
    render()
  })

  app.querySelectorAll('.card').forEach((card) => {
    const pos = Number(card.dataset.pos)
    const slot = state.slots[pos - 1]

    card.querySelectorAll('[data-q]').forEach((el) => {
      el.addEventListener('input', (event) => {
        const start = event.target.selectionStart
        slot[el.dataset.q] = event.target.value
        if (el.dataset.q === 'svtQuery') slot.svtId = 0
        if (el.dataset.q === 'ceQuery') slot.ceId = 0
        render()
        const next = document.querySelector(`.card[data-pos="${pos}"] [data-q="${el.dataset.q}"]`)
        if (next) {
          next.focus()
          if (typeof start === 'number') next.setSelectionRange(start, start)
        }
      })
    })

    card.querySelectorAll('[data-svt]').forEach((el) => {
      el.addEventListener('click', async () => {
        const svt = state.data.servants.find((item) => item.id === Number(el.dataset.svt))
        if (!svt) return
        slot.svtId = svt.id
        slot.label = svt.name
        slot.svtQuery = ''
        slot.face = svt.face
        slot.className = svt.className
        slot.attribute = svt.attribute
        slot.traitIds = svt.traitIds
        slot.filled = true
        if (state.mode === 'account' && !slot.isSupport) {
          const rec = accountServantOf(state.account, svt.id)
          slot.bond15 = Boolean(rec && rec.bondLv >= 15)
        }
        render()
        const passives = await fetchServantPassives(svt.id)
        slot.eventPassive = passives
          .filter((passive) => passive.target !== 'ptFull')
          .reduce((sum, passive) => sum + passive.rate, 0)
        render()
      })
    })

    card.querySelectorAll('[data-ce]').forEach((el) => {
      el.addEventListener('click', () => {
        const ce = state.data.ces.find((item) => item.id === Number(el.dataset.ce))
        if (!ce) return
        slot.ceId = ce.id
        slot.ceQuery = ''
        slot.lunch = 0
        slot.teaSelf = 0
        slot.supportTea = 0
        slot.holmes = 0
        slot.condCe = 0
        slot.filled = true
        if (state.mode === 'account' && !slot.isSupport) {
          const rec = accountCeOf(state.account, ce.id)
          if (rec) slot.ceMlb = rec.mlb
        }
        render()
      })
    })

    card.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener('change', () => {
        if (el.type === 'checkbox') {
          slot[el.dataset.k] = el.checked
          if (el.dataset.k === 'isSupport' && el.checked) {
            state.slots.forEach((other) => {
              if (other.position !== slot.position) other.isSupport = false
            })
            slot.teaSelf = 0
          }
          if (el.dataset.k === 'isSupport' && !el.checked) slot.supportTea = 0
        } else if (el.dataset.k === 'customPercent') {
          slot.customPercent = (Number(el.value) || 0) / 100
        } else {
          slot[el.dataset.k] = Number(el.value)
        }
        render()
      })
    })
  })
}

async function boot() {
  render()
  try {
    const [servants, ces] = await Promise.all([loadServants(), loadCes()])
    state.data.servants = servants
    state.data.ces = ces
    state.data.status = `已接入 Atlas/Chaldea 国服：${servants.length} 名从者，${ces.length} 张羁绊礼装。`
    state.data.error = ''
  } catch (err) {
    state.data.error = 'Atlas 数据拉取失败，仍可手填加成。'
  }
  render()
}

boot()
