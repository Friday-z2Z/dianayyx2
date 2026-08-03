/**
 * 开发环境启动脚本：先启动后端 (Flask)，等待就绪后再启动前端 (Vite)
 *
 * 启动顺序：后端先启动 → 轮询 health 接口确认就绪 → 启动 Vite
 * 避免前端先就绪、浏览器发请求时后端还没启动导致 502。
 *
 * 健壮性设计：
 * - 自动探测 python 可执行文件路径（python / python3 / py / 完整路径）
 * - 不依赖 shell 模式，避免 cmd.exe 不在 PATH 的问题
 * - 后端进程崩溃时立即报错，不傻等超时
 * - 端口被占用时自动提示
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import net from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 5001
const HEALTH_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/akshare/health`
const HEALTH_TIMEOUT = 60000  // 后端最长等待 60 秒（akshare 导入较慢）
const POLL_INTERVAL = 500     // 每 500ms 轮询一次

const COLORS = { server: '36', client: '32', system: '33' } // 36=cyan, 32=green, 33=yellow

function log(name, msg) {
  const prefix = `\x1b[${COLORS[name] || '0'}m[${name}]\x1b[0m`
  process.stdout.write(`${prefix} ${msg}\n`)
}

function logError(name, msg) {
  const prefix = `\x1b[${COLORS[name] || '0'}m[${name}]\x1b[0m`
  process.stderr.write(`${prefix} ${msg}\n`)
}

/**
 * 检查端口是否被占用
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(true))
    tester.once('listening', () => {
      tester.close(() => resolve(false))
    })
    tester.listen(port)
  })
}

/**
 * 探测 python 可执行文件完整路径
 * 依次尝试: PATH 中的 python → py launcher → TRAE 内置 python → 常见安装路径
 */
function findPython() {
  // 第一轮：PATH 中的命令名
  const candidates = ['python', 'python3']
  if (process.platform === 'win32') {
    candidates.push('py')
  }

  for (const cmd of candidates) {
    try {
      const output = execFileSync(cmd, ['--version'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      if (output) {
        log('system', `找到 Python (PATH): ${cmd} (${output})`)
        if (cmd === 'py') return { cmd: 'py', args: ['-3'] }
        return { cmd, args: [] }
      }
    } catch {
      // 继续尝试下一个
    }
  }

  // 第二轮：TRAE 内置 Python（用户在外部终端运行时 PATH 中可能没有）
  const traePaths = [
    join(process.env.APPDATA || '', 'TRAE SOLO CN', 'ModularData', 'ai-agent', 'vm', 'tools', 'python', 'python.exe'),
    join(process.env.APPDATA || '', 'TRAE SOLO CN', 'ModularData', 'ai-agent', 'vm', 'tools', 'bin', 'python.exe'),
  ]
  for (const p of traePaths) {
    if (p && existsSync(p)) {
      try {
        const output = execFileSync(p, ['--version'], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
        log('system', `找到 Python (TRAE内置): ${p} (${output})`)
        return { cmd: p, args: [] }
      } catch {
        // 文件存在但无法执行，继续
      }
    }
  }

  // 第三轮：常见安装路径（Windows）
  if (process.platform === 'win32') {
    const commonPaths = [
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
      'C:\\Python310\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python312\\python.exe',
    ]
    for (const p of commonPaths) {
      if (p && existsSync(p)) {
        log('system', `找到 Python: ${p}`)
        return { cmd: p, args: [] }
      }
    }
  }

  return null
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
    logError(name, `进程启动失败: ${err.message}`)
  })
  return proc
}

/**
 * 轮询后端 health 接口，确认后端已就绪
 */
function waitForBackend(serverProc) {
  return new Promise((resolve) => {
    const startTime = Date.now()

    // 如果后端进程已经退出，直接返回失败
    let exited = false
    serverProc.on('close', (code) => {
      exited = true
      if (Date.now() - startTime < HEALTH_TIMEOUT) {
        logError('server', `后端进程提前退出 (退出码 ${code})，请检查上方错误信息`)
        resolve(false)
      }
    })

    const check = () => {
      if (exited) return

      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          resolve(true)
        } else {
          retry()
        }
        res.resume()
      })
      req.on('error', () => retry())
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }

    const retry = () => {
      if (exited) return
      if (Date.now() - startTime > HEALTH_TIMEOUT) {
        resolve(false)
      } else {
        setTimeout(check, POLL_INTERVAL)
      }
    }

    // 等待 1 秒后开始轮询（给 python 进程启动时间）
    setTimeout(check, 1000)
  })
}

// ==================== 主流程 ====================
const procs = []

async function main() {
  // 0. 检查端口是否已被占用
  const portInUse = await isPortInUse(BACKEND_PORT)
  if (portInUse) {
    log('system', `警告: 端口 ${BACKEND_PORT} 已被占用，可能后端已在运行`)
    log('system', `如需重启，请先关闭占用端口的进程，或直接访问 http://localhost:5173/dianayyx2/`)
  }

  // 1. 探测 python 路径
  log('system', '正在探测 Python 路径...')
  const python = findPython()
  if (!python) {
    logError('server', '========================================')
    logError('server', '错误: 未找到 Python 可执行文件！')
    logError('server', '请确保 Python 已安装并添加到 PATH，或手动启动后端：')
    logError('server', '  python server/akshare_api.py')
    logError('server', '========================================')
    process.exit(1)
  }

  // 2. 启动后端
  const serverScript = resolve(__dirname, 'server', 'akshare_api.py')
  if (!existsSync(serverScript)) {
    logError('server', `错误: 后端脚本不存在: ${serverScript}`)
    process.exit(1)
  }

  log('server', `正在启动 Python Flask 后端服务 (${python.cmd} ${python.args.join(' ')} ${serverScript})...`)
  const serverProc = startProcess('server', python.cmd, [...python.args, serverScript])
  procs.push(serverProc)

  // 3. 等待后端就绪
  log('server', `等待后端就绪 (轮询 ${HEALTH_URL})...`)
  const ready = await waitForBackend(serverProc)

  if (ready) {
    log('server', '后端已就绪 ✓')
  } else {
    logError('server', `后端未就绪！请检查 [server] 日志中的错误信息`)
    logError('server', `可尝试手动运行诊断: ${python.cmd} ${python.args.join(' ')} ${serverScript}`)
  }

  // 4. 启动 Vite 前端
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
