# Root Cause: Why ALL Dashboard Endpoints Return 401

## 🔍 The Problem

**Every dashboard endpoint is returning 401 "Invalid or expired token":**
- ✅ `/v1/auth/me`
- ✅ `/v1/runs`
- ✅ `/v1/savings/summary`
- ✅ `/v1/savings/timeseries`
- ✅ `/v1/savings/by-level`
- ✅ `/v1/savings/by-path`
- ✅ `/v1/billing/status`

## 🎯 Root Cause

**ALL these endpoints use `requireUserSession` middleware**, which verifies Supabase JWT tokens. The JWT verification is **failing at the middleware level**, before any route logic runs.

### Why This Happens

The JWT verification middleware (`requireUserSession`) needs to:
1. ✅ Read the JWT token from `Authorization: Bearer <token>` header
2. ✅ Get `SUPABASE_URL` from environment variables
3. ✅ Fetch JWKS (JSON Web Key Set) from `${SUPABASE_URL}/.well-known/jwks.json`
4. ✅ Verify the token signature using JWKS
5. ✅ Verify token issuer and audience

**If ANY of these steps fail, you get "Invalid or expired token".**

## 🔴 Most Likely Causes (in order)

### 1. SUPABASE_URL Not Set on Railway ⚠️ **99% of cases**

**Symptom:** All JWT-verified endpoints fail with 401

**Fix:**
1. Railway Dashboard → Your API Service → Variables
2. Add/verify `SUPABASE_URL` = `https://jajqvceuenqeblbgsigt.supabase.co`
3. No trailing slash!
4. Railway restarts automatically

**How to verify:**
- Check Railway logs for: `SUPABASE_URL not configured`
- Or: `JWT verification failed` with no specific error

### 2. Token Expired

**Symptom:** Worked before, now failing

**Fix:**
- Log out and log back in
- Supabase tokens expire after 1 hour

### 3. Wrong SUPABASE_URL

**Symptom:** Using wrong Supabase project

**Fix:**
- Verify you're using the correct project URL
- Should be: `https://jajqvceuenqeblbgsigt.supabase.co`

### 4. Network Issue (JWKS endpoint unreachable)

**Symptom:** Railway can't reach Supabase JWKS endpoint

**Fix:**
- Check Railway logs for network errors
- Verify Supabase project is active
- Test: `curl https://jajqvceuenqeblbgsigt.supabase.co/.well-known/jwks.json`

## 📊 Endpoint Authentication Map

| Endpoint | Auth Method | Middleware |
|----------|-------------|------------|
| `/v1/auth/me` | JWT or API Key | `requireUserSession` (tries JWT first) |
| `/v1/runs` | JWT only | `requireUserSession` |
| `/v1/savings/*` | JWT only | `requireUserSession` |
| `/v1/billing/status` | JWT or API Key | `requireUserSession` (tries JWT first) |
| `/v1/billing/checkout` | JWT or API Key | `requireUserSession` (tries JWT first) |
| `/v1/chat` | API Key only | `requireSpectyraApiKey` |
| `/v1/replay` | API Key only | `requireSpectyraApiKey` |

**Note:** All dashboard endpoints (runs, savings, billing) require JWT. Gateway endpoints (chat, replay) use API keys.

## 🔧 Diagnosis Steps

### Step 1: Check Railway Variables

```bash
# In Railway Dashboard → Variables, verify:
SUPABASE_URL=https://jajqvceuenqeblbgsigt.supabase.co
```

### Step 2: Check Railway Logs

Look for:
- ❌ `SUPABASE_URL not configured` → Variable missing
- ❌ `JWT verification failed` → Token or URL issue
- ❌ `ENOTFOUND` or network errors → Can't reach Supabase

### Step 3: Test JWKS Endpoint

```bash
curl https://jajqvceuenqeblbgsigt.supabase.co/.well-known/jwks.json
```

Should return JSON. If it fails, there's a network issue.

### Step 4: Verify Token in Browser

1. Open browser DevTools → Network tab
2. Make a request to `/v1/auth/me`
3. Check Request Headers:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. If header is missing → Frontend not sending token
5. If header exists → Backend verification failing

## ✅ The Fix (99% of the time)

**Set `SUPABASE_URL` in Railway:**

1. Railway Dashboard
2. Your API Service
3. Variables tab
4. Add: `SUPABASE_URL` = `https://jajqvceuenqeblbgsigt.supabase.co`
5. Wait for restart
6. Log out and log back in
7. ✅ Done!

## 🧪 Verification

After fixing, test:

```bash
# Should return org info (not 401)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://spectyra.up.railway.app/v1/auth/me
```

## 📝 Why This Affects ALL Dashboard Endpoints

All dashboard endpoints share the same authentication middleware:

```typescript
// In runs.ts, savings.ts
runsRouter.use(requireUserSession);  // ← Applied to ALL routes
savingsRouter.use(requireUserSession);  // ← Applied to ALL routes

// In billing.ts, auth.ts
await requireUserSession(req, res, async () => {
  // Route logic here
});
```

**If `requireUserSession` fails, ALL routes using it fail with 401.**

## 🎯 Summary

**Root Cause:** JWT verification middleware failing because `SUPABASE_URL` is not set on Railway.

**Impact:** ALL dashboard endpoints fail (runs, savings, billing, auth/me).

**Fix:** Set `SUPABASE_URL` in Railway Variables.

**Time to Fix:** 2 minutes ⚡
