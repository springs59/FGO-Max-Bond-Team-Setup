import assert from 'node:assert/strict'
import {fork} from 'node:child_process'
// The deadline can arrive after a feasible AI preview but before the first
// enumerated record. That preview remains the best known result, not null/0.
const row=await new Promise((resolve,reject)=>{
 const child=fork(new URL('./all-score-teams-wide-child.mjs',import.meta.url),['CN-open','baseline','0'],{stdio:['ignore','ignore','pipe','ipc']})
 const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Pressure reporter did not stop'))},15000)
 child.on('message',m=>{if(m.type==='result'){clearTimeout(timer);resolve(m.value)}})
 child.on('error',reject)
 child.on('exit',code=>{clearTimeout(timer);if(code)reject(Error('Pressure reporter exited '+code))})
})
assert.equal(row.status,'timeout');assert.equal(row.complete,false);assert.equal(row.maximumProven,false)
assert.ok(row.initialScore>0);assert.equal(row.best,row.initialScore);assert.equal(row.bestEnumerated,null)
assert.equal(row.tiedTeams,0);assert.ok(row.firstFeasibleMs>=0);assert.equal(row.ai.inferenceCalls,1)
assert.equal(Object.hasOwn(row.ai,'initialStart'),false,'Public pressure logs contain metrics, not full team payloads')
console.log(JSON.stringify({passed:true,coverage:'feasible AI preview survives a deadline before the first enumerated team; incomplete remains explicit; report metadata is minimized'}))
