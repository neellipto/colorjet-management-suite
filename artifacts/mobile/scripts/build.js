const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../static-build');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Building Expo web bundle...');
try {
  execSync('npx expo export --platform web --output-dir ./static-build', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
  console.log('Build complete!');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
