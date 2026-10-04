import net from 'node:net'
import http from 'node:http'
import { isCleanScanResult } from './clamd-response.mjs'

const port = Number(process.env.PORT || 8080)
const secret = process.env.SCANNER_SHARED_SECRET
const clamdHost = process.env.CLAMD_HOST || '127.0.0.1'
const clamdPort = Number(process.env.CLAMD_PORT || 3310)
const maximumBytes = 10 * 1024 * 1024

if (!secret) throw new Error('SCANNER_SHARED_SECRET is required.')

http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      const ready = await pingClamd()
      return send(response, ready ? 200 : 503, { ok: ready })
    }
    if (
      request.method !== 'POST'
      || request.headers.authorization !== `Bearer ${secret}`
    ) {
      return send(response, 401, { error: 'Unauthorized' })
    }
    const body = await readJson(request)
    if (
      typeof body.url !== 'string'
      || !body.url.startsWith('https://')
      || !Number.isInteger(body.sizeBytes)
      || body.sizeBytes < 1
      || body.sizeBytes > maximumBytes
    ) {
      return send(response, 400, { error: 'Invalid scan request' })
    }
    const download = await fetch(body.url, { signal: AbortSignal.timeout(30000) })
    if (!download.ok) return send(response, 502, { error: 'Download failed' })
    const bytes = new Uint8Array(await download.arrayBuffer())
    if (bytes.byteLength !== body.sizeBytes || bytes.byteLength > maximumBytes) {
      return send(response, 422, { error: 'Size mismatch' })
    }
    const result = await scan(bytes)
    return send(response, 200, {
      clean: isCleanScanResult(result),
      scanner: 'clamav',
      signature: result.replace(/\0$/, '').slice(0, 120),
    })
  } catch {
    return send(response, 503, { error: 'Scan failed' })
  }
}).listen(port)

function scan(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(clamdPort, clamdHost)
    const chunks = []
    socket.setTimeout(30000)
    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536)
        const size = Buffer.alloc(4)
        size.writeUInt32BE(chunk.length)
        socket.write(size)
        socket.write(chunk)
      }
      socket.write(Buffer.alloc(4))
    })
    socket.on('data', (chunk) => chunks.push(chunk))
    socket.on('end', () => resolve(Buffer.concat(chunks).toString()))
    socket.on('timeout', () => socket.destroy(new Error('Scan timed out')))
    socket.on('error', reject)
  })
}

function pingClamd() {
  return new Promise((resolve) => {
    const socket = net.createConnection(clamdPort, clamdHost)
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 2000)
    socket.on('connect', () => socket.write('zPING\0'))
    socket.on('data', (chunk) => {
      clearTimeout(timer)
      socket.end()
      resolve(chunk.toString().includes('PONG'))
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 16384) request.destroy()
      else chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function send(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(body))
}
