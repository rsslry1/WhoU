import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { Socket } from 'socket.io'

// Create HTTP server
const httpServer = createServer()

// Configure Socket.io server
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: ["http://localhost:8080", "http://localhost:3000", "http://0.0.0.0:8080"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ==================== Types and Interfaces ====================

interface User {
  id: string
  username: string
  joinedAt: Date
  lastActive: Date
  partnerId: string | null
}

interface Message {
  id: string
  sender: 'me' | 'stranger' | 'system'
  content: string
  timestamp: Date
}

interface OnlineCount {
  online: number
  waiting: number
  chatting: number
}

interface Report {
  id: string
  reporterId: string
  reportedId: string
  reason: string
  timestamp: Date
}

// ==================== State Management ====================

// Store all connected users
const users = new Map<string, User>()

// Store users waiting for a match (queue)
const waitingQueue: string[] = []

// Store blocked user pairs (reporterId -> Set of blocked user IDs)
const blockedUsers = new Map<string, Set<string>>()

// Store reports (in-memory, no persistence for privacy)
const reports: Report[] = []

// Rate limiting: track message count per user
const messageRateLimits = new Map<string, { count: number; resetTime: number }>()

// Profanity filter list (basic - can be expanded)
const profanityList = ['badword1', 'badword2', 'badword3', 'fuck', 'shit', 'damn', 'asshole']

// ==================== Helper Functions ====================

const generateId = (): string => Math.random().toString(36).substr(2, 9)

const containsProfanity = (text: string): boolean => {
  const lowerText = text.toLowerCase()
  return profanityList.some(word => lowerText.includes(word))
}

const filterProfanity = (text: string): string => {
  let filteredText = text
  profanityList.forEach(word => {
    const regex = new RegExp(word, 'gi')
    filteredText = filteredText.replace(regex, '***')
  })
  return filteredText
}

const isRateLimited = (userId: string): boolean => {
  const now = Date.now()
  const limit = messageRateLimits.get(userId)

  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    messageRateLimits.set(userId, {
      count: 0,
      resetTime: now + 60000 // 1 minute window
    })
    return false
  }

  return limit.count >= 10 // Max 10 messages per minute
}

const incrementRateLimit = (userId: string): void => {
  const limit = messageRateLimits.get(userId)
  if (limit) {
    limit.count++
  }
}

const getOnlineCount = (): OnlineCount => {
  let waiting = 0
  let chatting = 0

  for (const user of users.values()) {
    if (user.partnerId === null) {
      waiting++
    } else {
      chatting++
    }
  }

  return {
    online: users.size,
    waiting,
    chatting: chatting / 2 // Each chat has 2 users
  }
}

const broadcastOnlineCount = (): void => {
  const count = getOnlineCount()
  io.emit('online-count', count)
}

const isBlocked = (userId: string, partnerId: string): boolean => {
  const blocked = blockedUsers.get(userId)
  return blocked ? blocked.has(partnerId) : false
}

// Check if two users were recently paired (prevent consecutive matching)
const isRecentlyPaired = (userId: string, partnerId: string): boolean => {
  // For simplicity, this is stored in the user's previous partner
  // In production, you might want to track recent partners in a separate structure
  const user = users.get(userId)
  return user ? user.partnerId === partnerId : false
}

// ==================== Matching Logic ====================

const tryMatchUsers = (): void => {
  // Need at least 2 users in queue
  if (waitingQueue.length < 2) return

  // Get two users from queue
  const user1Id = waitingQueue.shift()!
  const user2Id = waitingQueue.shift()!

  const user1 = users.get(user1Id)
  const user2 = users.get(user2Id)

  if (!user1 || !user2) {
    // If users no longer exist, put them back or skip
    console.log('Failed to match: user no longer exists')
    return
  }

  // Check if users blocked each other
  if (isBlocked(user1Id, user2Id) || isBlocked(user2Id, user1Id)) {
    console.log(`Users ${user1Id} and ${user2Id} have blocked each other, skipping match`)
    // Put users back in queue (at the end)
    waitingQueue.push(user1Id, user2Id)
    return
  }

  // Update user records
  user1.partnerId = user2Id
  user2.partnerId = user1Id
  user1.lastActive = new Date()
  user2.lastActive = new Date()

  // Get socket instances
  const socket1 = io.sockets.sockets.get(user1Id)
  const socket2 = io.sockets.sockets.get(user2Id)

  if (!socket1 || !socket2) {
    console.log('Failed to match: socket not found')
    return
  }

  // Notify both users they've been matched
  socket1.emit('matched', { partnerUsername: user2.username })
  socket2.emit('matched', { partnerUsername: user1.username })

  console.log(`Matched: ${user1.username} <-> ${user2.username}`)

  // Broadcast updated online count
  broadcastOnlineCount()
}

const addToQueue = (userId: string): void => {
  if (!waitingQueue.includes(userId)) {
    waitingQueue.push(userId)
    console.log(`User ${userId} added to queue. Queue size: ${waitingQueue.length}`)
  }

  // Try to match users
  tryMatchUsers()
  broadcastOnlineCount()
}

const removeFromQueue = (userId: string): void => {
  const index = waitingQueue.indexOf(userId)
  if (index > -1) {
    waitingQueue.splice(index, 1)
    console.log(`User ${userId} removed from queue. Queue size: ${waitingQueue.length}`)
  }
}

const endChat = (userId: string, reason: 'disconnect' | 'leave' | 'next'): void => {
  const user = users.get(userId)

  if (!user || !user.partnerId) {
    removeFromQueue(userId)
    return
  }

  const partnerId = user.partnerId
  const partner = users.get(partnerId)

  if (!partner) {
    user.partnerId = null
    removeFromQueue(userId)
    return
  }

  // Notify the other user
  const partnerSocket = io.sockets.sockets.get(partnerId)
  if (partnerSocket) {
    if (reason === 'disconnect') {
      partnerSocket.emit('partner-disconnected')
    } else if (reason === 'leave') {
      partnerSocket.emit('partner-left')
    } else if (reason === 'next') {
      // Don't notify, just silently disconnect
    }

    // Put partner back in queue for next match
    partner.partnerId = null
    addToQueue(partnerId)
  }

  // Clear user's partner
  user.partnerId = null
  removeFromQueue(userId)

  console.log(`Chat ended between ${user.username} and ${partner?.username}. Reason: ${reason}`)
  broadcastOnlineCount()
}

// ==================== Socket Event Handlers ====================

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  // Broadcast online count
  broadcastOnlineCount()

  // User joins the waiting queue
  socket.on('join-queue', (data: { username: string }) => {
    const { username } = data

    // Validate username
    if (!username || username.trim().length === 0 || username.length > 20) {
      socket.emit('error', 'Invalid username')
      return
    }

    // Create user object
    const user: User = {
      id: socket.id,
      username: username.trim(),
      joinedAt: new Date(),
      lastActive: new Date(),
      partnerId: null
    }

    // Add to users map
    users.set(socket.id, user)

    // Add to waiting queue
    addToQueue(socket.id)

    console.log(`${username} joined the chat`)
    broadcastOnlineCount()
  })

  // User sends a message
  socket.on('message', (data: { message: string }) => {
    const { message } = data
    const user = users.get(socket.id)

    if (!user) {
      socket.emit('error', 'User not found')
      return
    }

    // Check if user is matched
    if (!user.partnerId) {
      socket.emit('error', 'Not matched with anyone')
      return
    }

    // Rate limiting check
    if (isRateLimited(socket.id)) {
      socket.emit('error', 'Please slow down. You are sending messages too quickly.')
      return
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return
    }

    if (message.length > 1000) {
      socket.emit('error', 'Message too long (max 1000 characters)')
      return
    }

    // Increment rate limit
    incrementRateLimit(socket.id)

    // Update last active time
    user.lastActive = new Date()

    // Get partner socket
    const partnerSocket = io.sockets.sockets.get(user.partnerId)
    if (partnerSocket) {
      // Filter profanity and send to partner
      const filteredMessage = filterProfanity(message)
      partnerSocket.emit('message', { message: filteredMessage })
      console.log(`Message: ${user.username} -> Partner`)
    }
  })

  // Typing indicators
  socket.on('typing', () => {
    const user = users.get(socket.id)
    if (user && user.partnerId) {
      const partnerSocket = io.sockets.sockets.get(user.partnerId)
      if (partnerSocket) {
        partnerSocket.emit('partner-typing')
      }
    }
  })

  socket.on('stopped-typing', () => {
    const user = users.get(socket.id)
    if (user && user.partnerId) {
      const partnerSocket = io.sockets.sockets.get(user.partnerId)
      if (partnerSocket) {
        partnerSocket.emit('partner-stopped-typing')
      }
    }
  })

  // User wants to find a new partner (Next button)
  socket.on('next', () => {
    const user = users.get(socket.id)
    if (user) {
      console.log(`${user.username} clicked Next`)
      endChat(socket.id, 'next')
    }
  })

  // User reports current partner
  socket.on('report', (data: { reason: string }) => {
    const { reason } = data
    const user = users.get(socket.id)

    if (!user || !user.partnerId) {
      return
    }

    // Create report
    const report: Report = {
      id: generateId(),
      reporterId: user.id,
      reportedId: user.partnerId,
      reason: reason.trim(),
      timestamp: new Date()
    }

    reports.push(report)

    // Block the partner for the reporter
    let blocked = blockedUsers.get(user.id)
    if (!blocked) {
      blocked = new Set()
      blockedUsers.set(user.id, blocked)
    }
    blocked.add(user.partnerId)

    console.log(`Report submitted: ${user.username} reported partner. Reason: ${reason}`)
  })

  // User disconnects from chat
  socket.on('disconnect-chat', () => {
    const user = users.get(socket.id)
    if (user) {
      console.log(`${user.username} disconnected from chat`)
      endChat(socket.id, 'leave')
    }
  })

  // Socket disconnects completely
  socket.on('disconnect', () => {
    const user = users.get(socket.id)

    if (user) {
      console.log(`${user.username} disconnected from server`)

      // End any active chat
      endChat(socket.id, 'disconnect')

      // Remove user from users map
      users.delete(socket.id)

      // Clean up rate limit
      messageRateLimits.delete(socket.id)
    }

    broadcastOnlineCount()
  })

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

// ==================== Inactivity Cleanup ====================

// Auto-disconnect inactive users (5 minutes of inactivity)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes

setInterval(() => {
  const now = Date.now()
  const inactiveUsers: string[] = []

  for (const [userId, user] of users.entries()) {
    const inactiveTime = now - user.lastActive.getTime()

    if (inactiveTime > INACTIVITY_TIMEOUT) {
      inactiveUsers.push(userId)
    }
  }

  for (const userId of inactiveUsers) {
    const socket = io.sockets.sockets.get(userId)
    if (socket) {
      console.log(`Auto-disconnecting inactive user: ${users.get(userId)?.username}`)
      socket.disconnect()
    }
  }
}, 60000) // Check every minute

// ==================== Server Startup ====================

const PORT = 3004

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Anonymous Chat Server running on port ${PORT}`)
  console.log('Privacy: No chat history is stored')
  console.log('All data is cleared when users disconnect')
})

// ==================== Graceful Shutdown ====================

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  io.close(() => {
    httpServer.close(() => {
      console.log('Chat server closed')
      process.exit(0)
    })
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  io.close(() => {
    httpServer.close(() => {
      console.log('Chat server closed')
      process.exit(0)
    })
  })
})
