export function openFormationReview(context) {
  const dialog = document.createElement('dialog')
  dialog.className = 'formation-review-dialog'
  const iframe = document.createElement('iframe')
  iframe.title = '配队求解器 · 编队条件、活动效果与曲线检查'
  parent.fgoFormationReviewContext = { ...structuredClone(context), close: () => dialog.close() }
  iframe.src = new URL('../../formation.html', import.meta.url).href
  dialog.append(iframe)
  dialog.addEventListener('close', () => { iframe.src = 'about:blank'; delete parent.fgoFormationReviewContext; dialog.remove() })
  document.body.append(dialog)
  dialog.showModal()
}
