import { Worker } from 'node:worker_threads'
import { readFileSync, mkdirSync, appendFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const folder = 'experiments/ai-conditioned'
mkdirSync(folder + '/data', { recursive: true }); mkdirSync(folder + '/reports', { recursive: true })
const path = folder + '/data/repaired.jsonl'
const previous = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []
const done = new Set(previous.filter(r => r.status === 'ok').map(r => r.split + ':' + r.index))
const pending = ['train', 'validation', 'test'].flatMap(split => gunzipSync(readFileSync(`experiments/ai-diverse/data/${split}.jsonl.gz`)).toString().trim().split('\n').map(JSON.parse).filter(r => r.status !== 'ok').map(r => ({ split, index: r.index, family: r.family }))).filter(r => !done.has(r.split + ':' + r.index))
const jobs = pending.map(task => ({ ...task, state: 'running', started: Date.now() }))
const save = () => writeFileSync(folder + '/reports/teacher-repair.json', JSON.stringify({ searchTimeLimit: 'none', jobs: jobs.map(({facts,...j}) => j), priorCompleted: done.size }, null, 2) + '\n')
const heartbeat = setInterval(() => { save(); console.log(JSON.stringify(jobs.map(j => ({ split: j.split, index: j.index, state: j.state, elapsedSeconds: Math.round((Date.now() - j.started) / 1000) })))) }, 15000)
save()
try {
  await Promise.all(jobs.map(async (job, slot) => {
    const w = new Worker(new URL('./ai-diverse-worker.mjs', import.meta.url), { workerData: { slot: 8000 + slot, baseline: process.env.FGO_AI_TEACHER_BASELINE }, resourceLimits: { maxOldGenerationSizeMb: 768 } })
    try {
      await new Promise((resolve, reject) => { w.once('message', m => m.ready ? resolve() : reject(Error('not ready'))); w.once('error', reject) })
      const result = await new Promise((resolve, reject) => {
        w.once('message', resolve); w.once('error', reject); w.once('exit', code => reject(Error('teacher exited ' + code)))
        w.postMessage({ ...job, id: slot, labels: true, mode: 'off', parity: true })
      })
      const row = { split: job.split, index: job.index, family: job.family, ...result }
      appendFileSync(path, JSON.stringify(row) + '\n')
      appendFileSync(folder + '/data/repaired-' + job.split + '.jsonl', JSON.stringify(row) + '\n')
      job.state = result.status; job.referenceParity = result.status === 'ok'; job.ms = result.ms
      if (result.status !== 'ok') job.error = result.error
      console.log('Recovered', job.split, job.index, job.state, job.ms)
    } catch (e) { job.state = 'error'; job.error = String(e) }
    finally { await w.terminate(); save() }
  }))
} finally { clearInterval(heartbeat); save() }
if (jobs.some(j => j.state !== 'ok')) process.exitCode = 1
