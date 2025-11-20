#!/usr/bin/env python3
"""
Simple script to generate extension icons.
Requires PIL/Pillow: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow is required. Install it with: pip install Pillow")
    exit(1)

def create_icon(size, filename):
    # Create image with green background
    img = Image.new('RGB', (size, size), color='#4CAF50')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple map pin icon
    # Draw circle for pin head
    pin_size = size // 3
    pin_x = size // 2
    pin_y = size // 2 - pin_size // 4
    
    # Draw pin circle
    draw.ellipse(
        [pin_x - pin_size//2, pin_y - pin_size//2, 
         pin_x + pin_size//2, pin_y + pin_size//2],
        fill='white'
    )
    
    # Draw pin point (triangle)
    point_size = pin_size // 2
    triangle_points = [
        (pin_x, pin_y + pin_size//2),
        (pin_x - point_size//2, pin_y + pin_size//2 + point_size),
        (pin_x + point_size//2, pin_y + pin_size//2 + point_size)
    ]
    draw.polygon(triangle_points, fill='white')
    
    # Save
    img.save(filename)
    print(f"Created {filename} ({size}x{size})")

if __name__ == '__main__':
    import os
    os.makedirs('icons', exist_ok=True)
    
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')
    
    print("\nIcons generated successfully!")

