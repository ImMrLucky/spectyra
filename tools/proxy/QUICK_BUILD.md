# Quick Build Guide

## To Hide Source Code from Users

### Build Process (Protects Your Code)

1. **Compile TypeScript to JavaScript:**
   ```bash
   cd tools/proxy
   npm run build
   ```

2. **What this does:**
   - Compiles `spectyra-proxy.ts` → `dist/spectyra-proxy.js` (JavaScript only, no source)
   - Copies `dashboard/` → `dist/dashboard/`
   - Removes source maps
   - Prepares for distribution

3. **Verify no source code:**
   ```bash
   ls dist/
   # Should see: spectyra-proxy.js (compiled) and dashboard/
   # Should NOT see: spectyra-proxy.ts (source)
   ```

### Publishing to npm

**Users will install:**
```bash
npm install -g @spectyra/proxy
```

**They get:**
- ✅ Compiled JavaScript (hard to read)
- ✅ Dashboard files
- ✅ Documentation

**They DON'T get:**
- ❌ Your TypeScript source code
- ❌ Build configuration
- ❌ Development files

### Current Status

✅ Build process configured
✅ TypeScript compilation set up
✅ .npmignore excludes source files
✅ Ready to build and publish

**Your source code stays private!**
