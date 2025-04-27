# Cloudflare Worker API for WovIeX

This directory contains the Cloudflare Workers implementation of the WovIeX API. It adapts the Express routes to Cloudflare Workers architecture.

## Files

- `index.js` - The main Worker script that handles all API requests
- `jwt-worker.js` - A JWT implementation for Cloudflare Workers environment

## Storage Options

The API uses in-memory storage for development, but for production, you should use one of these options:

1. **Cloudflare D1** - Cloudflare's SQL database
2. **Cloudflare KV** - Cloudflare's key-value store
3. **External Database** - Like Neon Postgres via Cloudflare connection

## Endpoints

The API includes the following endpoints:

### Public Endpoints

- `GET /api/status` - Check API status
- `POST /api/auth/login` - Log in with username and password
- `GET /api/videos` - Get recent videos
- `GET /api/videos/:id` - Get a specific video

### Protected Endpoints (require authentication)

- `GET /api/auth/verify` - Verify authentication token
- `POST /api/admin/videos` - Add a new video
- `PUT /api/admin/videos/:id` - Update a video
- `GET /api/domains` - List all domains
- `POST /api/domains` - Add a new domain
- `PUT /api/domains/:id/toggle` - Toggle domain status
- `DELETE /api/domains/:id` - Delete a domain
- `GET /api/logs` - Get system logs
- `DELETE /api/logs` - Clear logs
- `GET /api/scraper/settings` - Get scraper settings
- `PUT /api/scraper/settings` - Update scraper settings

## Authentication

The API uses JWT for authentication. The JWT secret should be set as a Cloudflare secret:

```bash
wrangler secret put JWT_SECRET
```

## Development

To develop locally:

```bash
wrangler dev
```

## Deployment

To deploy to Cloudflare Workers:

```bash
wrangler publish
```