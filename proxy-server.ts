import { createServer } from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import * as httpProxy from 'http-proxy'

const chatProxy = httpProxy.createProxyServer({ 
  ws: true,
  target: 'http://localhost:3004',
  timeout: 5000
})

const nextProxy = httpProxy.createProxyServer({
  ws: true,
  target: 'http://localhost:3000',
  timeout: 5000
})

// Error handlers
chatProxy.on('error', (err, req, res) => {
  console.error(`[Chat Proxy Error]:`, err.message)
  res.writeHead(502, { 'Content-Type': 'text/plain' })
  res.end(`Bad Gateway: Chat service error - ${err.message}`)
})

nextProxy.on('error', (err, req, res) => {
  console.error(`[Next.js Proxy Error]:`, err.message)
  res.writeHead(502, { 'Content-Type': 'text/plain' })
  res.end(`Bad Gateway: Next.js service error - ${err.message}`)
})

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'

  // Route Socket.io traffic to chat service
  if (url.includes('XTransformPort=3004') || url.includes('socket.io')) {
    console.log(`[Proxy] → Chat (3004): ${req.method} ${url}`)
    chatProxy.web(req, res)
  } else {
    // Route everything else to Next.js
    console.log(`[Proxy] → Next.js (3000): ${req.method} ${url}`)
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
  console.log(`[Proxy] Socket.io traffic (XTransformPort=3004) → localhost:3004`)
  console.log(`[Proxy] All other traffic → localhost:3000`)
  console.log(`[Proxy] Waiting for backend services to become available...`)
})

server.on('error', (err) => {
  console.error(`[Proxy Server Error]:`, err)
  process.exit(1)
})

