import { APP_VERSION, createAiUpdater } from './ai-update.js'
import { createAiSettings } from './ai-settings.js'

let storage
try { storage = globalThis.localStorage } catch { /* offline built-in model remains usable */ }
export const aiUpdater = createAiUpdater({ storage })
export const aiSettings = createAiSettings({ storage })

export async function mountAiUpdates() {
  const panel = document.createElement('details'), summary = document.createElement('summary')
  panel.className = 'formula'; panel.id = 'ai-updates'
  summary.textContent = `软件 ${APP_VERSION} · AI 辅助与模型更新`
  const label = document.createElement('label'), toggle = document.createElement('input'), hint = document.createElement('p')
  toggle.type = 'checkbox'; toggle.id = 'ai-enabled'; toggle.checked = aiSettings.enabled
  label.append(toggle, ' 使用 AI 辅助搜索（可随时关闭）')
  hint.textContent = '默认关闭。开启后先核实 AI 候选，再完成精确搜索；部分条件可能更慢。选择仅影响下次新查询，正在计算的任务继续使用开始时的设置。更新模型不会开启 AI。'
  const status = document.createElement('p'), check = document.createElement('button'), reset = document.createElement('button')
  status.setAttribute('role', 'status')
  check.type = reset.type = 'button'
  check.textContent = '通过 GitHub 更新 AI'; reset.textContent = '恢复内置模型'
  const show = note => { status.textContent = `当前模型：${aiUpdater.model.version}。${note}` }
  toggle.onchange = () => {
    const result = aiSettings.setEnabled(toggle.checked)
    show(`AI 辅助已${aiSettings.enabled ? '开启' : '关闭'}，下次新查询生效。${result.persisted ? '选择已保存。' : '当前选择仅在本次打开期间有效。'}`)
  }
  show('模型只提供搜索建议，最终结果由精确算法核实。')
  check.onclick = async () => {
    check.disabled = reset.disabled = true
    show('正在检查 GitHub…')
    try {
      const result = await aiUpdater.update()
      show(result.changed ? '更新已保存，下次新查询使用。' : '当前已是可用模型；离线训练候选不会自动启用。')
    } catch (error) { show(`${error.message}。继续使用当前模型。`) }
    finally { check.disabled = reset.disabled = false }
  }
  reset.onclick = () => {
    try { aiUpdater.reset(); show('已恢复内置模型，下次新查询使用。') }
    catch { show('无法清除本地模型，请检查存储权限。') }
  }
  panel.append(summary, label, hint, status, check, reset)
  document.body.append(panel)
  check.disabled = reset.disabled = true
  const result = await aiUpdater.restore()
  show(result.fallback ? '已保存模型不可用，已回退到内置模型。' : '离线训练候选未默认启用。')
  check.disabled = reset.disabled = false
}
