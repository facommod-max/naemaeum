const sharp = require('sharp');
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
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const h1 = Math.floor(h / 3);
    
    // We process the full image array to make background transparent
    // BFS flood fill
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h * 2);
    let head = 0;
    let tail = 0;
    
    for(let x=0; x<w; x++){
      queue[tail++] = x; queue[tail++] = 0;
      queue[tail++] = x; queue[tail++] = h-1;
    }
    for(let y=0; y<h; y++){
      queue[tail++] = 0; queue[tail++] = y;
      queue[tail++] = w-1; queue[tail++] = y;
    }
    
    function isBg(idx) {
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      return r >= 240 && g >= 240 && b >= 240;
    }
    
    while(head < tail) {
      const x = queue[head++];
      const y = queue[head++];
      
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      
      const pIdx = y * w + x;
      if (visited[pIdx]) continue;
      visited[pIdx] = 1;
      
      const idx = pIdx * 4;
      if (isBg(idx)) {
        data[idx] = 255;
        data[idx+1] = 255;
        data[idx+2] = 255;
        data[idx+3] = 0; // transparent
        
        queue[tail++] = x+1; queue[tail++] = y;
        queue[tail++] = x-1; queue[tail++] = y;
        queue[tail++] = x; queue[tail++] = y+1;
        queue[tail++] = x; queue[tail++] = y-1;
      }
    }
    
    // Now split and save
    const cats = [
      { name: 'angry.png', y: 0, height: h1 },
      { name: 'sad.png', y: h1, height: h1 },
      { name: 'happy.png', y: h1 * 2, height: h - (h1 * 2) }
    ];
    
    for (const cat of cats) {
      const outPath = path.join(outDir, cat.name);
      await sharp(data, {
        raw: { width: w, height: h, channels: 4 }
      })
      .extract({ left: 0, top: cat.y, width: w, height: cat.height })
      .trim()
      .toFile(outPath);
      
      console.log(`Saved ${outPath}`);
    }
    console.log('All done!');
  } catch(e) {
    console.error(e);
  }
}
processImage();
