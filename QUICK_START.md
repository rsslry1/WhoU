# Quick Start Guide - AnonChat

## 🚀 Get Started in 3 Steps

### 1. Check if Services are Running

The chat service should already be running in the background. Check it:

```bash
# Check chat service logs
tail -n 20 /tmp/chat-service.log
```

You should see:
```
Anonymous Chat Server running on port 3004
Privacy: No chat history is stored
All data is cleared when users disconnect
```

### 2. Open the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Start Chatting!

1. **Enter a temporary username** (1-20 characters)
2. **Click "Start Chatting"** to join the queue
3. **Wait for a match** - The system will pair you with a random stranger
4. **Start chatting!** - Type your message and press Enter

## 🎮 How to Use

### Landing Page
- Enter a temporary username (this will only exist during your session)
- Click "Start Chatting" to join the matching queue

### Matching Screen
- Wait while the system finds you a partner
- A timer shows how long you've been waiting
- Click "Cancel" to return to landing page

### Chat Interface
- **Type messages** in the input field and press Enter or click Send
- **Next** - Find a new partner (disconnects from current chat)
- **Report** - Report your partner for inappropriate behavior
- **Stop** - End the chat session and return to landing page

### Features You'll See
- ✅ Animated chat bubbles
- ✅ Typing indicator (three dots when partner is typing)
- ✅ Online user count in header
- ✅ Connection status messages
- ✅ Dark/Light mode toggle (click the icon in header)

## 🌟 Key Features

### Privacy Features
- No chat history is stored
- Everything is deleted when you disconnect
- Username only exists during session
- No personal data collected

### Safety Features
- Report inappropriate users
- Profanity filtering (automatic)
- Rate limiting (10 messages/minute)
- Auto-disconnect after 5 minutes of inactivity

### Matching System
- Random stranger pairing
- Won't match you with the same person twice in a row
- Can't be matched with users you've blocked

## 🎨 UI Tips

### Dark Mode
- Click the theme icon in the top-right corner to toggle between light and dark mode

### Responsive Design
- The app works perfectly on:
  - Desktop computers
  - Tablets
  - Mobile phones

### Clear Status Messages
- **Searching for a partner...** - You're in the queue
- **✓ Connected** - You're matched with someone
- **Stranger disconnected** - Partner left the chat

## ⚠️ Important Reminders

1. **Be Respectful** - Treat others as you want to be treated
2. **No Personal Info** - Never share personal information
3. **Report Issues** - Use the Report button for inappropriate behavior
4. **Stay Safe** - Don't share anything you wouldn't want public

## 🔧 Troubleshooting

### "Can't Connect"
- Make sure the chat service is running
- Check that both services are active:
  ```bash
  lsof -ti:3004  # Chat service
  lsof -ti:3000  # Next.js server
  ```

### "No Partner Found"
- If no one else is using the app, you'll stay in the queue
- Open the app in a second browser to test with yourself

### Messages Not Sending
- Wait for the "✓ Connected" message before typing
- You can only send messages when matched with a partner
- Check you haven't hit the rate limit (10 messages/minute)

## 📱 Testing Tips

### Test with Yourself
1. Open the app in one browser tab
2. Enter username "User1"
3. Open the app in a second browser tab (Incognito mode works too)
4. Enter username "User2"
5. Both users will be matched!

### Test Different Features
- **Typing Indicator** - Type in one window, see the dots in the other
- **Next Button** - Click to disconnect and find a new match
- **Report** - Report your partner to see the confirmation message
- **Dark Mode** - Toggle the theme to see both designs

## 🎯 Success Criteria

You know the app is working when you see:
1. ✅ Landing page with username input
2. ✅ Matching screen with loading animation
3. ✅ Chat interface with message bubbles
4. ✅ Real-time messages between two browser windows
5. ✅ Typing indicators working
6. ✅ Online count updating
7. ✅ Dark/light mode toggle
8. ✅ Report dialog opens and submits

## 📚 Need More Details?

See the full documentation in `README_CHAT.md` for:
- Detailed technical implementation
- Architecture overview
- Security features
- API documentation
- Code structure

---

**Happy Chatting! 💬**
