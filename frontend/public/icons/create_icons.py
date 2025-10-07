from PIL import Image, ImageDraw
import os

def create_icon(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw red background with rounded corners
    margin = size * 0.1
    draw.rounded_rectangle(
        [(margin, margin), (size - margin, size - margin)],
        radius=size * 0.15,
        fill=(220, 38, 38, 255)  # #dc2626
    )
    
    # Draw film reel circle
    center = size // 2
    radius = size * 0.3
    circle_width = max(2, size // 50)
    draw.ellipse(
        [(center - radius, center - radius), (center + radius, center + radius)],
        outline=(255, 255, 255, 255),
        width=circle_width
    )
    
    # Draw play button
    play_size = size * 0.15
    play_points = [
        (center - play_size // 2, center - play_size // 2),
        (center - play_size // 2, center + play_size // 2),
        (center + play_size // 2, center)
    ]
    draw.polygon(play_points, fill=(255, 255, 255, 255))
    
    return img

# Create icons for all required sizes
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    icon = create_icon(size)
    filename = f'icon-{size}x{size}.png'
    icon.save(filename, 'PNG')
    print(f'Created {filename}')

print('All icons created successfully!')
