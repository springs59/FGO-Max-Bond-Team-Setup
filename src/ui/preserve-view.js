// Result streaming must not discard an unfinished edit in the comparison UI.
export function preserveView(render){
  const active=document.activeElement,scroll=[window.scrollX,window.scrollY]
  const selector=active?.id?'#'+CSS.escape(active.id):active?.matches('[data-comparison-query],[data-comparison-field],[data-comparison-name]')?
    [...active.attributes].filter(a=>a.name.startsWith('data-')).map(a=>'['+a.name+'='+JSON.stringify(a.value)+']').join(''):null
  const value=active?.value,checked=active?.checked,start=active?.selectionStart,end=active?.selectionEnd
  const anchorTop=active?.matches('input,textarea,select')?active.getBoundingClientRect().top:null
  render()
  const next=selector&&document.querySelector(selector)
  if(next){
    if(value!==undefined)next.value=value
    if(checked!==undefined)next.checked=checked
    next.focus({preventScroll:true})
    if(start!=null&&next.setSelectionRange)try{next.setSelectionRange(start,end)}catch{}
  }
  window.scrollTo(scroll[0],scroll[1]+(next&&anchorTop!=null?next.getBoundingClientRect().top-anchorTop:0))
}
