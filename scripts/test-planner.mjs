import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = await mkdtemp(join(tmpdir(), 'cornell-planner-tests-'))
try {
  const outfile = join(dir, 'tests.cjs')
  await build({ entryPoints: ['scripts/test-planner.ts'], bundle: true, platform: 'node', format: 'cjs', outfile })
  process.exitCode = spawnSync(process.execPath, [outfile], { stdio: 'inherit' }).status ?? 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
