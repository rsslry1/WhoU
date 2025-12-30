import { createServer, request } from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import * as httpProxy from 'http-proxy'

// Track service availability
let nextJsAvailable = false
let chatAvailable = false

// Health check function
const checkServiceHealth = (port: number, name: string) => {
  return new Promise<boolean>((resolve) => {
    const req = request(`http://localhost:${port}/`, (res) => {
      req.destroy()
      resolve(res.statusCode !== undefined)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// Periodically check if services are available
setInterval(async () => {
  nextJsAvailable = await checkServiceHealth(3000, 'Next.js')
  chatAvailable = await checkServiceHealth(3004, 'Chat')
  
  if (nextJsAvailable) console.log('[Health] ✓ Next.js available')
  else console.log('[Health] ✗ Next.js unavailable')
  
  if (chatAvailable) console.log('[Health] ✓ Chat available')
  else console.log('[Health] ✗ Chat unavailable')
}, 2000)

const chatProxy = httpProxy.createProxyServer({ 
  ws: true,
  target: 'http://localhost:3004',
  timeout: 10000
})

const nextProxy = httpProxy.createProxyServer({
  ws: true,
  target: 'http://localhost:3000',
  timeout: 10000
})

// Error handlers
chatProxy.on('error', (err, req, res) => {
  console.error(`[Chat Proxy Error]:`, err.message)
  res.writeHead(502, { 'Content-Type': 'text/plain' })
  res.end(`Bad Gateway: Chat service unavailable (${err.message})`)
})

nextProxy.on('error', (err, req, res) => {
  console.error(`[Next.js Proxy Error]:`, err.message)
  res.writeHead(502, { 'Content-Type': 'text/plain' })
  res.end(`Bad Gateway: Next.js service unavailable (${err.message}). Services may still be starting...`)
})

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'

  // Route Socket.io traffic to chat service
  if (url.includes('XTransformPort=3004') || url.includes('socket.io')) {
    console.log(`[Proxy] → Chat (3004): ${req.method} ${url}`)
    if (!chatAvailable) {
      console.warn(`[Proxy] Chat service not available yet`)
    }
    chatProxy.web(req, res)
  } else {
    // Route everything else to Next.js
    console.log(`[Proxy] → Next.js (3000): ${req.method} ${url}`)
    if (!nextJsAvailable) {
      console.warn(`[Proxy] Next.js service not available yet`)
    }
    nextProxy.web(req, res)
  }
})

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/'
  
  if (url.includes('XTransformPort=3004') || url.includes('socket.io')) {
    console.log(`[Proxy] WebSocket upgrade → Chat (3004): ${url}`)
    chatProxy.ws(req, socket, head)
  } else {
    console.log(`[Proxy] WebSocket upgrade → Next.js (3000): ${url}`)
    nextProxy.ws(req, socket, head)
  }
})

const PORT = process.env.PORT || 8080

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Proxy] ✓ Reverse proxy listening on port ${PORT}`)
  console.log(`[Proxy] Checking service health every 2 seconds...`)
  console.log(`[Proxy] Socket.io traffic (XTransformPort=3004) → localhost:3004`)
  console.log(`[Proxy] All other traffic → localhost:3000`)
})

server.on('error', (err) => {
  console.error(`[Proxy Server Error]:`, err)
  process.exit(1)
})


