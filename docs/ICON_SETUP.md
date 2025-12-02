# Icon Setup Guide

## Required Icon Sizes

Create PNG icons with the following sizes and place them in `dist/assets/`:

| Filename | Size | Usage |
|----------|------|-------|
| icon16.png | 16x16 | Favicon, tab icon |
| icon24.png | 24x24 | Browser action |
| icon32.png | 32x32 | Windows |
| icon48.png | 48x48 | Extensions page |
| icon64.png | 64x64 | High-DPI displays |
| icon128.png | 128x128 | Chrome Web Store |
| icon256.png | 256x256 | High-resolution display |

## Design Recommendations

### Colors
- Primary: #e91e63 (GraphQL Pink)
- Background: White or transparent

### Style
- Simple, recognizable silhouette
- Works well at small sizes
- Consider using the official GraphQL pink color

### Icon Ideas
- GraphQL logo with a mask/overlay
- Theater mask (🎭) styled icon
- GraphQL logo with "mock" indicator

## Quick Placeholder (for development)

You can use a simple placeholder by generating colored squares:

```bash
# Using ImageMagick
for size in 16 24 32 48 64 128 256; do
  convert -size ${size}x${size} xc:#e91e63 dist/assets/icon${size}.png
done
```

## Using Figma or Design Tools

1. Create a 256x256 artboard
2. Design your icon
3. Export at all required sizes
4. Place in `dist/assets/`

## Online Icon Generators

- [favicon.io](https://favicon.io/) - Generate from text/emoji
- [realfavicongenerator.net](https://realfavicongenerator.net/)
- [iconmonstr.com](https://iconmonstr.com/) - Free icons

## Verification

After adding icons, verify they're correctly referenced in `manifest.json`:

```json
{
  "icons": {
    "16": "assets/icon16.png",
    "24": "assets/icon24.png",
    "32": "assets/icon32.png",
    "48": "assets/icon48.png",
    "64": "assets/icon64.png",
    "128": "assets/icon128.png",
    "256": "assets/icon256.png"
  }
}
```

