/**
 * 开发环境启动脚本：启动 Vite 前端开发服务器
 *
 * 纯前端模式：所有数据均通过前端直连第三方 API（东方财富等，均支持 CORS），
 * 无需后端服务。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const COLORS = { client: '32', system: '33' } // 32=green, 33=yellow

function log(name, msg) {
  const prefix = `\x1b[${COLORS[name] || '0'}m[${name}]\x1b[0m`
  process.stdout.write(`${prefix} ${msg}\n`)
}

function startProcess(name, command, args, useShell = false) {
  const prefix = `\x1b[${COLORS[name] || '0'}m[${name}]\x1b[0m`
  const proc = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: useShell,
    cwd: __dirname,
  })

  const print = (stream, data) => {
    data.toString()
      .split('\n')
      .forEach((line) => {
        if (line.length) stream.write(`${prefix} ${line}\n`)
      })
  }
  proc.stdout.on('data', (d) => print(process.stdout, d))
  proc.stderr.on('data', (d) => print(process.stderr, d))
  proc.on('error', (err) => {
    log(name, `进程启动失败: ${err.message}`)
  })
  return proc
}

// ==================== 主流程 ====================
const procs = []

function main() {
  log('client', '正在启动 Vite 前端开发服务器...')
  const viteBin = resolve(__dirname, 'node_modules/vite/bin/vite.js')
  let clientProc
  if (existsSync(viteBin)) {
    clientProc = startProcess('client', 'node', [viteBin])
  } else {
    clientProc = startProcess('client', 'npx', ['vite'], true)
  }
  procs.push(clientProc)
}

// Ctrl+C 时终止所有子进程
function killAll() {
  procs.forEach((p) => {
    try { p.kill() } catch { /* ignore */ }
  })
  process.exit(0)
}
process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)
process.on('exit', () => {
  procs.forEach((p) => {
    try { p.kill() } catch { /* ignore */ }
  })
})

main()
