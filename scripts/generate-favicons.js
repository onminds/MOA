const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function generate() {
  const projectRoot = path.join(__dirname, '..');
  const sourcePng = path.join(projectRoot, 'public', 'images', 'Moa_Logo.png');

  const outputs = [
    { size: 16,  out: path.join(projectRoot, 'public', 'favicon-16x16.png') },
    { size: 32,  out: path.join(projectRoot, 'public', 'favicon-32x32.png') },
    { size: 180, out: path.join(projectRoot, 'public', 'apple-touch-icon.png') },
    // Next.js App Router automatic icon files
    { size: 32,  out: path.join(projectRoot, 'src', 'app', 'icon.png') },
    { size: 180, out: path.join(projectRoot, 'src', 'app', 'apple-icon.png') },
  ];

  for (const { size, out } of outputs) {
    await ensureDir(path.dirname(out));
    await sharp(sourcePng)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out);
  }

  console.log('Favicons generated:', outputs.map(o => path.relative(projectRoot, o.out)));
}

generate().catch(err => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
}); 