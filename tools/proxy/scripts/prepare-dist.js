#!/usr/bin/env node

/**
 * Prepare dist folder for distribution
 * - Copies dashboard to dist
 * - Ensures proper file structure
 * - Removes source maps and development files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const dashboardSrc = path.join(rootDir, 'dashboard');
const dashboardDest = path.join(distDir, 'dashboard');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Created dist directory');
}

// Copy dashboard to dist
if (fs.existsSync(dashboardSrc)) {
  // Remove existing dashboard in dist
  if (fs.existsSync(dashboardDest)) {
    fs.rmSync(dashboardDest, { recursive: true, force: true });
  }
  
  // Copy dashboard directory recursively
  function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  copyRecursive(dashboardSrc, dashboardDest);
  console.log('✅ Dashboard copied to dist');
} else {
  console.warn('⚠️  Dashboard directory not found');
}

// Make dist/spectyra-proxy.js executable
const mainFile = path.join(distDir, 'spectyra-proxy.js');
if (fs.existsSync(mainFile)) {
  try {
    fs.chmodSync(mainFile, 0o755);
    console.log('✅ Made spectyra-proxy.js executable');
  } catch (error) {
    console.warn('⚠️  Could not make file executable (Windows?):', error.message);
  }
} else {
  console.error('❌ spectyra-proxy.js not found in dist. Build may have failed.');
  process.exit(1);
}

// Remove any source maps if they exist
const sourceMapFile = path.join(distDir, 'spectyra-proxy.js.map');
if (fs.existsSync(sourceMapFile)) {
  fs.unlinkSync(sourceMapFile);
  console.log('✅ Removed source map');
}

console.log('✅ Distribution prepared - ready for publishing');
