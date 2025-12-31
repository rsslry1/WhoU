'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, User, Users, LogOut, AlertTriangle, Send, Loader2, Shield, X, Forward, Info } from 'lucide-react'
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
  const [howToUseDialogOpen, setHowToUseDialogOpen] = useState(false) // controls info dialog
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Profanity filter list (basic)
  const profanityFilter = ['badword1', 'badword2', 'badword3']

  useEffect(() => {
    // Initialize socket connection
    // Use a relative URL for better compatibility across environments
    // The chat service runs on port 3004 in dev, but Railway needs special handling
    let chatServiceUrl: string
    
    if (typeof window !== 'undefined') {
      const isProduction = window.location.port === '8080' || 
                           window.location.hostname.includes('railway') ||
                           (window.location.protocol === 'https:' && window.location.hostname.includes('trycloudflare.com'))
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      
      if (isProduction) {
        // Using proxy server on port 8080 (including through tunnel)
        chatServiceUrl = '/?XTransformPort=3004'
      } else if (isLocalDev) {
        // Local development
        chatServiceUrl = `http://${window.location.hostname}:3004`
      } else {
        // Fallback for other scenarios
        chatServiceUrl = window.location.origin
      }
    } else {
      chatServiceUrl = 'http://localhost:3004'
    }

    // Use relative path or proxied path in production so the browser connects via the exposed domain
    const socketInstance = io(chatServiceUrl, {
      path: '/socket.io/',
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
      console.log('✓ Connected to chat server at:', chatServiceUrl)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
      console.log('✗ Disconnected from chat server')
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error)
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
      <div className="min-h-screen flex flex-col bg-background" style={{ position: 'relative' }}>
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Kinsa Ka Boi?</h1>
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
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-3xl font-bold">Chat Anonymously</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    // Create a custom modal with animation
                    const modal = document.createElement('div');
                    const isDarkMode = document.documentElement.classList.contains('dark');
                    modal.style.cssText = `
                      position: fixed;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background: rgba(0, 0, 0, 0);
                      z-index: 999999;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 20px;
                      opacity: 0;
                      transition: all 0.3s ease;
                    `;
                    
                    const content = document.createElement('div');
                    content.style.cssText = `
                      background: ${isDarkMode ? '#1f2937' : 'white'};
                      color: ${isDarkMode ? '#f3f4f6' : '#1f2937'};
                      padding: 30px;
                      border-radius: 12px;
                      max-width: 400px;
                      width: 90%;
                      text-align: center;
                      box-shadow: 0 20px 25px rgba(0, 0, 0, 0);
                      transform: scale(0.9) translateY(20px);
                      transition: all 0.3s ease;
                    `;
                    
                    content.innerHTML = `
                      <h2 style="margin: 0 0 20px 0; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'}; font-size: 20px;">How to Use Kinsa Ka Boi?</h2>
                      <p style="margin: 0 0 20px 0; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; font-size: 14px;">Simple steps to start chatting anonymously:</p>
                      <div style="text-align: left; margin-bottom: 20px;">
                        <p style="margin: 0 0 8px 0; font-weight: bold; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'};">1. Enter a username</p>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">Choose any temporary username</p>
                        <p style="margin: 0 0 8px 0; font-weight: bold; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'};">2. Click "Start Chatting"</p>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">We'll match you with a stranger</p>
                        <p style="margin: 0 0 8px 0; font-weight: bold; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'};">3. Start talking</p>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">Type messages and press Enter</p>
                        <p style="margin: 0 0 8px 0; font-weight: bold; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'};">4. Use Action Buttons</p>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">Next, Report, or Stop</p>
                      </div>
                      <div style="background: ${isDarkMode ? '#374151' : '#f3f4f6'}; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0 0 8px 0; font-weight: bold; color: ${isDarkMode ? '#f3f4f6' : '#1f2937'}; font-size: 14px;">Tips:</p>
                        <p style="margin: 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">• Be respectful and kind to others</p>
                        <p style="margin: 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">• No personal data is stored</p>
                        <p style="margin: 0; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'};">• Chat history deleted on disconnect</p>
                      </div>
                      <button onclick="this.parentElement.parentElement.remove()" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                      " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">Got it!</button>
                    `;
                    
                    modal.appendChild(content);
                    document.body.appendChild(modal);
                    
                    // Trigger animations
                    requestAnimationFrame(() => {
                      modal.style.background = 'rgba(0, 0, 0, 0.8)';
                      modal.style.opacity = '1';
                      content.style.transform = 'scale(1) translateY(0)';
                      content.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.15)';
                    });
                    
                    modal.onclick = (e) => {
                      if (e.target === modal) {
                        modal.style.background = 'rgba(0, 0, 0, 0)';
                        modal.style.opacity = '0';
                        content.style.transform = 'scale(0.9) translateY(20px)';
                        content.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0)';
                        setTimeout(() => modal.remove(), 300);
                      }
                    };
                  }}
                  title="How to use"
                >
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
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
      <div className="min-h-screen flex flex-col bg-background" style={{ position: 'relative' }}>
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">KinsaKaBoi</h1>
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
    <div className="min-h-screen flex flex-col bg-background" style={{ position: 'relative' }}>
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
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>Chat anonymously with strangers</p>
        </div>
      </footer>

      {/* How to Use Dialog */}
      {howToUseDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setHowToUseDialogOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">How to Use Kinsa Ka Boi?</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Simple steps to start chatting anonymously:</p>
            <ol className="mb-4 space-y-2 text-sm list-decimal list-inside">
              <li><span className="font-medium">Enter a username</span> – choose any temporary name.</li>
              <li><span className="font-medium">Click "Start Chatting"</span> – we'll match you with a stranger.</li>
              <li><span className="font-medium">Start talking</span> – type and press Enter to send.</li>
              <li><span className="font-medium">Use action buttons</span> – Next, Report, or Stop.</li>
            </ol>
            <div className="mb-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium mb-1">💡 Tips:</p>
              <ul className="space-y-1">
                <li>• Be respectful and kind.</li>
                <li>• No personal data is stored.</li>
                <li>• Chat history is deleted on disconnect.</li>
              </ul>
            </div>
            <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={()=>setHowToUseDialogOpen(false)}>Got it! 👍</button>
          </div>
        </div>
      )}

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

  )
}
