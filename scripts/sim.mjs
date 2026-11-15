import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const simulator = dirname(require.resolve('@geastack/simulator/package.json'))
process.argv = [
  process.execPath,
  join(simulator, 'targets/web/dev-web.mjs'),
  '--app-dir', process.cwd(),
  '--host', '127.0.0.1',
  '--port', '5181',
  '--emulator',
  '--width', '466',
  '--height', '466',
]
await import(process.argv[1])
