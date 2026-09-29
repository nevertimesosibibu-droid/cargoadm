import { cp, copyFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const distPath = join(projectRoot, 'dist')

await copyFile(join(distPath, 'app.html'), join(distPath, 'index.html'))
await rm(join(projectRoot, 'assets'), { recursive: true, force: true })
await cp(join(distPath, 'assets'), join(projectRoot, 'assets'), { recursive: true })
await copyFile(join(distPath, 'index.html'), join(projectRoot, 'index.html'))
await copyFile(join(distPath, 'favicon.svg'), join(projectRoot, 'favicon.svg'))