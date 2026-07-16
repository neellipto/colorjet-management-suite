import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const workRoot = path.resolve(process.argv[2] || 'work');
const sourceRoot = path.join(repoRoot, 'artifacts', 'mobile');
const appVersion = process.env.APP_VERSION || '1.7.1';
const androidVersionCode = Number(process.env.ANDROID_VERSION_CODE || '1702');
const projectId = process.env.EXPO_PROJECT_ID || 'affe8187-2811-4f17-9620-dbf8d542577a';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function copyEntry(relativePath) {
  const src = path.join(sourceRoot, relativePath);
  const dest = path.join(workRoot, relativePath);
  if (!fs.existsSync(src)) return;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

assert(fs.existsSync(sourceRoot), `Missing authoritative source: ${sourceRoot}`);
assert(fs.existsSync(workRoot), `Missing SDK 54 build scaffold: ${workRoot}`);

// EAS must see one package manager and one synchronized lockfile. The original
// scaffold contained an npm lock beside Yarn configuration, which made the remote
// install phase non-deterministic.
for (const lockfile of ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml']) {
  fs.rmSync(path.join(workRoot, lockfile), { force: true });
}

// Replace the generic V17 module shell with the original working mobile UI source.
for (const entry of ['app', 'assets', 'components', 'constants', 'context', 'hooks', 'lib']) {
  copyEntry(entry);
}
for (const file of ['babel.config.js', 'tsconfig.json', 'expo-env.d.ts']) {
  copyEntry(file);
}

const canonicalPackage = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
const packagePath = path.join(workRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.name = 'colorjet-management-suite';
pkg.version = appVersion;
pkg.private = true;
pkg.main = 'expo-router/entry';
pkg.scripts = {
  ...(pkg.scripts || {}),
  typecheck: 'tsc --noEmit',
};
pkg.dependencies = { ...(pkg.dependencies || {}) };

// Keep the proven SDK 54 scaffold versions, but add any runtime libraries required by
// the original COLORJET UI/data source. Workspace/Replit-only dependencies are excluded.
const skipVersionFromCanonical = new Set([
  'expo', 'react', 'react-dom', 'react-native', 'react-native-web',
  'expo-router', 'expo-font', 'expo-splash-screen', 'expo-haptics',
  'expo-image-picker', 'expo-web-browser', '@expo/vector-icons',
  'react-native-gesture-handler', 'react-native-reanimated',
  'react-native-safe-area-context', 'react-native-screens', 'react-native-svg',
]);
for (const [name, version] of Object.entries(canonicalPackage.dependencies || {})) {
  if (name.startsWith('@workspace/')) continue;
  if (skipVersionFromCanonical.has(name)) continue;
  if (!pkg.dependencies[name]) pkg.dependencies[name] = version;
}
delete pkg.dependencies['@workspace/api-client-react'];

// Explicitly required by the production AppContext restored above.
pkg.dependencies['@supabase/supabase-js'] ||= '^2.57.0';
pkg.dependencies['@tanstack/react-query'] ||= '^5.28.6';
pkg.dependencies['@expo-google-fonts/inter'] ||= '^0.4.0';
pkg.packageManager = 'yarn@1.22.22';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const appPath = path.join(workRoot, 'app.json');
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
app.expo = app.expo || {};
app.expo.name = 'COLORJET Management Suite';
app.expo.slug = 'colorjet-management-suite';
app.expo.version = appVersion;
app.expo.orientation = 'portrait';
app.expo.scheme = 'colorjet-erp';
app.expo.userInterfaceStyle = 'automatic';
app.expo.icon = './assets/images/icon.png';
app.expo.splash = {
  image: './assets/images/splash.png',
  resizeMode: 'contain',
  backgroundColor: '#1A237E',
};
app.expo.android = {
  ...(app.expo.android || {}),
  package: 'com.colorjetbd.managementsuite',
  versionCode: androidVersionCode,
  adaptiveIcon: {
    foregroundImage: './assets/images/icon.png',
    backgroundColor: '#1A237E',
  },
};
app.expo.ios = {
  ...(app.expo.ios || {}),
  supportsTablet: false,
  bundleIdentifier: 'com.colorjetbd.managementsuite',
};
app.expo.web = {
  ...(app.expo.web || {}),
  favicon: './assets/images/favicon.png',
  bundler: 'metro',
};

// Preserve Expo Router but remove the Replit origin and every legacy host binding.
const plugins = [];
for (const plugin of app.expo.plugins || []) {
  if (Array.isArray(plugin) && plugin[0] === 'expo-router') {
    plugins.push('expo-router');
  } else {
    plugins.push(plugin);
  }
}
if (!plugins.some((plugin) => plugin === 'expo-router' || (Array.isArray(plugin) && plugin[0] === 'expo-router'))) {
  plugins.unshift('expo-router');
}
if (!plugins.includes('expo-font')) plugins.push('expo-font');
app.expo.plugins = plugins;
app.expo.extra = {
  ...(app.expo.extra || {}),
  eas: { projectId },
};
if (app.expo.extra.router) delete app.expo.extra.router;
app.expo.experiments = {
  ...(app.expo.experiments || {}),
  typedRoutes: true,
};
fs.writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);

const easPath = path.join(workRoot, 'eas.json');
const eas = fs.existsSync(easPath)
  ? JSON.parse(fs.readFileSync(easPath, 'utf8'))
  : {};
eas.cli = { ...(eas.cli || {}), version: '>= 12.0.0', appVersionSource: 'local' };
eas.build = {
  ...(eas.build || {}),
  preview: {
    ...((eas.build || {}).preview || {}),
    distribution: 'internal',
    android: { ...(((eas.build || {}).preview || {}).android || {}), buildType: 'apk' },
  },
  production: {
    ...((eas.build || {}).production || {}),
    distribution: 'store',
    autoIncrement: false,
    android: { ...(((eas.build || {}).production || {}).android || {}), buildType: 'app-bundle' },
  },
};
fs.writeFileSync(easPath, `${JSON.stringify(eas, null, 2)}\n`);

const sourceFiles = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) sourceFiles.push(full);
  }
}
collect(path.join(workRoot, 'app'));
for (const dir of ['components', 'constants', 'context', 'hooks', 'lib']) {
  const full = path.join(workRoot, dir);
  if (fs.existsSync(full)) collect(full);
}
sourceFiles.push(appPath, packagePath, easPath);
const combined = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const forbidden = [
  'https://replit.com/',
  'colorjet-management-suite.replit.app',
  'First Owner Setup',
  '/deliveries/new • /api/deliveries',
  '/admin/push-notifications/new • /notifications/broadcast',
];
for (const value of forbidden) {
  assert(!combined.includes(value), `Forbidden generic/Replit content remains: ${value}`);
}

const dashboard = fs.readFileSync(path.join(workRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const login = fs.readFileSync(path.join(workRoot, 'app', 'login.tsx'), 'utf8');
const colors = fs.readFileSync(path.join(workRoot, 'constants', 'colors.ts'), 'utf8');
for (const value of ['Good morning', 'Sales MTD', 'Open Service Tickets', 'Service Control']) {
  assert(dashboard.includes(value), `Reference dashboard marker missing: ${value}`);
}
for (const value of ['COLORJET', 'Business Management System', 'Sign In']) {
  assert(login.includes(value), `Reference login marker missing: ${value}`);
}
for (const value of ['#1A237E', '#F57C00', '#F0F2F5', '#FFFFFF', '#1C1C1E']) {
  assert(colors.includes(value), `Reference color missing: ${value}`);
}

assert(fs.existsSync(path.join(workRoot, 'assets', 'images', 'icon.png')), 'Original icon.png is missing.');
assert(fs.existsSync(path.join(workRoot, 'assets', 'images', 'splash.png')), 'Original splash.png is missing.');

console.log(`Prepared authoritative COLORJET reference UI ${appVersion} (${androidVersionCode}).`);
console.log('Package: com.colorjetbd.managementsuite');
console.log('Replit/generic module shell validation: PASS');
