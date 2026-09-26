import assert from 'node:assert/strict'
import { ceImageUrls } from './ce-images.js'

const urls = ceImageUrls({
  id: 9300010,
  face: 'https://static.atlasacademy.io/CN/Faces/f_93000100.png',
})

assert.equal(urls[0], 'https://static.atlasacademy.io/CN/Faces/f_93000100.png')
assert.ok(urls.includes('https://static.atlasacademy.io/JP/EquipFaces/f_93000100.png'))
