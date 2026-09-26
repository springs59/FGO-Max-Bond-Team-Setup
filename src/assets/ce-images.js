export function ceImageUrls(ce) {
  const id = Number(ce && ce.id) || 0
  const urls = []
  if (ce && ce.face) urls.push(ce.face)
  if (id) {
    for (const code of ['CN', 'JP']) {
      urls.push(`https://static.atlasacademy.io/${code}/Faces/f_${id}0.png`)
      urls.push(`https://static.atlasacademy.io/${code}/EquipFaces/f_${id}0.png`)
    }
    urls.push(`./src/data/ce-img/${id}.png`)
  }
  return [...new Set(urls.filter(Boolean))]
}

export function ceIcon(ce) {
  return ceImageUrls(ce)[0] || ''
}
