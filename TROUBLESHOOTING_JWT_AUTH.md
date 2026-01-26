# Troubleshooting JWT Authentication Errors

## Error: "Invalid or expired token" (401)

This error occurs when the API cannot verify the Supabase JWT token. Here's how to fix it:

## Step 1: Verify SUPABASE_URL is Set on Railway

1. Go to Railway Dashboard
2. Select your API service
3. Go to **Variables** tab
4. Verify `SUPABASE_URL` is set to:
   ```
   https://jajqvceuenqeblbgsigt.supabase.co
   ```
   (No trailing slash!)

5. If it's missing or incorrect:
   - Add/update the variable
   - Railway will automatically restart your service

## Step 2: Check Token Expiration

Supabase JWT tokens expire after 1 hour by default. If you're getting this error:

1. **Log out and log back in** to get a fresh token
2. The frontend should automatically refresh tokens, but if not:
   - Clear browser storage
   - Log in again

## Step 3: Verify Token is Being Sent

Check the browser's Network tab:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Find the request to `/v1/auth/me`
4. Check the **Headers** section
5. Verify you see:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

If the header is missing:
- The frontend isn't sending the token
- Check `SupabaseService.getAccessToken()` is working
- Verify the user is logged in

## Step 4: Check API Logs

On Railway:

1. Go to your API service
2. Click **Deployments** tab
3. Click on the latest deployment
4. Check **Logs** for JWT verification errors

Look for messages like:
- `JWT verification failed`
- `SUPABASE_URL not configured`
- `Invalid token: missing user ID`

## Step 5: Test JWKS Endpoint

Verify the JWKS endpoint is accessible:

```bash
curl https://jajqvceuenqeblbgsigt.supabase.co/.well-known/jwks.json
```

You should see a JSON response with keys. If you get an error, there's a network issue.

## Step 6: Common Issues

### Issue: SUPABASE_URL has trailing slash
**Fix:** Remove trailing slash
- ❌ Wrong: `https://jajqvceuenqeblbgsigt.supabase.co/`
- ✅ Correct: `https://jajqvceuenqeblbgsigt.supabase.co`

### Issue: Token expired
**Fix:** Log out and log back in to get a fresh token

### Issue: Wrong Supabase project
**Fix:** Verify you're using the correct `SUPABASE_URL` for your project

### Issue: Network/CORS
**Fix:** Check Railway logs for connection errors to Supabase

## Step 7: Debug Mode

If you're still having issues, temporarily enable debug logging:

1. In Railway, add environment variable:
   ```
   NODE_ENV=development
   ```

2. Check logs for detailed error messages
3. Remove `NODE_ENV` after debugging (or set to `production`)

## Quick Checklist

- [ ] `SUPABASE_URL` is set correctly on Railway (no trailing slash)
- [ ] User is logged in (has valid Supabase session)
- [ ] Token is being sent in `Authorization` header
- [ ] Token is not expired (try logging out/in)
- [ ] JWKS endpoint is accessible
- [ ] Check Railway logs for specific errors

## Still Not Working?

1. **Check Railway logs** for the exact error message
2. **Verify token format** - should start with `eyJ...`
3. **Test with a fresh token** - log out and log back in
4. **Verify Supabase project** - make sure you're using the right project URL

## Related Files

- JWT verification: `apps/api/src/middleware/auth.ts` (line 220-274)
- Frontend token: `apps/web/src/app/services/supabase.service.ts`
- Environment config: `apps/api/src/config.ts`
