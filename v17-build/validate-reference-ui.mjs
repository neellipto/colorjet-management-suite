import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'work');
const fail = (message) => { throw new Error(message); };
const requireText = (file, values) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const value of values) {
    if (!text.includes(value)) fail(`${file} is missing required marker: ${value}`);
  }
};

// The restored reference source uses the Expo Babel preset. The SDK 54 scaffold
// did not declare it directly, so make the dependency explicit before install.
const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.devDependencies = { ...(pkg.devDependencies || {}) };
pkg.devDependencies['babel-preset-expo'] ||= '~54.0.0';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
if (app.expo?.name !== 'COLORJET Management Suite') fail('Incorrect app name.');
if (app.expo?.version !== '1.7.1') fail('Incorrect app version.');
if (app.expo?.android?.package !== 'com.colorjetbd.managementsuite') fail('Incorrect Android package.');
if (app.expo?.android?.versionCode !== 1702) fail('Incorrect Android versionCode.');
if (app.expo?.extra?.eas?.projectId !== 'affe8187-2811-4f17-9620-dbf8d542577a') fail('Incorrect Expo project ID.');
if (!fs.existsSync(path.join(root, app.expo.icon))) fail('Configured icon is missing.');
if (!fs.existsSync(path.join(root, app.expo.splash?.image || ''))) fail('Configured splash image is missing.');

const plugins = app.expo?.plugins || [];
for (const plugin of plugins) {
  if (Array.isArray(plugin) && plugin[0] === 'expo-router' && plugin[1]?.origin) {
    fail('Expo Router origin must not be configured.');
  }
}

requireText('app/login.tsx', ['COLORJET', 'Business Management System', 'Sign In']);
requireText('app/(tabs)/index.tsx', ['Good morning', 'Sales MTD', 'Open Service Tickets', 'Service Control']);
requireText('constants/colors.ts', ['#1A237E', '#F57C00', '#F0F2F5', '#FFFFFF', '#1C1C1E']);

const sourceFiles = [];
const collect = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) sourceFiles.push(full);
  }
};
for (const dir of ['app', 'components', 'constants', 'context', 'hooks', 'lib']) collect(path.join(root, dir));
sourceFiles.push(path.join(root, 'app.json'));
const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const forbidden of [
  'https://replit.com/',
  'colorjet-management-suite.replit.app',
  'First Owner Setup',
  '/deliveries/new • /api/deliveries',
  '/admin/push-notifications/new • /notifications/broadcast',
  'admin123',
]) {
  if (source.includes(forbidden)) fail(`Forbidden content remains: ${forbidden}`);
}

console.log('COLORJET authoritative reference UI identity validation passed.');
console.log('App: COLORJET Management Suite 1.7.1 (1702)');
console.log('Package: com.colorjetbd.managementsuite');
