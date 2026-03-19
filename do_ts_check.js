const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('No Type Errors');
} catch (e) {
  fs.writeFileSync('super_clean_errs.txt', e.stdout ? e.stdout.toString() : '');
  if (e.stderr) {
      fs.appendFileSync('super_clean_errs.txt', '\n' + e.stderr.toString());
  }
  console.log('Errors written to super_clean_errs.txt');
}