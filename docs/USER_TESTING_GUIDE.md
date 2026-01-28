# User Testing Guide for @spectyra/sdk

## Quick Start for Users

### 1. Sign Up / Login
- Go to https://your-spectyra-domain.com
- Click "Sign Up" or "Login"
- Use email/password authentication

### 2. Bootstrap Organization
- After first login, you'll be prompted to create an organization
- Enter organization name (required)
- Optionally enter project name
- Click "Create Organization"
- **Save your API key** - it's shown only once!

### 3. Install SDK
```bash
npm install @spectyra/sdk
```

### 4. Test Local Mode (No API Required)
```javascript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({ mode: "local" });
const ctx = { runId: crypto.randomUUID(), budgetUsd: 2.5 };
const options = spectyra.agentOptions(ctx, "Fix the bug");

console.log('Model:', options.model);
console.log('Budget:', options.maxBudgetUsd);
```

### 5. Test API Mode (Requires Valid API Key)
```javascript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY, // Your API key from step 2
});

const ctx = { runId: crypto.randomUUID() };
const response = await spectyra.agentOptionsRemote(ctx, {
  promptChars: 5000,
  path: "code",
  repoId: "my-repo",
});

console.log('Options:', response.options);
console.log('Run ID:', response.run_id);
```

## SDK Access Control

### If SDK is Disabled

If the owner has disabled SDK access for your organization, you'll get:

```json
{
  "error": "SDK access is disabled for this organization",
  "message": "Please contact support to enable SDK access"
}
```

**What to do:**
1. Contact support (or the owner) to enable SDK access
2. Owner can enable it in the Admin panel
3. Once enabled, SDK endpoints will work immediately

### What Still Works

Even if SDK is disabled, these endpoints still work:
- `POST /v1/chat` - Chat optimization (not SDK)
- `GET /v1/auth/*` - Authentication
- `GET /v1/billing/*` - Billing status

## Testing Checklist

- [ ] Can sign up and login
- [ ] Can bootstrap organization
- [ ] Can get API key
- [ ] Can install SDK: `npm install @spectyra/sdk`
- [ ] Local mode works (no API key needed)
- [ ] API mode works with valid API key
- [ ] If SDK disabled, get clear error message
- [ ] Can see runs in dashboard
- [ ] Can see usage/savings

## Troubleshooting

### "SDK access is disabled"
- Contact owner/admin to enable SDK access
- Owner email: gkh1974@gmail.com

### "Invalid API key"
- Verify API key is correct
- Check if key was revoked
- Generate new API key in Settings

### "Not authenticated"
- Ensure you're logged in
- Check Supabase session is valid
- Try logging out and back in

### SDK endpoints return 403
- Check if SDK access is enabled for your org
- Verify API key is valid and not revoked
- Check API key has correct scopes

## Integration Examples

See `packages/sdk/TESTING.md` for complete test suite and examples.
