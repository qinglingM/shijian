import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconDir = 'D:\\桌面\\shijian\\web\\ios\\App\\App\\Assets.xcassets\\AppIcon.appiconset';
const iconFiles = [
  'AppIcon-20@1x.png', 'AppIcon-20@2x.png', 'AppIcon-20@3x.png',
  'AppIcon-29@1x.png', 'AppIcon-29@2x.png', 'AppIcon-29@3x.png',
  'AppIcon-40@1x.png', 'AppIcon-40@2x.png', 'AppIcon-40@3x.png',
  'AppIcon-60@2x.png', 'AppIcon-60@3x.png',
  'AppIcon-76@1x.png', 'AppIcon-76@2x.png',
  'AppIcon-83.5@2x.png',
  'AppIcon-512@2x.png'
];

async function convertToRGB() {
  console.log('Starting PNG RGBA to RGB conversion using sharp...');

  for (const filename of iconFiles) {
    const filePath = path.join(iconDir, filename);
    console.log(`Processing ${filename}...`);

    try {
      await sharp(filePath)
        .toFormat('png', { compressionLevel: 9 })
        .toFile(filePath);
      console.log(`  -> Converted ${filename} to RGB`);
    } catch (err) {
      console.error(`  -> Error processing ${filename}:`, err.message);
    }
  }

  console.log('Conversion complete!');
}

convertToRGB();
