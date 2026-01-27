# Debug: Multiple /auth/me Calls

## Issue
The `/v1/auth/me` endpoint is being called 3 times and returning 401 "Missing X-SPECTYRA-API-KEY header".

## Root Causes Identified

### 1. Multiple Components Calling `/auth/me`
Three components are calling this endpoint:
- **`org-switcher.component.ts`** - Subscribes to session changes, calls `loadOrgInfo()`
- **`login.page.ts`** - Calls `checkBootstrap()` when session exists
- **`settings.page.ts`** - Calls it on `ngOnInit()`

### 2. Interceptor Not Adding Headers
The interceptor should automatically add auth headers, but when:
- No Supabase JWT token exists
- No API key exists
- The interceptor proceeds without headers → 401 error

## Fixes Applied

### 1. Enhanced Interceptor Logging
Added console logging to track when headers are added:
- Logs when Bearer token is added
- Logs when API key is added
- Warns when no auth is available

### 2. Improved Debouncing
- **org-switcher**: Increased debounce to 500ms, checks token equality
- **login.page**: Added debounce and distinctUntilChanged

### 3. Token Checks Before Calls
- **org-switcher**: Now checks for token before calling `/auth/me`
- **login.page**: Already checks for token

### 4. Settings Page Updated
- Removed manual header setting
- Now uses interceptor (but still checks for token first)

## How to Debug

1. **Check Browser Console** for these logs:
   - `[AuthInterceptor] Added Bearer token for ...`
   - `[AuthInterceptor] Added API key for ...`
   - `[AuthInterceptor] No authentication available ...`
   - `[OrgSwitcher] Calling /auth/me`
   - `[LoginPage] Calling /auth/me for checkBootstrap`

2. **Check Network Tab**:
   - Look for 3 requests to `/v1/auth/me`
   - Check request headers - should have either `Authorization: Bearer ...` or `X-SPECTYRA-API-KEY: ...`
   - If headers are missing, interceptor isn't working

3. **Verify Interceptor Registration**:
   - Check `main.ts` - should have `withInterceptors([authInterceptor])`
   - Interceptor should be in `apps/web/src/app/core/interceptors/auth.interceptor.ts`

## Expected Behavior

- **When authenticated with Supabase**: Requests should have `Authorization: Bearer <token>`
- **When authenticated with API key**: Requests should have `X-SPECTYRA-API-KEY: <key>`
- **When not authenticated**: Requests proceed without headers → 401 (expected)

## Next Steps

1. Check console logs to see which component is calling `/auth/me` 3 times
2. Verify interceptor is actually adding headers (check Network tab)
3. If interceptor isn't working, check if it's registered in `main.ts`
4. Consider adding a shared service to cache `/auth/me` results to prevent duplicate calls
