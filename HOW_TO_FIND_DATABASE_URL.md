# How to Find DATABASE_URL

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
1. Visit https://supabase.com
2. Sign in to your account
3. Select your project (the one with URL: `jajqvceuenqeblbgsigt.supabase.co`)

### 2. Navigate to Database Settings
1. In the left sidebar, click **Settings** (⚙️ gear icon)
2. Click **Database** in the settings menu

### 3. Find Connection String
1. Scroll down to the **Connection string** section
2. You'll see several tabs: **URI**, **JDBC**, **Golang**, etc.
3. Click on the **URI** tab

### 4. Copy the Connection String
You'll see something like:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**OR** it might look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
```

### 5. Get Your Database Password
- If you see `[YOUR-PASSWORD]` or `[PASSWORD]` in the connection string, you need to replace it
- Look for **Database password** in the same Database settings page
- If you don't know it or it's not shown, you can:
  - **Reset it**: Click "Reset database password" button
  - **Copy it**: If it's displayed, click the eye icon to reveal it

### 6. Construct Your DATABASE_URL
Replace `[YOUR-PASSWORD]` or `[PASSWORD]` with your actual password:

**Format:**
```
postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
```

**Example (with actual password):**
```
postgresql://postgres:MySecurePassword123@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
```

## Alternative: Direct Connection String

If Supabase shows you a connection pooler URL, you can also use the direct connection:

**Direct connection format:**
```
postgresql://postgres:YOUR_PASSWORD@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
```

**Connection pooler format (also works):**
```
postgresql://postgres.jajqvceuenqeblbgsigt:YOUR_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

Both will work, but the direct connection (`db.jajqvceuenqeblbgsigt.supabase.co:5432`) is simpler.

## Quick Visual Guide

```
Supabase Dashboard
└── Settings (⚙️)
    └── Database
        ├── Connection string
        │   └── URI tab ← Click here
        │       └── Copy the string
        └── Database password ← Get your password here
            └── Replace [PASSWORD] in connection string
```

## Important Notes

⚠️ **Password Security:**
- The password is shown only once when you create the project
- If you don't remember it, you'll need to reset it
- Resetting the password will disconnect any existing connections

⚠️ **Connection Pooling:**
- Supabase offers connection pooling (port 6543) for better performance
- Direct connection (port 5432) works fine for most use cases
- Use the pooler if you expect high connection counts

## Troubleshooting

### "I don't see my password"
- Click "Reset database password" to set a new one
- Make sure to save it somewhere secure!

### "Connection refused"
- Check that your IP is allowed (Supabase allows all by default)
- Verify the password is correct (no extra spaces)
- Make sure you're using the correct port (5432 for direct, 6543 for pooler)

### "Invalid connection string format"
- Make sure there are no spaces in the password
- URL-encode special characters in the password if needed
- The format should be: `postgresql://postgres:PASSWORD@HOST:PORT/database`

## Your Specific DATABASE_URL

Based on your project, it should look like:

```
postgresql://postgres:YOUR_PASSWORD@db.jajqvceuenqeblbgsigt.supabase.co:5432/postgres
```

Just replace `YOUR_PASSWORD` with your actual database password from the Supabase dashboard!
