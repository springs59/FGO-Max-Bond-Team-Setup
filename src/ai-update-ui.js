import { APP_VERSION, createAiUpdater } from './ai-update.js'

let storage
try { storage = globalThis.localStorage } catch { /* offline built-in model remains usable */ }
export const aiUpdater = createAiUpdater({ storage })

export async function mountAiUpdates() {
  const panel = document.createElement('details'), summary = document.createElement('summary')
  panel.className = 'formula'; panel.id = 'ai-updates'
  summary.textContent = `软件 ${APP_VERSION} · AI 模型更新`
  const status = document.createElement('p'), check = document.createElement('button'), reset = document.createElement('button')
  status.setAttribute('role', 'status')
  check.type = reset.type = 'button'
  check.textContent = '通过 GitHub 更新 AI'; reset.textContent = '恢复内置模型'
  const show = note => { status.textContent = `当前模型：${aiUpdater.model.version}。${note}` }
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
  panel.append(summary, status, check, reset)
  document.body.append(panel)
  check.disabled = reset.disabled = true
  const result = await aiUpdater.restore()
  show(result.fallback ? '已保存模型不可用，已回退到内置模型。' : '离线训练候选未默认启用。')
  check.disabled = reset.disabled = false
}
