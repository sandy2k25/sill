# Beginner's Guide to Deploying on Cloudflare Workers

This guide will take you through deploying your application to Cloudflare Workers step-by-step with screenshots and explanations.

## 1. Create a Cloudflare Account

1. Go to [Cloudflare.com](https://cloudflare.com) and click "Sign Up"
2. Follow the registration process to create a free account
3. Verify your email address

## 2. Install Wrangler (Cloudflare's CLI Tool)

Open your computer's terminal (Command Prompt on Windows, Terminal on Mac/Linux) and run:

```bash
npm install -g wrangler
```

This installs Wrangler globally on your computer.

## 3. Log in to Cloudflare via Wrangler

Run this command in your terminal:

```bash
wrangler login
```

This will open a browser window asking you to authorize Wrangler. Click "Allow".

## 4. Create Your JWT Secret

Run this command to generate a random secure string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**IMPORTANT**: Copy the output - this will be your JWT_SECRET.

## 5. Set Up Your Secrets in Cloudflare

Run these commands one by one, entering the appropriate values when prompted:

```bash
wrangler secret put JWT_SECRET
# When prompted, paste the value from step 4

wrangler secret put ADMIN_USERNAME
# When prompted, type your desired admin username (e.g., "admin")

wrangler secret put ADMIN_PASSWORD
# When prompted, type your desired admin password
```

## 6. Deploy Your Worker

Navigate to your project directory in the terminal, then run:

```bash
cd worker
wrangler publish
```

This uploads your Worker code to Cloudflare. You'll see a URL like `https://woviex-api.username.workers.dev` when it's successful.

## 7. Test Your API

### Test the public endpoint

Visit your Worker URL in a browser, adding `/api/status` at the end:
```
https://woviex-api.username.workers.dev/api/status
```

You should see a JSON response indicating the API is online.

### Test login (to get a token)

You'll need a tool like [Postman](https://www.postman.com/downloads/) or [Insomnia](https://insomnia.rest/download) for this step.

1. Download and install Postman (it's free)
2. Create a new POST request to `https://woviex-api.username.workers.dev/api/auth/login`
3. In the "Body" tab, select "raw" and "JSON"
4. Enter this JSON:
   ```json
   {
     "username": "admin",
     "password": "your-password-from-step-5"
   }
   ```
5. Click "Send"
6. You should get a response with a token - copy this token!

### Use the token to access protected endpoints

In Postman:
1. Create a new GET request to `https://woviex-api.username.workers.dev/api/domains`
2. In the "Headers" tab, add:
   - Key: `Authorization`
   - Value: `Bearer your-token-from-previous-step`
3. Click "Send"
4. You should see a response with domain data, not "Unauthorized"

## 8. Deploy Your Frontend (Optional)

If you also want to deploy your frontend on Cloudflare Pages:

1. Push your code to GitHub
2. Log in to Cloudflare Dashboard
3. Go to "Pages"
4. Click "Create a project"
5. Connect your GitHub repository
6. Set the build settings:
   - Build command: `cd client && npm run build`
   - Build output directory: `client/dist`
7. Click "Deploy site"

## Common Errors and Solutions

### "Unauthorized" Error

If you see `{"error": "Unauthorized"}`:

1. **Check if it's a protected endpoint**: Only `/api/status` and login endpoints are public
2. **Verify your token**: Make sure you're including the full token with the `Bearer ` prefix
3. **Check JWT secret**: Ensure your JWT_SECRET is properly set in Cloudflare

### "Internal Server Error"

If you see a 500 error:

1. Check the Cloudflare Dashboard for error logs
2. Go to Workers & Pages > Your Worker > Logs

### "Not Found" Error

If you see a 404 error:

1. Double-check the URL you're using
2. Make sure you're using the correct endpoint path (e.g., `/api/domains`, not just `/domains`)

## Getting Additional Help

If you're still having issues:

1. Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
2. Ask in the [Cloudflare Community forums](https://community.cloudflare.com/)
3. Provide specific error messages when asking for help

Remember, everyone starts somewhere! Don't be afraid to ask questions.