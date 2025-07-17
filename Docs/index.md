# OneFolder

OneFolder is a desktop app for viewing and organizing your photos locally while respecting open metadata standards. Unlike cloud-based solutions, your pictures remain as ordinary image files in a single folder you control, with organization data stored directly in EXIF/XMP metadata. This ensures your photo collection stays portable, future-proof, and accessible with any modern viewer—today and decades from now.

---

## Project File Structure (top-level)

```
OneFolder/
├── src/
│   ├── frontend/        # React components and UI logic
│   ├── backend/         # Electron main process and file system operations
│   ├── api/            # Data storage, search, and external API interfaces
│   ├── ipc/            # Inter-process communication between main/renderer
│   └── main.ts         # Electron app entry point
├── resources/          # Static assets (icons, images, themes, exiftool)
├── widgets/            # Reusable UI components and utilities
├── common/             # Shared utilities and configuration
├── wasm/              # WebAssembly modules (masonry layout, EXR decoder)
├── tests/             # Test files and setup
└── package.json       # Dependencies and build scripts
```

**Tech Stack:** Electron + React + MobX + TypeScript, with ExifTool for metadata editing and WebAssembly for performance-critical operations.

---

## Documentation Index

| Doc                                                | Purpose                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| [README.md](README.md)                             | Documentation guidelines and writing standards                       |
| [location-loading.md](location-loading.md)         | Complete process of loading new folders from selection to completion |
| [thumbnail-generation.md](thumbnail-generation.md) | Detailed thumbnail creation system with format-specific processing   |

_More documentation files will be added as features are documented._
