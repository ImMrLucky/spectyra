# Where to Find Supabase Environment Variables

This guide shows you exactly where to find each environment variable in your Supabase project dashboard.

## Step 1: Access Your Supabase Project

1. Go to https://supabase.com
2. Sign in to your account
3. Select your project (or create a new one)

## Step 2: Find Each Variable

### DATABASE_URL

**Location:** Project Settings → Database → Connection String

1. In your Supabase dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **Database** in the settings menu
3. Scroll down to **Connection string** section
4. Select **URI** tab
5. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)

**Important:** Replace `[YOUR-PASSWORD]` with your actual database password (found in the same section under "Database password")

**Example:**
```
postgresql://postgres:your-actual-password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### SUPABASE_URL

**Location:** Project Settings → API → Project URL

1. Go to **Settings** → **API**
2. Find **Project URL** (also called "Project URL" or "API URL")
3. Copy the URL (it looks like: `https://[PROJECT-REF].supabase.co`)

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

### SUPABASE_ANON_KEY

**Location:** Project Settings → API → Project API keys → `anon` `public`

1. Go to **Settings** → **API**
2. Scroll to **Project API keys** section
3. Find the key labeled **`anon` `public`**
4. Click the **eye icon** to reveal it (or copy directly)
5. Copy the key (starts with `eyJ...`)

**Note:** This is safe to use in client-side code (browser/Angular app)

### SUPABASE_SERVICE_ROLE_KEY

**Location:** Project Settings → API → Project API keys → `service_role` `secret`

1. Go to **Settings** → **API**
2. Scroll to **Project API keys** section
3. Find the key labeled **`service_role` `secret`**
4. Click the **eye icon** to reveal it
5. Copy the key (starts with `eyJ...`)

**⚠️ WARNING:** This key has admin privileges. **NEVER** expose it in client-side code. Only use it in your backend API server.

### SUPABASE_JWT_SECRET

**Location:** Project Settings → API → JWT Secret

1. Go to **Settings** → **API**
2. Scroll to **JWT Settings** section
3. Find **JWT Secret**
4. Click **Reveal** to show it
5. Copy the secret

**Note:** This is optional if you're using JWKS verification (recommended). The `jose` library can verify JWTs using Supabase's public JWKS endpoint automatically.

### ADMIN_TOKEN

**Location:** You create this yourself!

This is a custom token for your admin endpoints. You can generate any secure random string.

**To generate:**
```bash
# Option 1: Use openssl
openssl rand -hex 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Use an online generator
# https://www.random.org/strings/
```

**Example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

Store this securely and use it for the `X-ADMIN-TOKEN` header in admin API calls.

### Site URL & Redirect URLs (For Email Links)

**Location:** Project Settings → Authentication → URL Configuration

**Important:** This controls where Supabase email confirmation links redirect to.

1. Go to **Settings** → **Authentication**
2. Scroll to **URL Configuration** section
3. Update **Site URL** to your production website URL (not localhost)
4. Add your website URL to **Redirect URLs** list

**Example:**
- Site URL: `https://yourdomain.com` or `https://your-app.vercel.app`
- Redirect URLs: `https://yourdomain.com/**` (use `/**` wildcard for all paths)

**⚠️ Common Issue:** If email links redirect to `localhost:3000`, update these settings!

See `HOW_TO_FIX_SUPABASE_REDIRECT_URLS.md` for detailed instructions.

## Step 3: Set Environment Variables

### For API (Backend)

Create or update `apps/api/.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here  # Optional

# Admin
ADMIN_TOKEN=your-generated-admin-token-here

# Other existing vars...
PORT=8080
# ... etc
```

### For Web (Frontend)

Update `apps/web/src/environments/environment.ts` (development):

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/v1',
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

Update `apps/web/src/environments/environment.prod.ts` (production):

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://spectyra.up.railway.app/v1',
  supabaseUrl: process.env['SUPABASE_URL'] || '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] || '',
};
```

For production deployment (Vercel/Netlify), set these as environment variables in your hosting platform's dashboard.

## Quick Reference: Dashboard Navigation

```
Supabase Dashboard
├── Settings (⚙️)
│   ├── API
│   │   ├── Project URL → SUPABASE_URL
│   │   ├── Project API keys
│   │   │   ├── anon public → SUPABASE_ANON_KEY
│   │   │   └── service_role secret → SUPABASE_SERVICE_ROLE_KEY
│   │   └── JWT Secret → SUPABASE_JWT_SECRET (optional)
│   └── Database
│       ├── Connection string → DATABASE_URL
│       └── Database password (needed for DATABASE_URL)
```

## Security Checklist

- ✅ **SUPABASE_ANON_KEY**: Safe for client-side (browser)
- ⚠️ **SUPABASE_SERVICE_ROLE_KEY**: Backend only! Never commit to Git
- ⚠️ **SUPABASE_JWT_SECRET**: Backend only (optional)
- ⚠️ **DATABASE_URL**: Backend only! Contains password
- ⚠️ **ADMIN_TOKEN**: Backend only! Custom token for admin endpoints

## Testing Your Setup

After setting environment variables:

1. **Test API connection:**
   ```bash
   cd apps/api
   pnpm dev
   # Should connect to Supabase without errors
   ```

2. **Test Supabase auth:**
   - Open web app
   - Try registering a new account
   - Check Supabase dashboard → Authentication → Users
   - You should see the new user

3. **Test database:**
   - Go to Supabase dashboard → Table Editor
   - You should see your tables (orgs, projects, etc.)
   - Run migrations if tables don't exist yet

## Troubleshooting

### "Connection refused" or "Database error"
- Check DATABASE_URL format
- Verify database password is correct
- Ensure your IP is allowed (Supabase allows all by default, but check Network Restrictions)

### "Invalid API key"
- Verify you copied the entire key (they're long!)
- Check you're using the right key (anon vs service_role)
- Ensure no extra spaces or newlines

### "JWT verification failed"
- Check SUPABASE_URL is correct
- Verify JWT_SECRET if using it (or ensure JWKS is accessible)
- Check token expiration (default is 1 hour)

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Check your project logs in Supabase dashboard → Logs
