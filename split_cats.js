const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const inputPath = '/Users/simbosung/Downloads/파일이름.png';
const outDir = path.join(__dirname, 'public', 'emotions');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function processImage() {
  try {
    console.log('Loading image...');
    const img = await Jimp.read(inputPath);
    
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const h1 = Math.floor(h / 3);
    
    const cats = [
      { name: 'angry.png', y: 0, height: h1 },
      { name: 'sad.png', y: h1, height: h1 },
      { name: 'happy.png', y: h1 * 2, height: h - (h1 * 2) }
    ];
    
    for (const cat of cats) {
      console.log(`Processing ${cat.name}...`);
      const catImg = img.clone().crop(0, cat.y, w, cat.height);
      
      // BFS flood fill from edges to make near-white background transparent
      const visited = new Set();
      const queue = [];
      
      // Add edges
      for (let x = 0; x < w; x++) {
        queue.push({x, y: 0});
        queue.push({x, y: cat.height - 1});
      }
      for (let y = 0; y < cat.height; y++) {
        queue.push({x: 0, y});
        queue.push({x: w - 1, y});
      }
      
      function isBg(color) {
        const rgba = Jimp.intToRGBA(color);
        return rgba.r > 240 && rgba.g > 240 && rgba.b > 240 && rgba.a > 0;
      }
      
      const bgPixels = [];
      let idx = 0;
      
      while (idx < queue.length) {
        const {x, y} = queue[idx++];
        if (x < 0 || x >= w || y < 0 || y >= cat.height) continue;
        
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        const color = catImg.getPixelColor(x, y);
        if (isBg(color)) {
          bgPixels.push({x, y});
          queue.push({x: x+1, y});
          queue.push({x: x-1, y});
          queue.push({x, y: y+1});
          queue.push({x, y: y-1});
        }
      }
      
      console.log(`Found ${bgPixels.length} background pixels for ${cat.name}`);
      for (const p of bgPixels) {
        catImg.setPixelColor(0x00000000, p.x, p.y);
      }
      
      catImg.autocrop();
      
      const outPath = path.join(outDir, cat.name);
      await catImg.writeAsync(outPath);
      console.log(`Saved ${outPath}`);
    }
    
    console.log('All done!');
    
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

processImage();
