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

------------------------------------------------------------------------------


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

# Start Next.js dev server in another terminal
cd /home/z/my-project
bun run dev
```