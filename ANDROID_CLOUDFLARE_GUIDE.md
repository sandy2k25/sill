# Deploying to Cloudflare Workers from Android

This guide will help you deploy your application to Cloudflare Workers using an Android device.

## 1. Setting Up Your Android Device

### Option A: Using Termux (Recommended)

1. Install [Termux](https://play.google.com/store/apps/details?id=com.termux) from Google Play Store
2. Open Termux and run:
   ```bash
   pkg update
   pkg upgrade
   pkg install nodejs-lts
   ```

### Option B: Using a Cloud IDE

If Termux doesn't work for you:
1. Sign up for [Replit](https://replit.com) or [Glitch](https://glitch.com) in your Android browser
2. Create a new Node.js project
3. Upload your project files

## 2. Setting Up Your Cloudflare Account

1. Install the Cloudflare app from Google Play Store or visit [Cloudflare.com](https://cloudflare.com) in your browser
2. Sign up for a free account
3. Verify your email address

## 3. Installing Wrangler on Android

In Termux or your cloud IDE terminal, run:

```bash
npm install -g wrangler
```

## 4. Logging In to Cloudflare

Run:

```bash
wrangler login
```

This will open a browser window. Log in with your Cloudflare credentials and authorize Wrangler.

## 5. Creating Your JWT Secret

Run this command to generate a secure random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**IMPORTANT**: Copy this output - this is your JWT_SECRET.

## 6. Setting Up Your Secrets

Run these commands one by one:

```bash
wrangler secret put JWT_SECRET
# Paste the value from step 5 when prompted

wrangler secret put ADMIN_USERNAME
# Type your desired admin username when prompted

wrangler secret put ADMIN_PASSWORD
# Type your desired admin password when prompted
```

## 7. Deploying Your Worker

Navigate to your project's worker directory:

```bash
cd worker
wrangler publish
```

This uploads your code to Cloudflare. You'll see a URL like `https://woviex-api.username.workers.dev` when successful.

## 8. Testing Your API on Android

### Testing the Public Endpoint

Open your browser and visit your Worker URL with `/api/status` at the end:
```
https://woviex-api.username.workers.dev/api/status
```

You should see a JSON response saying the API is online.

### Testing Authentication (Getting a Token)

#### Using Postman for Android:

1. Install [Postman](https://play.google.com/store/apps/details?id=com.postman.app) from Google Play Store
2. Create a new POST request to `https://woviex-api.username.workers.dev/api/auth/login`
3. In the Body tab, select "raw" and "JSON"
4. Enter this JSON:
   ```json
   {
     "username": "admin",
     "password": "your-password-from-step-6"
   }
   ```
5. Send the request
6. You should get a response with a token - copy this token!

#### Alternative - Using REST Client App:

1. Install [REST Client](https://play.google.com/store/apps/details?id=com.app.restclient) from Google Play Store
2. Create a new request
3. Set Method to POST
4. Enter your Worker URL + `/api/auth/login`
5. Add Content-Type header with value `application/json`
6. In the body section, add the same JSON as above
7. Send and copy the token from the response

### Accessing Protected Endpoints

In your API testing app (Postman or REST Client):

1. Create a new GET request to `https://woviex-api.username.workers.dev/api/domains`
2. Add a header:
   - Key: `Authorization`
   - Value: `Bearer your-token-from-previous-step`
3. Send the request
4. If you see domain data (not "Unauthorized"), it's working!

## 9. Hosting Your Frontend (Optional)

For your frontend, you can:

1. Push your code to GitHub (using [GitTouch](https://play.google.com/store/apps/details?id=io.github.gdg.shanghai.git) app)
2. Visit Cloudflare Pages in your browser
3. Connect your GitHub repository
4. Set the build settings:
   - Build command: `cd client && npm run build`
   - Build output directory: `client/dist`

## Common Errors on Android

### "Unauthorized" Error

If you see this error:
1. Make sure you're testing a public endpoint (`/api/status`) or using a valid token
2. Check that you're adding the `Bearer ` prefix before your token
3. Try logging in again to get a fresh token

### "Network Error"

If you can't connect:
1. Check your internet connection
2. Verify the URL is correct (copy/paste to avoid typos)
3. Make sure Cloudflare is not down (check their status page)

### "Internal Server Error"

If you see a 500 error:
1. Visit the Cloudflare dashboard in your browser
2. Go to Workers & Pages > Your Worker > Logs
3. Look for error messages

## Getting Help on Android

If you're still having trouble:
1. Take screenshots of any error messages
2. Visit [Cloudflare Community](https://community.cloudflare.com/) in your browser
3. Include details about what you've tried and the specific errors you're seeing

Remember, deploying from Android may be a bit challenging, but it's definitely possible!