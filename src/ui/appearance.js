const KEY = 'fgo_bond_appearance_v1'
export const PALETTES = {
  white: { ink:'#f3f5f8', panel:'#ffffff', 'panel-2':'#eef3fa', line:'#d8e0eb', gold:'#2863c7', 'gold-2':'#17468e', cream:'#202d40', mute:'#5c6d83', wax:'#b83832', front:'#edf3ff', ok:'#246746' },
  brown: { ink:'#140c09', panel:'#221510', 'panel-2':'#2c1b14', line:'#765840', gold:'#e2b57a', 'gold-2':'#f3d7a8', cream:'#f6ead7', mute:'#b8a28c', wax:'#df7770', front:'#3a2418', ok:'#d8c19a' },
}
export const DEFAULT_APPEARANCE = { theme:'white', layout:'multi', colors:{}, backgroundImage:'' }
const fields = { background:'ink', panel:'panel', text:'cream', accent:'gold' }
export function normalizeAppearance(value) {
  const colors = {}
  for (const key of Object.keys(fields)) if (/^#[0-9a-f]{6}$/i.test(value?.colors?.[key])) colors[key]=value.colors[key]
  const image = typeof value?.backgroundImage === 'string' && value.backgroundImage.length <= 7*1024*1024 &&
    /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value.backgroundImage) ? value.backgroundImage : ''
  return { theme:value?.theme==='brown'?'brown':'white', layout:value?.layout==='single'?'single':'multi', colors, backgroundImage:image }
}
export function loadAppearance(storage) {
  try { return normalizeAppearance(JSON.parse((storage ?? globalThis.localStorage)?.getItem(KEY) || 'null')) } catch { return normalizeAppearance(null) }
}
export function saveAppearance(value, storage) {
  try { (storage ?? globalThis.localStorage).setItem(KEY,JSON.stringify(normalizeAppearance(value))); return true } catch { return false }
}
function mix(a,b,t) {
  const rgb=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16))
  const x=rgb(a), y=rgb(b)
  return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('')
}
function contrasting(hex) {
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  return c[0]*.2126+c[1]*.7152+c[2]*.0722>.179?'#140c09':'#ffffff'
}
export function appearancePalette(value) {
  const v=normalizeAppearance(value), p={...PALETTES[v.theme]}
  for(const [key,variable] of Object.entries(fields)) if(v.colors[key]) p[variable]=v.colors[key]
  if(Object.keys(v.colors).length) {
    p['panel-2']=mix(p.panel,p.cream,.06); p.line=mix(p.panel,p.cream,.25)
    p.mute=mix(p.panel,p.cream,.72); p.front=mix(p.panel,p.gold,.12)
    p['gold-2']=p.gold
  }
  p['on-accent']=contrasting(p.gold)
  return p
}
export function applyAppearance(value, root=document.documentElement) {
  const v=normalizeAppearance(value)
  root.dataset.theme=v.theme; root.dataset.layout=v.layout; root.dataset.hasBackground=String(Boolean(v.backgroundImage))
  for(const [key,color] of Object.entries(appearancePalette(v))) root.style.setProperty('--'+key,color)
  root.style.setProperty('--page-image',v.backgroundImage ? `url("${v.backgroundImage}")` : v.theme==='brown' && !v.colors.background ? 'radial-gradient(1200px 600px at 10% -10%, #3a2218 0%, transparent 55%), radial-gradient(900px 500px at 110% 10%, #4a1d18 0%, transparent 50%)' : 'none')
  root.style.colorScheme=v.theme==='brown'?'dark':'light'
}
