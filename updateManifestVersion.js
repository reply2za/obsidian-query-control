const fs = require('fs');

// Read the new version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const newVersion = packageJson.version;

// Read and update manifest.json
const manifestPath = 'manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.version = newVersion;

// Write the updated manifest.json back to file
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Updated manifest.json to version ${newVersion}`);
