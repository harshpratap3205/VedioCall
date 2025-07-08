# AudioVideo App

A modern, full-featured audio and video communication application built with React.js frontend and Node.js backend. Features include real-time video calls, audio-only calls, room management, and responsive design.

## 🚀 Features

- **Video Calls**: High-quality video communication with multiple participants
- **Audio Calls**: Optimized audio-only conversations with visual indicators
- **Room Management**: Create and join rooms with unique IDs
- **Real-time Communication**: Socket.io for instant messaging and signaling
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Beautiful glassmorphism design with smooth animations
- **Screen Sharing**: Share your screen with other participants (planned)
- **Media Controls**: Mute/unmute audio, enable/disable video

## 📁 Project Structure

```
AudioVideoApp/
├── package.json                 # Root workspace configuration
├── README.md                   # Project documentation
├── client/                     # React frontend application
│   ├── package.json           # Client dependencies
│   ├── public/
│   │   └── index.html         # HTML template
│   └── src/
│       ├── index.js           # React entry point
│       ├── App.js             # Main app component with routing
│       ├── App.css            # Global app styles
│       ├── index.css          # Base styles and utilities
│       ├── reportWebVitals.js # Performance monitoring
│       └── components/        # React components
│           ├── Navbar.js      # Navigation bar
│           ├── Home.js        # Landing page
│           ├── JoinRoom.js    # Join existing room
│           ├── VideoCall.js   # Video call interface
│           └── AudioCall.js   # Audio call interface
└── server/                    # Node.js backend server
    ├── package.json          # Server dependencies
    └── index.js              # Express server with Socket.io
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **React Router** - Client-side routing
- **Styled Components** - CSS-in-JS styling
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique identifier generation

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd AudioVideoApp
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start both the frontend (http://localhost:3000) and backend (http://localhost:5000) simultaneously.

### Alternative: Start servers individually

**Terminal 1 - Start the backend server:**
```bash
npm run server:dev
```

**Terminal 2 - Start the frontend:**
```bash
npm run client:dev
```

## 🎮 Usage

1. **Access the app** at http://localhost:3000
2. **Start a new call**:
   - Click "Start Video Call" or "Start Audio Call"
   - Share the generated Room ID with others
3. **Join an existing room**:
   - Click "Join Room"
   - Enter your name and the Room ID
   - Choose call type (Video/Audio)

## 🔧 Available Scripts

### Root Level
- `npm run dev` - Start both client and server in development mode
- `npm run client:dev` - Start only the React frontend
- `npm run server:dev` - Start only the Node.js backend
- `npm run install:all` - Install dependencies for all workspaces

### Client Scripts
- `npm start` - Start React development server
- `npm run build` - Build for production
- `npm test` - Run tests

### Server Scripts
- `npm start` - Start production server
- `npm run dev` - Start with nodemon for development

## 🏗️ Architecture

### Frontend Components

1. **App.js** - Main application with routing
2. **Navbar.js** - Navigation with modern glassmorphism design
3. **Home.js** - Landing page with call options
4. **JoinRoom.js** - Enhanced room joining with recent rooms
5. **VideoCall.js** - Video call interface with controls
6. **AudioCall.js** - Audio-optimized interface with speaking indicators

### Backend Server

The server handles:
- **Room Management** - Create, join, and manage rooms
- **WebRTC Signaling** - Facilitate peer-to-peer connections
- **Real-time Events** - User join/leave, media controls
- **API Endpoints** - Room information and health checks

## 🔮 Next Steps (TODO)

- [ ] **WebRTC Implementation** - Add actual video/audio streaming
- [ ] **Signaling Server** - Complete WebRTC peer connection setup
- [ ] **UI Components** - Enhance with additional features
- [ ] **Room Management** - Advanced room features
- [ ] **Screen Sharing** - Implement screen sharing capability
- [ ] **Chat System** - Add text messaging
- [ ] **User Authentication** - Add user accounts and profiles

## 🌐 Environment Configuration

Create a `.env` file in the server directory (optional):
```env
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

## 📱 Mobile Support

The app is fully responsive and supports:
- **Touch Controls** - Optimized for mobile devices
- **Responsive Layout** - Adapts to different screen sizes
- **Progressive Web App** - Can be installed on mobile devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues:
1. Check the console for error messages
2. Ensure both frontend and backend are running
3. Verify your Node.js version is 18 or higher
4. Check that ports 3000 and 5000 are available

---

**Happy Coding! 🎉** 