# AnonChat - Anonymous Chat Application

A modern, privacy-focused anonymous chat application built with Next.js 15, Socket.io, and shadcn/ui. Similar to Omegle, users can chat with random strangers without creating an account.

## 🌟 Features

### Core Features
- ✅ **Anonymous 1-on-1 Real-time Chat** - Chat with random strangers instantly
- ✅ **No Login Required** - Just enter a temporary username to start
- ✅ **Random Matching System** - Smart queue-based matching algorithm
- ✅ **Next/Skip Button** - Find a new partner instantly
- ✅ **Disconnect Button** - End the chat at any time
- ✅ **Typing Indicators** - See when your partner is typing
- ✅ **Online Users Count** - Real-time statistics display
- ✅ **Session Management** - Auto-handling of disconnections

### Privacy & Security
- 🔒 **No Chat History Stored** - All messages are ephemeral
- 🔒 **No Personal Data Collection** - Usernames are temporary
- 🔒 **Report & Block Feature** - Report inappropriate behavior
- 🔒 **Auto-Disconnect Inactive Users** - 5-minute inactivity timeout
- 🔒 **Rate Limiting** - 10 messages per minute per user
- 🔒 **Profanity Filtering** - Automatic content filtering
- 🔒 **No Consecutive Matching** - Won't match with same user twice

### UI/UX
- 🎨 **Dark & Light Mode** - Theme support with system preference detection
- 🎨 **Animated Chat Bubbles** - Smooth message animations with Framer Motion
- 🎨 **Responsive Design** - Mobile-first, works on all screen sizes
- 🎨 **Loading Indicators** - Clear feedback during matching
- 🎨 **Status Messages** - Clear connection state indicators
- 🎨 **Modern UI** - Built with shadcn/ui components

## 📁 Project Structure

```
anon-chat/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main chat application
│   │   ├── layout.tsx            # Root layout with theme provider
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   └── hooks/                    # React hooks
├── mini-services/
│   └── chat-service/
│       ├── index.ts              # Socket.io server
│       ├── package.json          # Service dependencies
│       └── bun.lockb             # Lock file
├── prisma/
│   └── schema.prisma             # Database schema (not used in this app)
├── public/                       # Static assets
├── tailwind.config.ts            # Tailwind configuration
├── next.config.ts                # Next.js configuration
└── package.json                  # Project dependencies
```

## 🚀 Setup & Run Instructions

### Prerequisites
- Node.js 18+ or Bun
- npm or bun package manager

### Installation

1. **Clone or navigate to the project**
   ```bash
   cd /home/z/my-project
   ```

2. **Install frontend dependencies**
   ```bash
   bun install
   ```

3. **Install chat service dependencies**
   ```bash
   cd mini-services/chat-service
   bun install
   cd ../..
   ```

### Running the Application

#### Option 1: Development Mode (Recommended)

1. **Start the chat service** (runs on port 3004)
   ```bash
   cd mini-services/chat-service
   bun run dev
   ```

   The service will log:
   ```
   Anonymous Chat Server running on port 3004
   Privacy: No chat history is stored
   All data is cleared when users disconnect
   ```

2. **Start the Next.js development server** (runs on port 3000)
   In a new terminal:
   ```bash
   cd /home/z/my-project
   bun run dev
   ```

3. **Open the application**
   Navigate to `http://localhost:3000` in your browser

#### Option 2: Background Mode

```bash
# Start chat service in background
cd mini-services/chat-service
bun run dev > /tmp/chat-service.log 2>&1 &

# Start Next.js dev server in anobun run dev > /tmp/chat-service.log 2>&1 &ther terminal
cd /home/z/my-project
bun run dev
```

### Stopping the Services

```bash
# Stop Next.js: Press Ctrl+C in the terminal

# Stop chat service
pkill -f "chat-service"
```

## 🔧 Technical Implementation

### Frontend (Next.js 15)

**Technologies:**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Pre-built UI components
- **Socket.io Client** - Real-time WebSocket client
- **Framer Motion** - Smooth animations
- **next-themes** - Theme management
- **Zustand** - State management

**Key Components:**
- Landing page with username input
- Matching screen with loading state
- Real-time chat interface
- Report/Bock modal
- Theme toggle

### Backend (Socket.io Mini-Service)

**Technologies:**
- **Bun** - Fast JavaScript runtime
- **Socket.io** - Real-time bidirectional communication
- **node:http** - HTTP server

**Features Implemented:**
1. **Matching Queue System**
   - FIFO queue for waiting users
   - Automatic matching when 2+ users are in queue
   - Prevention of blocked users matching each other
   - Prevention of consecutive matching with same user

2. **Message Handling**
   - Real-time message relay between matched users
   - Profanity filtering
   - Message length validation (max 1000 chars)
   - Rate limiting (10 messages/minute)

3. **Typing Indicators**
   - Real-time typing status updates
   - Auto-stop after 1 second of inactivity

4. **Online Count**
   - Real-time broadcasting of user statistics
   - Tracks online, waiting, and chatting users

5. **Report System**
   - In-memory report storage
   - Automatic blocking of reported users
   - No persistent data storage for privacy

6. **Inactivity Cleanup**
   - Auto-disconnect after 5 minutes of inactivity
   - Cleanup of orphaned connections

### Security & Privacy Features

1. **No Data Persistence**
   - All messages stored in memory only
   - Clear on user disconnect
   - No database or file storage

2. **Rate Limiting**
   ```typescript
   // 10 messages per minute per user
   if (isRateLimited(userId)) {
     socket.emit('error', 'Please slow down...')
     return
   }
   ```

3. **Profanity Filter**
   ```typescript
   const filterProfanity = (text: string): string => {
     let filteredText = text
     profanityList.forEach(word => {
       const regex = new RegExp(word, 'gi')
       filteredText = filteredText.replace(regex, '***')
     })
     return filteredText
   }
   ```

4. **Blocking System**
   - Reported users are blocked for the reporter
   - Prevents matching with blocked users
   - Stored in memory only

5. **Input Validation**
   - Username length: 1-20 characters
   - Message length: max 1000 characters
   - Empty message prevention

### WebSocket Communication

**Events Emitted by Client:**
- `join-queue` - Join the matching queue
- `message` - Send a message to partner
- `typing` - Indicate user is typing
- `stopped-typing` - Indicate user stopped typing
- `next` - Find a new partner
- `report` - Report current partner
- `disconnect-chat` - Disconnect from chat

**Events Emitted by Server:**
- `online-count` - Update online user statistics
- `matched` - Notify user of successful match
- `message` - Receive message from partner
- `partner-typing` - Partner is typing
- `partner-stopped-typing` - Partner stopped typing
- `partner-disconnected` - Partner disconnected
- `partner-left` - Partner left the chat
- `error` - Error message

## 🎨 UI/UX Design

### Color Scheme
- Uses Tailwind CSS built-in color variables
- Supports light and dark themes
- No blue/indigo colors (per requirements)

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Animations
- Message bubble entrance (fade + slide up)
- Typing indicator bounce animation
- Loading spinner
- Smooth page transitions

## 📊 API Routes

This application uses Socket.io for real-time communication. No REST API routes are needed for core functionality.

## 🔍 Debugging

### Check Chat Service Logs
```bash
tail -f /tmp/chat-service.log
```

### Check Next.js Logs
```bash
tail -f /home/z/my-project/dev.log
```

### Check if Service is Running
```bash
lsof -ti:3004  # Chat service
lsof -ti:3000  # Next.js dev server
```

## 🛡️ Security Best Practices

1. **Input Validation** - All user inputs are validated on both client and server
2. **Rate Limiting** - Prevents spam and DoS attacks
3. **CORS Configuration** - Configured for production use
4. **No Data Persistence** - Privacy by design, no chat history storage
5. **Profanity Filtering** - Automatic content moderation
6. **Auto-Disconnect** - Inactive users are disconnected after 5 minutes
7. **Block System** - Users can report/block inappropriate behavior
8. **No Consecutive Matching** - Prevents unwanted repeat connections

## 🚦 Development Workflow

1. **Make changes to code**
2. **Frontend changes auto-compile** (Next.js hot reload)
3. **Backend changes auto-restart** (Bun --hot)
4. **Test in browser** at http://localhost:3000

## 📝 Code Quality

Run ESLint to check code quality:
```bash
bun run lint
```

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔮 Future Enhancements (Optional Bonus Features)

### Not Yet Implemented
- [ ] Interest-based matching (tags)
- [ ] Country/region display
- [ ] Emoji reactions
- [ ] Sound notifications
- [ ] Chat timer
- [ ] Video chat integration
- [ ] File sharing
- [ ] Image sharing
- [ ] Group chat option

## 📄 License

This project is for educational purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚠️ Important Notes

- **Port Configuration**: The chat service runs on port 3004 and Next.js on port 3000
- **Gateway Setup**: The Caddyfile handles gateway routing for WebSocket connections
- **Memory-Only Storage**: All data is stored in memory and cleared on disconnect
- **No Database**: This application does not persist any user data

## 🆘 Troubleshooting

### Chat Service Won't Start
```bash
# Check if port 3004 is in use
lsof -ti:3004

# Kill the process if needed
lsof -ti:3004 | xargs kill -9

# Restart the service
cd mini-services/chat-service
bun run dev
```

### Can't Connect to Chat
1. Check if chat service is running: `tail /tmp/chat-service.log`
2. Check Next.js logs: `tail /home/z/my-project/dev.log`
3. Ensure both services are running

### Messages Not Sending
- Check rate limiting (max 10 messages/minute)
- Check if you're matched with a partner
- Check browser console for errors

---

**Built with ❤️ using Next.js 15, Socket.io, and shadcn/ui**
