#!/usr/bin/env node
"use strict";

const G = "\x1b[32m";
const C = "\x1b[36m";
const B = "\x1b[1m";
const D = "\x1b[2m";
const R = "\x1b[0m";

console.log("");
console.log(`  ${G}✓${R} ${B}Spectyra Local Companion installed${R}`);
console.log("");
console.log(`  Next steps:`);
console.log(`    1. Run ${C}spectyra-companion setup${R}   ${D}(account + provider key + OpenClaw config)${R}`);
console.log(`    2. Run ${C}spectyra-companion start --open${R}   ${D}(starts companion + opens savings dashboard)${R}`);
console.log(`    3. Use OpenClaw as usual — optimization is automatic`);
console.log("");
console.log(`  ${D}Or just run ${C}spectyra-companion${R}${D} — it will guide you through setup on first launch.${R}`);
console.log("");
