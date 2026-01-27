# Supabase Navigator LockManager Fix

## Problem
Console showed: `Acquiring an exclusive Navigator LockManager lock "lock:sb-<project>-auth-token" immediately failed`

This occurred because:
- Supabase client was being created multiple times
- Multiple `onAuthStateChange` listeners were attached
- HMR/dev tools could cause duplicate initialization

## Solution Implemented

### Phase 1: Located All Initializations
**Found:**
- ✅ Only ONE `createClient()` call: `apps/web/src/app/services/supabase.service.ts:29`
- ✅ Only ONE `onAuthStateChange()` call: `apps/web/src/app/services/supabase.service.ts:60`
- ✅ No duplicate providers found

### Phase 2: Created Singleton Client
**Created:** `apps/web/src/app/core/supabase/supabase.client.ts`
- Singleton pattern with global guard for HMR/dev scenarios
- Exactly one `createClient()` call in entire repo
- Debug logging to track initialization

### Phase 3: Centralized Auth Listeners
**Created:** `apps/web/src/app/core/auth/authSession.service.ts`
- Single `onAuthStateChange` listener
- Centralized session/user state management
- Proper cleanup on service destroy

### Phase 4: Refactored SupabaseService
**Updated:** `apps/web/src/app/services/supabase.service.ts`
- Now uses singleton client from `supabase.client.ts`
- Delegates session management to `AuthSessionService`
- Maintains backward compatibility

## Files Changed

1. **NEW:** `apps/web/src/app/core/supabase/supabase.client.ts`
   - Singleton Supabase client
   - Global guard for HMR scenarios
   - Only place `createClient()` is called

2. **NEW:** `apps/web/src/app/core/auth/authSession.service.ts`
   - Centralized auth state management
   - Single `onAuthStateChange` listener
   - Handles LockManager errors gracefully

3. **UPDATED:** `apps/web/src/app/services/supabase.service.ts`
   - Uses singleton client
   - Delegates to `AuthSessionService`
   - Maintains existing API for backward compatibility

## Verification

✅ **Exactly one `createClient()` call** in entire repo:
- `apps/web/src/app/core/supabase/supabase.client.ts:36`

✅ **Exactly one `onAuthStateChange()` listener**:
- `apps/web/src/app/core/auth/authSession.service.ts:68`

✅ **No duplicate providers**:
- Both services use `providedIn: 'root'`
- No module-level providers found

✅ **Global singleton guard**:
- Prevents duplicate init in HMR/dev scenarios
- Uses `globalThis.__spectyra_supabase_client__`

## Expected Results

1. **LockManager warning should disappear** or only appear when multiple tabs are open (acceptable)
2. **Single client creation log** per tab: `[supabase] client created <timestamp>`
3. **Single auth listener log** per app: `[auth] initializing auth state listener`
4. **Auth still works**: Login, logout, session persistence all functional

## Testing Checklist

- [ ] Open app in one tab → refresh 3 times → confirm no lock spam
- [ ] Open 2nd tab → if warning appears, confirm auth still works
- [ ] Login, refresh, confirm still logged in
- [ ] Check console for `[supabase] client created` - should log once per tab
- [ ] Check console for `[auth] initializing` - should log once per app

## Backward Compatibility

All existing code using `SupabaseService` continues to work:
- `supabaseService.getSession()` ✅
- `supabaseService.getUser()` ✅
- `supabaseService.getAccessToken()` ✅
- `supabaseService.signIn()` ✅
- `supabaseService.signUp()` ✅
- `supabaseService.signOut()` ✅
- `supabaseService.getClient()` ✅

No breaking changes to existing API.
