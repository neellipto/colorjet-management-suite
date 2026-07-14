import fs from 'node:fs';

const sourceAsset = './assets/images/colorjet-original-icon.webp';
const correctedAsset = './assets/images/colorjet-original-icon.png';
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

if (!fs.existsSync(sourceAsset)) {
  throw new Error(`Missing original COLORJET asset: ${sourceAsset}`);
}

const bytes = fs.readFileSync(sourceAsset);
if (!bytes.subarray(0, 8).equals(pngSignature)) {
  throw new Error('Original COLORJET asset content is not PNG. Build stopped without altering it.');
}

fs.copyFileSync(sourceAsset, correctedAsset);

const replaceReference = (value) => {
  if (Array.isArray(value)) return value.map(replaceReference);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = replaceReference(value[key]);
    return value;
  }
  return value === sourceAsset ? correctedAsset : value;
};

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
replaceReference(app);
fs.writeFileSync('app.json', `${JSON.stringify(app, null, 2)}\n`);

console.log('Original COLORJET PNG asset retained; Expo references now use .png extension.');
