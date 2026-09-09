import sys
import os
from PIL import Image

input_path = '/Users/simbosung/Downloads/파일이름.png'
out_dir = 'public/emotions'

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

try:
    img = Image.open(input_path).convert("RGBA")
except Exception as e:
    print(f"Error opening image: {e}")
    sys.exit(1)

width, height = img.size

# Divide height by 3
h1 = height // 3

cats = [
    img.crop((0, 0, width, h1)),
    img.crop((0, h1, width, h1 * 2)),
    img.crop((0, h1 * 2, width, height))
]

names = ['angry.png', 'sad.png', 'happy.png']

def make_transparent(image):
    pixels = image.load()
    w, h = image.size
    
    # BFS to find all background pixels
    visited = set()
    queue = []
    
    # Add edges
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h-1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w-1, y))
        
    def is_bg(r, g, b, a):
        # Allow slight off-white
        return r > 240 and g > 240 and b > 240 and a > 0
        
    bg_pixels = []
    
    while queue:
        x, y = queue.pop(0)
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if (x, y) in visited:
            continue
        visited.add((x, y))
        
        r, g, b, a = pixels[x, y]
        if is_bg(r, g, b, a):
            bg_pixels.append((x, y))
            queue.append((x+1, y))
            queue.append((x-1, y))
            queue.append((x, y+1))
            queue.append((x, y-1))
            
    for x, y in bg_pixels:
        pixels[x, y] = (255, 255, 255, 0)
        
    # Also crop tight bounds
    return image.crop(image.getbbox())

for i, cat_img in enumerate(cats):
    trans_img = make_transparent(cat_img)
    out_path = os.path.join(out_dir, names[i])
    trans_img.save(out_path)
    print(f"Saved {out_path} - Size: {trans_img.size}")
