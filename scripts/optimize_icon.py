
import os
import sys
try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def optimize_icon(input_path, output_path):
    print(f"Processing {input_path} -> {output_path}")
    img = Image.open(input_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 1. Background detection and removal (Trim)
    bg = Image.new(img.mode, img.size, img.getpixel((0,0)))
    diff = Image.frombytes(img.mode, img.size, img.tobytes()) # copy

    # If background is white-ish, treat as transparent for cropping
    from PIL import ImageChops
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()

    if bbox:
        img_cropped = img.crop(bbox)
        print(f"Original size: {img.size}, Cropped content size: {img_cropped.size}, BBox: {bbox}")
    else:
        # Fallback: maybe transparent background?
        bbox = img.getbbox()
        if bbox:
             img_cropped = img.crop(bbox)
             print(f"Transparent crop - Size: {img_cropped.size}")
        else:
             print("Image is empty!")
             return

    # 2. Create a new 1024x1024 transparent canvas
    canvas_size = (1024, 1024)
    canvas = Image.new('RGBA', canvas_size, (255, 255, 255, 0)) # Transparent background

    # 3. Resize content to fit 1024x1024 (maximize)
    # Get aspect ratio
    width, height = img_cropped.size
    aspect = width / height

    if width > height:
        # Fit to width
        new_width = 1024
        new_height = int(1024 / aspect)
    else:
        # Fit to height
        new_height = 1024
        new_width = int(1024 * aspect)

    # Resize with high quality
    img_resized = img_cropped.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # 4. Paste centered
    x = (1024 - new_width) // 2
    y = (1024 - new_height) // 2
    canvas.paste(img_resized, (x, y), img_resized) # Use alpha mask

    # Save
    canvas.save(output_path, 'PNG')
    print("Saved optimized icon.")

if __name__ == "__main__":
    # Source
    src = "wedive-web/public/images/logo.png"

    # Targets
    targets = [
        "wedive-web/public/favicon.png",
        "wedive-app/assets/icon.png",
        "wedive-app/assets/splash.png"
    ]

    for target in targets:
        optimize_icon(src, target)
