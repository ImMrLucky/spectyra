# Publishing Checklist

## Before Publishing

1. **Build the distribution:**
   ```bash
   cd tools/proxy
   npm run build
   ```

2. **Verify no source code in dist:**
   ```bash
   ls dist/
   # Should see: spectyra-proxy.js and dashboard/
   # Should NOT see: spectyra-proxy.ts
   ```

3. **Test the compiled version:**
   ```bash
   node dist/spectyra-proxy.js
   # Should start without errors
   ```

4. **Check what will be published:**
   ```bash
   npm pack --dry-run
   # Verify only dist/, docs, and package.json
   ```

5. **Test package locally:**
   ```bash
   npm pack
   npm install -g ./@spectyra-proxy-1.0.0.tgz
   spectyra-proxy
   # Should work
   ```

## Publishing

```bash
npm publish --access public
```

## After Publishing

1. Verify package on npm: https://www.npmjs.com/package/spectyra-proxy
2. Test installation: `npm install -g spectyra-proxy`
3. Update documentation with npm package instructions

## What Users Get

✅ Compiled JavaScript (no source)
✅ Dashboard files
✅ Documentation
❌ No TypeScript source
❌ No build configs
❌ No development files

**Your code is protected!**
