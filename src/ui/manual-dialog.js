import { saveBlob } from '../../native/shared/file-save.js'
import { isNative } from '../../native/shared/store.js'

const PDF_NAME = 'FGO-Bond-Team-Manual.pdf'

export async function downloadManualPdf(href, button) {
  const label = button?.textContent
  if (button) { button.disabled = true; button.textContent = '正在准备…' }
  try {
    const response = await fetch(href)
    if (!response.ok) throw Error('无法读取说明书 PDF')
    await saveBlob(await response.blob(), PDF_NAME)
  } catch (error) {
    alert(`说明书 PDF 下载失败：${error.message}`)
  } finally {
    if (button && button.isConnected) { button.disabled = false; button.textContent = label }
  }
}

export function openManual() {
  const dialog = document.createElement('dialog')
  dialog.className = 'manual-dialog'
  dialog.setAttribute('aria-label', '操作说明书')
  const head = document.createElement('header')
  head.className = 'manual-dialog-head'
  const title = document.createElement('strong')
  title.textContent = '操作说明书'
  const actions = document.createElement('span')
  actions.className = 'manual-dialog-actions'
  const pdfHref = new URL('../../docs/manual/FGO-Bond-Team-Manual.pdf', import.meta.url).href
  const htmlHref = new URL('../../docs/manual/index.html', import.meta.url).href
  const pdf = document.createElement('button')
  pdf.type = 'button'
  pdf.textContent = '下载 PDF'
  pdf.addEventListener('click', () => downloadManualPdf(pdfHref, pdf))
  const open = document.createElement('a')
  open.className = 'manual-dialog-link'
  open.href = htmlHref
  open.target = '_blank'
  open.rel = 'noopener'
  open.textContent = '新窗口打开'
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '关闭'
  close.addEventListener('click', () => dialog.close())
  actions.append(pdf)
  if (!isNative()) actions.append(open)
  actions.append(close)
  head.append(title, actions)
  const frame = document.createElement('iframe')
  frame.title = '羁绊配队操作说明书'
  frame.src = htmlHref
  dialog.append(head, frame)
  dialog.addEventListener('close', () => { frame.src = 'about:blank'; dialog.remove() })
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  document.body.append(dialog)
  dialog.showModal()
}
