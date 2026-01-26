# Environment Variables Setup Summary

## ✅ Files Updated

### 1. **API Backend** (`apps/api/.env`)
- ✅ `SUPABASE_URL` = `https://jajqvceuenqeblbgsigt.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = (set)
- ✅ `SUPABASE_JWT_SECRET` = (set)
- ✅ `ADMIN_TOKEN` = (set)
- ⚠️ **`DATABASE_URL`** = **NEEDS YOUR DATABASE PASSWORD**

### 2. **Web Frontend - Development** (`apps/web/src/environments/environment.ts`)
- ✅ `supabaseUrl` = `https://jajqvceuenqeblbgsigt.supabase.co`
- ✅ `supabaseAnonKey` = (set)

### 3. **Web Frontend - Production** (`apps/web/src/environments/environment.prod.ts`)
- ✅ Already configured to read from environment variables
- ⚠️ **Needs to be set in deployment platform**

## ⚠️ Action Required

### 1. Complete DATABASE_URL in `apps/api/.env`

You need to get your database password from Supabase and update the `DATABASE_URL`:

1. Go to Supabase Dashboard → Settings → Database
2. Find your **Database password** (or reset it if needed)
3. Update `apps/api/.env`:
   ```bash
   DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
   ```

### 2. Set Production Environment Variables

For production deployments, you'll need to set these in your hosting platform:

#### Railway (API Backend)
Set these in Railway dashboard → Your Service → Variables:
- `DATABASE_URL` (with your actual password)
- `SUPABASE_URL` = `https://jajqvceuenqeblbgsigt.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)
- `SUPABASE_JWT_SECRET` = `334ec74a-6cb3-4752-afb3-1a427ccc2459`
- `ADMIN_TOKEN` = `c0ee982246163d2948a33d506a1256131f60014de88ea50929e63c9d079f61ad`

#### Vercel/Netlify (Web Frontend)
Set these in your hosting platform's environment variables:
- `SUPABASE_URL` = `https://jajqvceuenqeblbgsigt.supabase.co`
- `SUPABASE_ANON_KEY` = (your anon key)

The production build will automatically use these via `environment.prod.ts`.

## 📋 Checklist

- [x] API `.env` file created with Supabase values
- [x] Web `environment.ts` updated (development)
- [x] Web `environment.prod.ts` already configured for production
- [ ] **Update DATABASE_URL with actual password** (required)
- [ ] Set production env vars in Railway (for API)
- [ ] Set production env vars in Vercel/Netlify (for web)

## 🔒 Security Notes

- ✅ `.env` files are in `.gitignore` (won't be committed)
- ⚠️ Never commit `.env` files to Git
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is secret - backend only
- ✅ `SUPABASE_ANON_KEY` is safe for client-side

## 🧪 Testing

After updating `DATABASE_URL`:

1. **Test API:**
   ```bash
   cd apps/api
   pnpm dev
   # Should connect to Supabase without errors
   ```

2. **Test Web:**
   ```bash
   cd apps/web
   pnpm start
   # Try registering a new account
   ```

3. **Verify in Supabase:**
   - Dashboard → Authentication → Users (should see new user)
   - Dashboard → Table Editor (should see tables after running migrations)
