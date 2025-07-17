---
title: Thumbnail Generation System
author: @system
last_updated: 2025-01-17
scope: feature
aliases: ["thumbnails", "thumbnail-generation", "image-processing"]
---

# Thumbnail Generation System

OneFolder uses a sophisticated thumbnail generation system that handles multiple image formats through different processing pipelines. This document explains how thumbnails are created, cached, and served throughout the application.

## Overview

The thumbnail system is designed around several key principles:

- **Lazy Generation**: Thumbnails are created only when needed
- **Format-Specific Processing**: Different file types use specialized decoders
- **Worker-Based Processing**: Heavy work is done in background threads
- **Intelligent Caching**: Thumbnails are cached and reused efficiently
- **Performance Optimization**: Multiple workers process thumbnails in parallel

---

## Thumbnail Strategy Decision

### When Thumbnails Are Needed

The `ImageLoader.needsThumbnail()` method determines if a file requires a thumbnail:

```typescript
needsThumbnail(file: FileDTO) {
  // Skip thumbnails for GIFs (preserves animation)
  if (file.extension === 'gif' || isFileExtensionVideo(file.extension)) {
    return false;
  }

  // Generate thumbnail if file exceeds size limits or needs special processing
  return (
    FormatHandlers[file.extension] !== 'web' ||
    file.width > thumbnailMaxSize ||
    file.height > thumbnailMaxSize
  );
}
```

### Thumbnail vs Original File

- **Small web-compatible images**: Use original file directly
- **Large images**: Generate scaled-down thumbnails
- **Special formats**: Process through appropriate decoders
- **Videos/GIFs**: Currently use original (future enhancement planned)

---

## Format Handlers

OneFolder categorizes files into different handler types based on their format:

### Web-Compatible Formats (`'web'`)

**Extensions**: jpg, jpeg, png, webp, bmp, svg  
**Processing**: Uses `thumbnailGenerator.worker.ts` with Canvas API

```typescript
case 'web':
  await generateThumbnailUsingWorker(file, thumbnailPath);
  updateThumbnailPath(file, thumbnailPath);
  break;
```

### TIF Files (`'tifLoader'`)

**Extensions**: tif, tiff  
**Processing**: Uses WebAssembly decoder for TIF format support

```typescript
case 'tifLoader':
  await generateThumbnail(this.tifLoader, absolutePath, thumbnailPath, thumbnailMaxSize);
  updateThumbnailPath(file, thumbnailPath);
  break;
```

### EXR Files (`'exrLoader'`)

**Extensions**: exr  
**Processing**: Uses WebAssembly decoder for high dynamic range images

```typescript
case 'exrLoader':
  await generateThumbnail(this.exrLoader, absolutePath, thumbnailPath, thumbnailMaxSize);
  updateThumbnailPath(file, thumbnailPath);
  break;
```

### PSD Files (`'psdLoader'`)

**Extensions**: psd  
**Processing**: Uses `ag-psd` library via `psdReader.worker.ts`

```typescript
case 'psdLoader':
  await generateThumbnail(this.psdLoader, absolutePath, thumbnailPath, thumbnailMaxSize);
  updateThumbnailPath(file, thumbnailPath);
  break;
```

### HEIC Files (`'heicLoader'`)

**Extensions**: heic, heif  
**Processing**: Uses `libheif-js` library via `heicReader.worker.ts`

```typescript
case 'heicLoader':
  await generateThumbnail(this.heicLoader, absolutePath, thumbnailPath, thumbnailMaxSize);
  updateThumbnailPath(file, thumbnailPath);
  break;
```

### Embedded Thumbnail Extraction (`'extractEmbeddedThumbnailOnly'`)

**Extensions**: kra, and some raw formats  
**Processing**: Extracts existing embedded thumbnails

```typescript
case 'extractEmbeddedThumbnailOnly':
  let success = false;
  if (extension === 'kra') {
    success = await this.extractKritaThumbnail(absolutePath, thumbnailPath);
  } else {
    success = await this.exifIO.extractThumbnail(absolutePath, thumbnailPath);
  }
  if (!success) {
    throw new Error('Could not generate or extract thumbnail');
  }
  break;
```

### No Thumbnail Support (`'none'`)

**Extensions**: Some specialized formats  
**Processing**: Uses original file path directly

```typescript
case 'none':
  file.setThumbnailPath(file.absolutePath);
  break;
```

---

## Thumbnail Generation Workers

### Web Format Worker (`thumbnailGenerator.worker.ts`)

**Purpose**: Handles standard web-compatible image formats  
**Technology**: Canvas API with OffscreenCanvas  
**Concurrency**: 4 parallel workers

#### Process Flow:

1. **File Reading**: Loads image file as buffer
2. **Image Decoding**: Creates ImageBitmap from buffer
3. **Scaling Calculation**: Maintains aspect ratio while fitting within size limits
4. **Canvas Rendering**: Draws scaled image on OffscreenCanvas
5. **Compression**: Converts to JPEG/WebP with quality optimization
6. **File Writing**: Saves thumbnail to disk

```typescript
// Key scaling logic
if (img.width >= img.height) {
  width = thumbnailMaxSize;
  height = (thumbnailMaxSize * img.height) / img.width;
} else {
  height = thumbnailMaxSize;
  width = (thumbnailMaxSize * img.width) / img.height;
}
```

#### Queue Management:

- **Maximum Parallel Jobs**: 4 simultaneous thumbnails
- **Queue System**: Processes requests in order when workers are busy
- **Error Handling**: Falls back to original file on failure

### PSD Worker (`psdReader.worker.ts`)

**Purpose**: Processes Adobe Photoshop files  
**Technology**: `ag-psd` library  
**Features**: Reads composite image without layer data

```typescript
// PSD processing configuration
const psd = readPsd(data, {
  skipLayerImageData: true,
  skipThumbnail: true,
  useImageData: true,
});
```

### HEIC Worker (`heicReader.worker.ts`)

**Purpose**: Processes Apple HEIC/HEIF files  
**Technology**: `libheif-js` library  
**Features**: Decodes modern image format to ImageData

---

## Thumbnail Path Generation

### Path Construction

Thumbnails are stored with predictable paths:

```typescript
function getThumbnailPath(filePath: string, thumbnailDirectory: string): string {
  const baseFilename = path.basename(filePath, path.extname(filePath));
  const hash = hashString(filePath); // Prevents name collisions
  return path.join(thumbnailDirectory, `${baseFilename}-${hash}.${thumbnailFormat}`);
}
```

### Path Components:

- **Base filename**: Original name without extension
- **Hash suffix**: Prevents conflicts between files with same name
- **Thumbnail directory**: Centralized storage location
- **Format extension**: Typically JPEG for compressed thumbnails

---

## Lazy Loading & Caching

### Lazy Generation Trigger

Thumbnails are generated when `ImageLoader.ensureThumbnail()` is called:

```typescript
async ensureThumbnail(file: ClientFile): Promise<boolean> {
  // Check if thumbnail already exists
  if (await fse.pathExists(thumbnailPath)) {
    const fileStats = await fse.stat(absolutePath);
    const thumbStats = await fse.stat(thumbnailPath);
    if (fileStats.mtime < thumbStats.ctime) {
      return false; // Thumbnail is up-to-date
    }
  }

  // Generate new thumbnail
  // ... format-specific processing
  return true; // Thumbnail was generated
}
```

### Cache Validation

The system checks if existing thumbnails are still valid:

- **Timestamp Comparison**: File modification time vs thumbnail creation time
- **Automatic Regeneration**: Outdated thumbnails are recreated
- **Size Change Detection**: Thumbnails are regenerated if file size changes

### Memory Caching

For non-web formats, decoded images are cached in memory:

```typescript
// ImageLoader source caching
const src = this.srcBufferCache.get(file) ?? (await getBlob(this.tifLoader, file.absolutePath));
this.updateCache(file, src);
```

---

## Performance Optimizations

### Concurrency Control

```typescript
// Controlled parallel processing
const NUM_THUMBNAIL_WORKERS = 4;
const workers: Worker[] = [];
for (let i = 0; i < NUM_THUMBNAIL_WORKERS; i++) {
  workers[i] = new Worker(/* ... */);
}
```

### Quality Optimization

```typescript
// Dynamic quality based on thumbnail size
const quality = computeQuality(sampledCanvas, thumbnailSize);
const blobBuffer = await canvas.toBlob(
  (blob) => resolve(blob.arrayBuffer()),
  `image/${thumbnailFormat}`,
  quality,
);
```

### Resource Management

- **Worker Pooling**: Reuses worker instances across requests
- **Memory Limits**: Controlled batch processing prevents memory exhaustion
- **Cleanup**: Automatic cache eviction and temporary file cleanup

---

## Error Handling & Fallbacks

### Graceful Degradation

When thumbnail generation fails:

1. **Log Error**: Detailed error information for debugging
2. **Fallback Strategy**: Use original file path as thumbnail
3. **User Notification**: Optionally inform user of processing issues
4. **Retry Logic**: Some operations can be retried

### Common Error Scenarios

- **Corrupted Files**: Cannot decode image data
- **Permission Issues**: Cannot write to thumbnail directory
- **Format Limitations**: Unsupported image variants
- **Resource Exhaustion**: Out of memory or disk space

### Error Recovery

```typescript
catch (err) {
  console.error('Could not generate image thumbnail', data.filePath, err);
  // Fallback to original file
  ctx.postMessage({ fileId, thumbnailPath: filePath });
}
```

---

## Thumbnail Lifecycle

### 1. Path Initialization

During location loading, thumbnail paths are pre-calculated but files aren't generated yet.

### 2. Lazy Generation

When a file is first displayed:

- Check if thumbnail exists and is current
- Generate if needed through appropriate handler
- Update UI reactively when complete

### 3. Cache Management

- **Disk Storage**: Thumbnails persist between app sessions
- **Memory Cache**: Decoded data cached for quick access
- **Cleanup**: Old/unused thumbnails can be cleaned up

### 4. Invalidation

Thumbnails are regenerated when:

- Original file is modified
- File is moved/renamed
- User changes thumbnail quality settings
- Corruption is detected

---

## Configuration Options

### Thumbnail Settings

```typescript
// Configuration constants
const thumbnailMaxSize = 512; // Maximum dimension in pixels
const thumbnailFormat = 'jpg'; // Output format
const NUM_THUMBNAIL_WORKERS = 4; // Parallel workers
```

### Quality Settings

- **Compression Level**: Balances file size vs quality
- **Format Choice**: JPEG for photos, PNG for graphics
- **Size Limits**: Configurable maximum dimensions

---

## Future Enhancements

### Planned Improvements

- **Video Thumbnails**: Extract frames from video files
- **Progressive Loading**: Show low-quality previews first
- **Smart Caching**: ML-based cache eviction
- **Format Expansion**: Support for more specialized formats

### Performance Opportunities

- **GPU Acceleration**: WebGL-based image processing
- **Incremental Updates**: Only regenerate changed portions
- **Predictive Generation**: Pre-generate likely-needed thumbnails

---

## Related Documentation

- [Location Loading](location-loading.md) - How thumbnails fit into initial scanning
- [Image Loader System](image-loader.md) - Format-specific processing details
- [Worker Architecture](workers.md) - Background processing patterns

---

## Key Files & Components

### Core Components

- `ImageLoader.ts` - Main orchestration and format routing
- `thumbnailGenerator.worker.ts` - Web format processing
- `ThumbnailGeneration.tsx` - Worker management and queuing

### Format-Specific Workers

- `psdReader.worker.ts` - Adobe Photoshop files
- `heicReader.worker.ts` - Apple HEIC format
- Various WASM decoders for TIF, EXR formats

### Supporting Files

- `util.ts` - Image processing utilities
- `common/fs.ts` - Path generation and file utilities
- `common/config.ts` - Configuration constants
