import assert from 'node:assert/strict'
import { servantDetailUrls, servantFaceUrls, servantGraphUrls } from './servant-images.js'

const saber = { id: 100100, face: 'https://static.atlasacademy.io/CN/Faces/f_1001000.png' }

const faces = servantFaceUrls(saber)
assert.ok(faces.includes(saber.face))
assert.ok(faces.includes('https://static.atlasacademy.io/JP/Faces/f_1001000.png'))

const graphs = servantGraphUrls(saber)
assert.ok(graphs[0].includes('/CharaGraph/100100/100100a%401.png'))

const detail = servantDetailUrls(saber)
assert.equal(detail[0], graphs[0])
assert.ok(detail.includes(saber.face))
