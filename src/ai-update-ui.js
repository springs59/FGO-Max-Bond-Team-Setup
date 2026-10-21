import { APP_VERSION, createAiUpdater } from './ai-update.js'
import { createAiSettings } from './ai-settings.js'
import { AI_CHOICES } from './solver/query-models.js'

let storage
try { storage = globalThis.localStorage } catch { /* offline built-in models remain usable */ }
export const aiUpdater = createAiUpdater({ storage })
export const aiSettings = createAiSettings({ storage })

export async function mountAiUpdates() {
  const panel = document.createElement('details'), summary = document.createElement('summary')
  panel.className = 'formula'; panel.id = 'ai-updates'
  summary.textContent = `软件 ${APP_VERSION} · AI 辅助与模型更新`
  const choiceLabel = document.createElement('label'), choice = document.createElement('select')
  choice.id = 'ai-query-model'
  choice.setAttribute('aria-describedby', 'ai-choice-description ai-choice-hint')
  for (const model of AI_CHOICES) {
    const option = document.createElement('option')
    option.value = model.id; option.textContent = model.label
    choice.append(option)
  }
  choice.value = aiSettings.selection
  choiceLabel.append('AI 模式：', choice)
  const modelHint = document.createElement('p')
  modelHint.id = 'ai-choice-description'; modelHint.setAttribute('aria-live', 'polite')
  const hint = document.createElement('p')
  hint.id = 'ai-choice-hint'
  hint.textContent = '默认不使用 AI。启用后每次新查询最多调用所选模型一次，最终答案仍由精确求解器确定；命中结果缓存不调用。不同条件表现有差异，起点更高不保证更快。选择下次新查询生效，更新模型不会开启 AI。'
  const descriptions = document.createElement('ul')
  descriptions.id = 'ai-model-descriptions'
  for (const model of AI_CHOICES) {
    const item = document.createElement('li'), name = document.createElement('strong')
    name.textContent = model.label + '：'
    item.append(name, model.description); descriptions.append(item)
  }
  const status = document.createElement('p'), check = document.createElement('button'), reset = document.createElement('button')
  status.setAttribute('role', 'status')
  check.type = reset.type = 'button'
  check.textContent = '通过 GitHub 更新 AI'; reset.textContent = '恢复内置模型'
  const show = note => {
    const selected = AI_CHOICES.find(model => model.id === aiSettings.selection)
    modelHint.textContent = selected.description
    status.textContent = `当前选择：${selected.label}。${note}`
  }
  choice.onchange = () => {
    const result = aiSettings.setSelection(choice.value)
    show(`下次新查询生效。${result.persisted ? '选择已保存。' : '当前选择仅在本次打开期间有效。'}`)
  }
  show('可选择一个 AI，或直接使用精确求解器。')
  check.onclick = async () => {
    check.disabled = reset.disabled = true
    show('正在检查 GitHub…')
    try {
      const result = await aiUpdater.update()
      show(result.changed ? '更新已保存，下次新查询使用。' : '当前已是可用模型。')
    } catch (error) { show(`${error.message}。继续使用当前模型。`) }
    finally { check.disabled = reset.disabled = false }
  }
  reset.onclick = () => {
    try { aiUpdater.reset(); show('已恢复内置模型，AI 模式保持当前选择。') }
    catch { show('无法清除本地模型，请检查存储权限。') }
  }
  panel.append(summary, choiceLabel, modelHint, hint, descriptions, status, check, reset)
  document.body.append(panel)
  check.disabled = reset.disabled = true
  const result = await aiUpdater.restore()
  show(result.fallback ? '已保存模型不可用，已回退到内置模型；AI 模式保持当前选择。' : '选择一个 AI，或保持不使用 AI。')
  check.disabled = reset.disabled = false
}
