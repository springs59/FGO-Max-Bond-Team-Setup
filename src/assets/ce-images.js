export function ceImageUrls(ce) {
  const id = Number(ce && ce.id) || 0
  const urls = []
  if (ce && ce.face) urls.push(ce.face)
  if (id) {
    urls.push(`https://static.atlasacademy.io/JP/EquipFaces/f_${id}.png`)
    urls.push(`https://static.atlasacademy.io/CN/EquipFaces/f_${id}.png`)
    urls.push(`https://static.atlasacademy.io/JP/Equip/${id}.png`)
    urls.push(`./src/data/ce-img/${id}.png`)
  }
  return [...new Set(urls.filter(Boolean))]
}

export function ceIcon(ce) {
  return ceImageUrls(ce)[0] || ''
}
