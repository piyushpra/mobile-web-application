#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function patchFoojayResolver() {
  const targetPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native',
    'gradle-plugin',
    'settings.gradle.kts',
  );

  if (!fs.existsSync(targetPath)) {
    return;
  }

  const original = fs.readFileSync(targetPath, 'utf8');
  const patched = original.replace(
    'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")',
    'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")',
  );

  if (patched !== original) {
    fs.writeFileSync(targetPath, patched);
    process.stdout.write(`[postinstall] Patched Foojay resolver in ${targetPath}\n`);
  }
}

patchFoojayResolver();
