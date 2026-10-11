// Rebuild all metadata, theoretical data, scripts and interval exports together.
// Patching only the scripts can otherwise leave stale anonymous cache data.
import {execFileSync} from 'node:child_process'
execFileSync(process.execPath,['--expose-gc','--max-old-space-size=4096','scripts/quest-global-curves/build-review.mjs',...process.argv.slice(2)],{stdio:'inherit'})
