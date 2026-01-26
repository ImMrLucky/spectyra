# How to Fix Supabase Email Redirect URLs

## Problem
Supabase registration emails contain links that redirect to `localhost:3000` instead of your actual website URL.

## Solution
Update the **Site URL** and **Redirect URLs** in your Supabase project dashboard.

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
1. Visit https://supabase.com
2. Sign in to your account
3. Select your project: **jajqvceuenqeblbgsigt**

### 2. Navigate to Authentication Settings
1. Click **Settings** (⚙️ gear icon) in the left sidebar
2. Click **Authentication** in the settings menu
3. Scroll down to the **URL Configuration** section

### 3. Update Site URL
1. Find the **Site URL** field
2. Replace `http://localhost:3000` with your actual website URL
   - **If you have a production domain:** Use `https://yourdomain.com`
   - **If using Vercel/Netlify:** Use your deployment URL (e.g., `https://spectyra.vercel.app`)
   - **If still in development:** Use `http://localhost:4200` (your Angular dev server)

**Example:**
```
https://spectyra.vercel.app
```
or
```
http://localhost:4200
```

### 4. Update Redirect URLs
1. Scroll to the **Redirect URLs** section (below Site URL)
2. Click **Add URL** or edit the existing list
3. Add your production URL(s):
   - Your main website URL
   - Any additional redirect URLs you need
   - Keep `http://localhost:4200` for local development if needed

**Example Redirect URLs:**
```
https://spectyra.vercel.app/**
http://localhost:4200/**
```

**Note:** The `/**` wildcard allows all paths under that domain.

### 5. Save Changes
1. Click **Save** at the bottom of the page
2. Wait for confirmation that settings were saved

### 6. Test
1. Try registering a new account
2. Check the confirmation email
3. The link should now point to your website URL instead of `localhost:3000`

## Visual Guide

```
Supabase Dashboard
├── Settings (⚙️)
│   └── Authentication
│       └── URL Configuration
│           ├── Site URL: [Your Website URL]
│           └── Redirect URLs:
│               ├── https://yourdomain.com/**
│               └── http://localhost:4200/** (for dev)
```

## Important Notes

- **Site URL** is the base URL used in email links
- **Redirect URLs** are allowed destinations after authentication
- Both must be set correctly for email confirmation to work
- Changes take effect immediately (no restart needed)
- You can add multiple redirect URLs for different environments

## Common URLs

### Development
- Site URL: `http://localhost:4200`
- Redirect URLs: `http://localhost:4200/**`

### Production (Vercel)
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/**`

### Production (Netlify)
- Site URL: `https://your-app.netlify.app`
- Redirect URLs: `https://your-app.netlify.app/**`

### Production (Custom Domain)
- Site URL: `https://yourdomain.com`
- Redirect URLs: `https://yourdomain.com/**`

## Troubleshooting

### Email still shows localhost:3000
- Clear your browser cache
- Wait a few minutes for changes to propagate
- Check that you saved the changes in Supabase dashboard

### Redirect not working
- Ensure your redirect URL is in the **Redirect URLs** list
- Check that the URL format is correct (include `/**` for wildcard)
- Verify your website is accessible at that URL

### "Redirect URL not allowed" error
- Add the exact URL to the **Redirect URLs** list in Supabase
- Include the protocol (`http://` or `https://`)
- Use `/**` wildcard to allow all paths under that domain

## Need Help?

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Check your project logs: Supabase Dashboard → Logs → Auth Logs
