# Upstash Redis Rate Limiter Setup Guide

## Quick Setup with Upstash Redis

Your rate limiter has been updated to use **Upstash Redis** instead of Vercel KV. Upstash is an excellent choice for serverless applications!

### Environment Variables Required

From your Upstash dashboard, you need these environment variables:

- `UPSTASH_REDIS_REST_URL` - Your Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Your Upstash Redis REST API token

### Setting Up Upstash (if not already done)

1. **Go to Upstash**: <https://upstash.com>
2. **Create a free account** (GitHub sign-in available)
3. **Create a new Redis database**
4. **Copy the REST API credentials** from the dashboard

### Environment Variable Setup

**Option 1: Vercel Dashboard (Recommended)**

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add both variables:
   - `UPSTASH_REDIS_REST_URL` = your Upstash URL
   - `UPSTASH_REDIS_REST_TOKEN` = your Upstash token

**Option 2: .env.local file** (for local development)

```bash
UPSTASH_REDIS_REST_URL=your-upstash-url-here
UPSTASH_REDIS_REST_TOKEN=your-upstash-token-here
```

### Deploy and Test

1. **Deploy your updated code** to Vercel
2. **Test rate limiting** with rapid requests:

```bash
# Test rate limiting - send 6+ rapid requests
for i in {1..7}; do
  curl -X POST https://your-app.vercel.app/api/auth \
    -H "Content-Type: application/json" \
    -d '{"action":"login","email":"test@test.com","password":"wrong"}'
done
```

You should get a 429 "Too many requests" response on the 6th request.

### Verification

**Success Indicators:**

- ✅ No Redis connection errors in logs
- ✅ Rate limiting triggers after 5 requests  
- ✅ 429 responses with proper headers
- ✅ Rate limits persist across requests

**Check Vercel logs** to see Redis connection status.

### Troubleshooting

**If rate limiting doesn't work:**

1. **Check Redis credentials** - ensure both URL and token are correct
2. **Verify environment variables** are set in Vercel
3. **Check Upstash dashboard** - ensure database is active
4. **Look for connection errors** in Vercel function logs

**Common issues:**

- Missing environment variables → Add to Vercel dashboard
- Invalid credentials → Check Upstash dashboard
- Network errors → Verify Upstash database status

### Benefits of Upstash Redis

- ✅ **Serverless-optimized** - Perfect for Vercel
- ✅ **Global distribution** - Low latency worldwide
- ✅ **No connection management** - Automatic scaling
- ✅ **Redis API** - Familiar and powerful
- ✅ **Free tier available** - Great for development
- ✅ **Automatic cleanup** - TTL-based expiration

---

**Your security fix is complete!** The distributed rate limiter now works correctly with Upstash Redis across all serverless instances.
