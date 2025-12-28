import { createServer } from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import * as httpProxy from 'http-proxy'

const proxy = httpProxy.createProxyServer({ 
  ws: true,
  target: 'http://localhost:3004'
})

// Handle WebSocket upgrade events
proxy.on('upgrade', (req, socket, head) => {
  console.log(`[Proxy] Upgrading WebSocket: ${req.url}`)
})

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'

  // Route based on XTransformPort query parameter
  if (url.includes('XTransformPort=3004')) {
    console.log(`[Proxy] Routing to chat service: ${url}`)
    proxy.web(req, res, { target: 'http://localhost:3004' }, (err) => {
      console.error(`[Proxy] Error routing to chat service:`, err)
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Bad Gateway: Chat service unavailable')
    })
  } else {
    // Route all other requests to Next.js
    console.log(`[Proxy] Routing to Next.js: ${url}`)
    httpProxy.createProxyServer({ ws: true }).web(req, res, { target: 'http://localhost:3000' }, (err) => {
      console.error(`[Proxy] Error routing to Next.js:`, err)
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Bad Gateway: Next.js service unavailable')
    })
  }
})

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/'
  
  if (url.includes('XTransformPort=3004')) {
    console.log(`[Proxy] WebSocket upgrade to chat service: ${url}`)
    proxy.ws(req, socket, head, { target: 'http://localhost:3004' })
  } else {
    console.log(`[Proxy] WebSocket upgrade to Next.js: ${url}`)
    const nextProxy = httpProxy.createProxyServer({ ws: true })
    nextProxy.ws(req, socket, head, { target: 'http://localhost:3000' })
  }
})

const PORT = process.env.PORT || 8080

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Proxy] Reverse proxy server running on port ${PORT}`)
  console.log(`[Proxy] Routing WebSocket XTransformPort=3004 → localhost:3004`)
  console.log(`[Proxy] Routing all other requests → localhost:3000`)
})
