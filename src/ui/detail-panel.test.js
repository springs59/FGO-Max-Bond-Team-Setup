import assert from 'node:assert/strict'
import { renderDetailPanel } from './detail-panel.js'

const html = renderDetailPanel({
  detail: { kind: 'svt', id: 100100 },
  servants: [{ id: 100100, name: '阿尔托莉雅', className: 'Saber' }],
  tab: 'recv',
})

assert.match(html, /detail-backdrop/)
assert.match(html, /data-detail-tab="recv"/)
assert.match(html, /data-detail-tab="give"/)
assert.match(html, /可以吃到/)
assert.match(html, /可以提供/)
assert.match(html, /CharaGraph\/100100\/100100a@1\.png/)
assert.match(html, /detail-tab-body" data-tab="give" hidden/)

const give = renderDetailPanel({
  detail: { kind: 'svt', id: 100100 },
  servants: [{ id: 100100, name: '阿尔托莉雅', className: 'Saber' }],
  tab: 'give',
})
assert.match(give, /detail-tab active" data-detail-tab="give"/)
