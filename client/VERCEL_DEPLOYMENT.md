# Deploying the VideoCallApp Frontend to Vercel

This guide will help you deploy the VideoCallApp frontend to Vercel while using the backend deployed on Render.

## Prerequisites

1. Your backend server deployed on Render (e.g., https://videocallapp-2j5r.onrender.com)
2. A GitHub account with your project repository
3. A Vercel account (you can sign up at https://vercel.com with your GitHub account)

## Deployment Steps

### 1. Push Your Changes to GitHub

Make sure all the changes we've made are pushed to your GitHub repository:

```bash
git add .
git commit -m "Prepare frontend for Vercel deployment"
git push
```

### 2. Deploy to Vercel

1. Go to https://vercel.com and sign in with your GitHub account
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: React.js
   - **Root Directory**: `client` (important!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. Add Environment Variables:
   - Click "Environment Variables" to expand the section
   - Add the following variables:
     - `REACT_APP_SERVER_URL`: `https://your-backend-app.onrender.com` (your Render backend URL)
     - `REACT_APP_STUN_SERVERS`: `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302`
     - `REACT_APP_TURN_SERVERS`: `turn:numb.viagenie.ca:3478?transport=udp,turn:numb.viagenie.ca:3478?transport=tcp`

6. Click "Deploy"

### 3. Update Backend Configuration (if needed)

1. Go to your Render dashboard for the backend service
2. Navigate to the "Environment" section
3. Add an environment variable:
   - `FRONTEND_URL`: `https://your-app.vercel.app` (your Vercel frontend URL)
4. Click "Save Changes"
5. Redeploy your backend service

### 4. Testing the Deployment

1. Once deployed, Vercel will provide you with a URL (e.g., https://videocallapp-client.vercel.app)
2. Open the URL in your browser
3. Test the app's functionality:
   - Create a new room
   - Join a room with a second device/browser
   - Test video and audio connectivity

## Troubleshooting

### Socket Connection Issues

If you're experiencing socket connection issues:

1. Check the browser console for errors
2. Make sure the `REACT_APP_SERVER_URL` points to your Render backend
3. Verify CORS is properly configured on the backend
4. Check that your Render backend is running

### WebRTC Connection Issues

If users can join rooms but can't see/hear each other:

1. Check if STUN/TURN servers are accessible (browser console)
2. Make sure both frontend and backend are using secure connections (https)
3. Check browser permissions for camera and microphone access

### Performance Issues

Free-tier Render backends go to sleep after inactivity. The first connection may be slow as the server wakes up.

## Production Optimizations

For a production deployment:

1. Consider using custom TURN servers rather than public ones
2. Set up a custom domain for both Vercel and Render
3. Implement user authentication for more secure rooms
4. Add monitoring for connection quality and service uptime 