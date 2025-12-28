'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, User, Users, LogOut, AlertTriangle, Send, Loader2, Shield, X, Forward } from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'

// Types
type ChatStatus = 'landing' | 'matching' | 'connected' | 'disconnected'

type Message = {
  id: string
  sender: 'me' | 'stranger' | 'system'
  content: string
  timestamp: Date
}

type OnlineCount = {
  online: number
  waiting: number
  chatting: number
}

export default function AnonymousChatPage() {
  const { theme, setTheme } = useTheme()
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState<ChatStatus>('landing')
  const [messages, setMessages] = useState<Message[]>([])
  const [onlineCount, setOnlineCount] = useState<OnlineCount>({ online: 0, waiting: 0, chatting: 0 })
  const [isTyping, setIsTyping] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [connectionTimer, setConnectionTimer] = useState(0)
  const [inputMessage, setInputMessage] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Profanity filter list (basic)
  const profanityFilter = ['badword1', 'badword2', 'badword3']

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(`http://${window.location.hostname}:3004`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    setSocket(socketInstance)

    socketInstance.on('connect', () => {
      setIsConnected(true)
      console.log('Connected to chat server')
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
      console.log('Disconnected from chat server')
    })

    socketInstance.on('online-count', (data: OnlineCount) => {
      setOnlineCount(data)
    })

    socketInstance.on('matched', (data: { partnerUsername: string }) => {
      setStatus('connected')
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'system',
        content: `You're now chatting with a stranger. Say hi!`,
        timestamp: new Date()
      }])
      stopConnectionTimer()
    })

    socketInstance.on('message', (data: { message: string }) => {
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'stranger',
        content: filterProfanity(data.message),
        timestamp: new Date()
      }])
      setPartnerTyping(false)
    })

    socketInstance.on('partner-typing', () => {
      setPartnerTyping(true)
    })

    socketInstance.on('partner-stopped-typing', () => {
      setPartnerTyping(false)
    })

    socketInstance.on('partner-disconnected', () => {
      setStatus('disconnected')
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'system',
        content: 'Stranger has disconnected.',
        timestamp: new Date()
      }])
    })

    socketInstance.on('partner-left', () => {
      setStatus('disconnected')
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'system',
        content: 'Stranger has left the chat.',
        timestamp: new Date()
      }])
    })

    return () => {
      socketInstance.disconnect()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (connectionTimerRef.current) {
        clearInterval(connectionTimerRef.current)
      }
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Connection timer
  const startConnectionTimer = () => {
    setConnectionTimer(0)
    connectionTimerRef.current = setInterval(() => {
      setConnectionTimer(prev => prev + 1)
    }, 1000)
  }

  const stopConnectionTimer = () => {
    if (connectionTimerRef.current) {
      clearInterval(connectionTimerRef.current)
      connectionTimerRef.current = null
    }
  }

  const generateMessageId = () => Math.random().toString(36).substr(2, 9)

  const filterProfanity = (text: string): string => {
    let filteredText = text
    profanityFilter.forEach(word => {
      const regex = new RegExp(word, 'gi')
      filteredText = filteredText.replace(regex, '***')
    })
    return filteredText
  }

  const handleJoinQueue = () => {
    if (socket && username.trim() && isConnected) {
      socket.emit('join-queue', { username: username.trim() })
      setStatus('matching')
      setMessages([])
      startConnectionTimer()
    }
  }

  const handleNext = () => {
    if (socket && isConnected) {
      socket.emit('next')
      setStatus('matching')
      setMessages([])
      startConnectionTimer()
    }
  }

  const handleDisconnect = () => {
    if (socket) {
      socket.emit('disconnect-chat')
    }
    setStatus('landing')
    stopConnectionTimer()
  }

  const handleSendMessage = () => {
    if (socket && status === 'connected' && inputMessage.trim()) {
      socket.emit('message', { message: inputMessage.trim() })
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'me',
        content: filterProfanity(inputMessage.trim()),
        timestamp: new Date()
      }])
      setInputMessage('')
      setIsTyping(false)
    }
  }

  const handleTyping = (value: string) => {
    if (socket && status === 'connected') {
      if (!isTyping) {
        socket.emit('typing')
        setIsTyping(true)
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopped-typing')
        setIsTyping(false)
      }, 1000)
    }
  }

  const handleReport = () => {
    if (socket && reportReason.trim()) {
      socket.emit('report', { reason: reportReason })
      setReportDialogOpen(false)
      setReportReason('')
      // Show a message that report was sent
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'system',
        content: 'Report submitted. Thank you for helping keep our community safe.',
        timestamp: new Date()
      }])
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Landing Page
  if (status === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">AnonChat</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{onlineCount.online} Online</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <MessageSquare className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl font-bold">Chat Anonymously</CardTitle>
              <p className="text-muted-foreground">Talk to strangers randomly and anonymously</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username (temporary)
                </label>
                <Input
                  id="username"
                  placeholder="Enter a username..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinQueue()}
                  disabled={!isConnected}
                  maxLength={20}
                />
              </div>
              <Button
                onClick={handleJoinQueue}
                disabled={!isConnected || !username.trim()}
                className="w-full"
                size="lg"
              >
                {isConnected ? 'Start Chatting' : 'Connecting...'}
              </Button>
              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <p>✓ No registration required</p>
                <p>✓ Completely anonymous</p>
                <p>✓ No chat history stored</p>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-auto">
          <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
            <p>By using this service, you agree to be respectful and follow community guidelines.</p>
          </div>
        </footer>
      </div>
    )
  }

  // Matching Screen
  if (status === 'matching') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">AnonChat</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{onlineCount.waiting} Waiting</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Searching for a partner...</h2>
                <p className="text-muted-foreground">
                  Finding someone to chat with
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(connectionTimer)}
                </p>
              </div>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-auto">
          <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
            <p>You'll be matched with a random stranger</p>
          </div>
        </footer>
      </div>
    )
  }

  // Chat Interface (Connected or Disconnected)
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">AnonChat</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{username}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{onlineCount.chatting} Chatting</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
        <div className="flex-1 space-y-4">
          {/* Status Banner */}
          <Card className="bg-muted/50 border-0">
            <CardContent className="py-3 text-center">
              {status === 'connected' && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Connected - You're chatting with a stranger
                </span>
              )}
              {status === 'disconnected' && (
                <span className="text-muted-foreground font-medium">
                  Stranger disconnected. Click "Next" to find a new partner
                </span>
              )}
            </CardContent>
          </Card>

          {/* Messages Area */}
          <Card className="flex-1 flex flex-col min-h-[400px]">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.sender === 'system' ? (
                      <div className="w-full text-center">
                        <span className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
                          {message.content}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.sender === 'me'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}

                {partnerTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={inputMessage}
                  onKeyPress={(e) => {
                    handleTyping((e.target as HTMLInputElement).value)
                    if (e.key === 'Enter') {
                      handleSendMessage()
                    }
                  }}
                  onChange={(e) => {
                    setInputMessage(e.target.value)
                    handleTyping(e.target.value)
                  }}
                  disabled={status !== 'connected'}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={status !== 'connected' || !inputMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleNext}
                  variant="outline"
                  className="flex-1"
                >
                  <Forward className="h-4 w-4 mr-2" />
                  Next
                </Button>
                <Button
                  onClick={() => setReportDialogOpen(true)}
                  variant="outline"
                  className="flex-1"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="flex-1"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          <p>No chat history is stored. Everything is deleted when you disconnect.</p>
        </div>
      </footer>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Report User
            </DialogTitle>
            <DialogDescription>
              Help us keep the community safe by reporting inappropriate behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Describe the issue..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReport} disabled={!reportReason.trim()}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
