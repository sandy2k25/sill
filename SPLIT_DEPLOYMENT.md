# Split Deployment: Backend on Server, Frontend on Netlify

This guide explains how to deploy the WovIeX application with the frontend on Netlify and the backend on a separate server.

## Step 1: Deploy the Backend Server

### Using Render.com (Recommended)

1. Create a [Render.com](https://render.com) account
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure the service:
   - Name: `woviex-backend` (or any name you prefer)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm run dev` (or `node server/index.js`)
   - Add Environment Variables:
     - `DATABASE_URL`: Your database connection string
     - `JWT_SECRET`: Secret for JWT tokens
     - `ADMIN_USERNAME`: Admin username
     - `ADMIN_PASSWORD`: Admin password
     - Any other necessary environment variables
5. Click "Create Web Service"
6. Wait for the deployment to complete and note the URL (e.g., `https://woviex-backend.onrender.com`)

### Using Railway.app (Alternative)

1. Create a [Railway.app](https://railway.app) account
2. Create a new project
3. Add your GitHub repository
4. Configure the environment variables as mentioned above
5. Wait for deployment to complete and note the URL

## Step 2: Deploy the Frontend to Netlify

1. Update the `netlify.toml` file (already done):
   ```toml
   [build]
     command = "node netlify-frontend.js"
     publish = "dist"

   [build.environment]
     API_URL = "https://your-backend-server-url.com" # Replace with your actual backend URL

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. Update the `API_URL` in the Netlify environment variables to your backend server URL
   - In Netlify dashboard: Site settings → Build & deploy → Environment → Edit variables

3. Deploy to Netlify:
   - Connect your GitHub repository
   - Use the build settings from netlify.toml
   - Click "Deploy site"

## Step 3: Connect Frontend and Backend

1. Make sure CORS is enabled on your backend server to allow requests from your Netlify domain
   - Add the following to your Express server:

   ```javascript
   app.use(cors({
     origin: 'https://your-netlify-site.netlify.app',
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     credentials: true
   }));
   ```

2. Test the connection by visiting your Netlify site and checking if the backend API works

## Troubleshooting

1. **CORS errors**: Make sure your backend allows requests from your Netlify domain
2. **API connection issues**: Verify the API_URL environment variable in Netlify
3. **Database errors**: Ensure your database is accessible from your backend server