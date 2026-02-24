import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SVG_PATH = 'public/favicon.svg';
const ANDROID_RES = 'android/app/src/main/res';

// Android adaptive icon sizes
const sizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

// Notification icon sizes (monochrome white)
const notifSizes = [
  { name: 'drawable-mdpi', size: 24 },
  { name: 'drawable-hdpi', size: 36 },
  { name: 'drawable-xhdpi', size: 48 },
  { name: 'drawable-xxhdpi', size: 72 },
  { name: 'drawable-xxxhdpi', size: 96 },
];

// Play Store icon
const PLAY_STORE_SIZE = 512;

async function generate() {
  console.log('Generating Android icons from', SVG_PATH);

  // App launcher icons
  for (const { name, size } of sizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher.png'));

    // Round variant
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));

    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Foreground layer for adaptive icons (108dp with 18dp safe zone = actual icon is 66dp centered in 108dp)
  const adaptiveSizes = [
    { name: 'mipmap-mdpi', size: 108 },
    { name: 'mipmap-hdpi', size: 162 },
    { name: 'mipmap-xhdpi', size: 216 },
    { name: 'mipmap-xxhdpi', size: 324 },
    { name: 'mipmap-xxxhdpi', size: 432 },
  ];

  for (const { name, size } of adaptiveSizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Create foreground with padding for adaptive icon safe zone
    const iconSize = Math.round(size * 0.6); // Icon is ~60% of the canvas
    const padding = Math.round((size - iconSize) / 2);

    await sharp(SVG_PATH)
      .resize(iconSize, iconSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .resize(size, size) // Ensure exact size after extend rounding
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`  ✓ ${name} adaptive foreground (${size}x${size})`);
  }

  // Notification icons (should be simple, single-colour silhouette)
  // Using a simplified white version — you may want to create a dedicated notification SVG
  for (const { name, size } of notifSizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_stat_notification.png'));

    console.log(`  ✓ ${name} notification (${size}x${size})`);
  }

  // Play Store listing icon (512x512)
  await sharp(SVG_PATH)
    .resize(PLAY_STORE_SIZE, PLAY_STORE_SIZE)
    .png()
    .toFile('play-store-icon.png');

  console.log(`  ✓ Play Store icon (${PLAY_STORE_SIZE}x${PLAY_STORE_SIZE})`);

  console.log('\n✅ All icons generated successfully!');
}

generate().catch(console.error);
