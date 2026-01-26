# Angular Environment File Replacement

## ✅ Already Configured!

Angular's environment file replacement **is already set up** in `angular.json`:

```json
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.prod.ts"
      }
    ]
  }
}
```

## How It Works

1. **Development** (`ng serve` or `ng build`):
   - Uses `src/environments/environment.ts`
   - Contains localhost URLs and dev values

2. **Production** (`ng build --configuration production`):
   - Automatically replaces `environment.ts` with `environment.prod.ts`
   - Uses production URLs and values

## Current Setup

- ✅ `environment.ts` - Development (localhost)
- ✅ `environment.prod.ts` - Production (hardcoded values)

## For Deployment Platforms (Vercel/Netlify)

The current setup with hardcoded values works fine. However, if you want to use environment variables from your deployment platform, you have two options:

### Option 1: Keep Hardcoded Values (Current - Simplest)
- ✅ Works immediately
- ✅ No build scripts needed
- ⚠️ Values are in the code (but that's fine for public keys like Supabase anon key)

### Option 2: Build-Time Replacement Script
Create a script that replaces values during build:

**`scripts/replace-env.js`:**
```javascript
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '../src/environments/environment.prod.ts');
let content = fs.readFileSync(envFile, 'utf8');

// Replace with environment variables if available
content = content.replace(
  /supabaseUrl: '[^']*'/,
  `supabaseUrl: '${process.env.SUPABASE_URL || 'https://jajqvceuenqeblbgsigt.supabase.co'}'`
);
content = content.replace(
  /supabaseAnonKey: '[^']*'/,
  `supabaseAnonKey: '${process.env.SUPABASE_ANON_KEY || '...'}'`
);

fs.writeFileSync(envFile, content);
```

Then update `package.json`:
```json
{
  "scripts": {
    "build": "node scripts/replace-env.js && ng build --configuration production"
  }
}
```

## Recommendation

**Keep the current setup** (hardcoded values) because:
1. ✅ Angular's file replacement is already working
2. ✅ Supabase anon key is safe to expose (it's public by design)
3. ✅ Simpler and more reliable
4. ✅ No build script complexity

The environment file replacement **is working** - when you build for production, Angular automatically uses `environment.prod.ts` instead of `environment.ts`.
