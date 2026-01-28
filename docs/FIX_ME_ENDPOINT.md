# Fix: Multiple /auth/me Calls and 502 Errors

## Problem

After login, the app was calling `/auth/me` API 3 times, and all calls were returning 502 errors.

## Root Causes

1. **Multiple Components Calling `/auth/me`**:
   - `org-switcher.component.ts` - calls on session change
   - `settings.page.ts` - calls twice (once for org, once for projects)
   - `login.page.ts` - calls in `checkBootstrap()`
   - `security.page.ts` - calls to get orgId
   - `provider-keys.page.ts` - calls twice (orgId and projects)
   - `projects.page.ts` - calls to get projects
   - `auth.service.ts` - calls in `getMe()`

2. **502 Error**: The `/auth/me` endpoint was using a complex promise-based middleware pattern that wasn't handling errors correctly, causing the endpoint to fail.

## Solution

### 1. Created MeService (Caching Service)

**File**: `apps/web/src/app/core/services/me.service.ts`

- **Caching**: Caches `/auth/me` response for 30 seconds
- **ShareReplay**: Uses RxJS `shareReplay(1)` to share the same Observable across all subscribers
- **Prevents Duplicate Calls**: All components using `MeService.getMe()` will share the same HTTP request

### 2. Fixed `/auth/me` Endpoint

**File**: `apps/api/src/routes/auth.ts`

- **Simplified Middleware Pattern**: Fixed the complex promise-based middleware to use proper Express middleware pattern
- **Better Error Handling**: Added proper error handling to prevent 502 errors
- **Type Safety**: Fixed TypeScript type errors

### 3. Updated All Components

Updated all components to use `MeService` instead of direct HTTP calls:

- ✅ `org-switcher.component.ts` - Uses `MeService`
- ✅ `settings.page.ts` - Uses `MeService` (single call instead of two)
- ✅ `login.page.ts` - Uses `MeService`
- ✅ `security.page.ts` - Uses `MeService`
- ✅ `provider-keys.page.ts` - Uses `MeService` (single call instead of two)
- ✅ `projects.page.ts` - Uses `MeService`
- ✅ `auth.service.ts` - Uses `MeService`

## Usage

### In Components

```typescript
import { MeService } from '../../core/services/me.service';

constructor(
  private meService: MeService
) {}

async loadData() {
  const me = await this.meService.getMe().toPromise();
  if (me) {
    this.orgId = me.org.id;
    this.projects = me.projects || [];
  }
}
```

### Cache Management

```typescript
// Force refresh (bypass cache)
const me = await this.meService.getMe(true).toPromise();

// Clear cache (e.g., after logout)
this.meService.clearCache();
```

## Benefits

1. **Single HTTP Request**: All components share the same HTTP request via RxJS `shareReplay`
2. **30-Second Cache**: Reduces API calls even further
3. **No 502 Errors**: Fixed endpoint error handling
4. **Better Performance**: Faster page loads, less server load
5. **Type Safety**: Proper TypeScript types

## Testing

After these changes:
- ✅ Only **one** `/auth/me` call should be made after login
- ✅ No more 502 errors
- ✅ All components get the same data from cache
- ✅ Cache automatically refreshes after 30 seconds

## Files Modified

- `apps/web/src/app/core/services/me.service.ts` - NEW FILE
- `apps/api/src/routes/auth.ts` - Fixed endpoint
- `apps/web/src/app/components/org-switcher.component.ts` - Use MeService
- `apps/web/src/app/features/settings/settings.page.ts` - Use MeService
- `apps/web/src/app/features/settings/security.page.ts` - Use MeService
- `apps/web/src/app/features/settings/provider-keys.page.ts` - Use MeService
- `apps/web/src/app/features/auth/login.page.ts` - Use MeService
- `apps/web/src/app/features/projects/projects.page.ts` - Use MeService
- `apps/web/src/app/core/auth/auth.service.ts` - Use MeService
