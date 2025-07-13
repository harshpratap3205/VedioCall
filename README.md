# VideoCallApp

A real-time video calling application built with React, Node.js, Socket.IO, and WebRTC.

## Features

- Video and audio calling
- Screen sharing
- Text chat during calls
- Meeting room creation and joining
- Sharable meeting links
- Responsive UI for desktop and mobile

## Tech Stack

- **Frontend**: React, React Router, Styled Components
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO, WebRTC
- **Media Handling**: WebRTC APIs (getUserMedia, RTCPeerConnection)

## Local Development

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd VideoCallApp
   ```

2. Install dependencies for both client and server:
   ```
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. Start the development server:
   ```
   # Run the server
   cd ../server
   npm run dev
   
   # In another terminal, run the client
   cd ../client
   npm start
   ```

4. For Windows users, you can use the restart.bat script:
   ```
   .\restart.bat
   ```

5. Access the application at http://localhost:3000

## Deployment to Render

This application is configured for easy deployment to [Render](https://render.com/).

### Using the Render Blueprint

1. Fork or clone this repository to your GitHub account

2. Sign up for a Render account at https://render.com/

3. From the Render dashboard, click "New" and select "Blueprint"

4. Connect your GitHub account and select your fork of this repository

5. Click "Apply Blueprint"

Render will automatically deploy both the server and client components based on the configuration in `render.yaml`.

### Manual Deployment

#### Backend Server

1. From the Render dashboard, click "New" and select "Web Service"

2. Connect your GitHub repository

3. Use the following settings:
   - **Name**: videocallapp-server
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free (or select as needed)

4. Add the following environment variable:
   - `NODE_ENV`: `production`

5. Click "Create Web Service"

#### Frontend Client

1. From the Render dashboard, click "New" and select "Static Site"

2. Connect your GitHub repository

3. Use the following settings:
   - **Name**: videocallapp-client
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/build`

4. Add the following environment variables:
   - `REACT_APP_SERVER_URL`: (URL of your server from the previous step)
   - `REACT_APP_STUN_SERVERS`: `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302`

5. Click "Create Static Site"

### Post-Deployment

After deployment, your application will be available at the URLs provided by Render.

Note that on the free tier of Render:
- The backend service will spin down after periods of inactivity
- The first request after inactivity may take a moment as the service spins up

## License

MIT 