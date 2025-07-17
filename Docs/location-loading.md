---
title: Location Loading Process
author: @system
last_updated: 2025-01-17
scope: feature
aliases: ["location-loading", "folder-scanning", "location-initialization"]
---

# Location Loading Process

This document explains every step involved when a user selects a new folder location in OneFolder, from the initial folder dialog to the completion of loading with all files indexed and ready for use.

## Overview

Location loading is a multi-phase process that involves:

1. **User Selection** - Folder dialog and validation
2. **Location Creation** - Creating database records
3. **Folder Scanning** - Recursive file discovery
4. **File Processing** - Metadata extraction and database storage
5. **Thumbnail Preparation** - Setting up thumbnail paths
6. **UI Updates** - Refreshing views and counts
7. **Optional Tag Import** - Reading existing EXIF metadata

---

## Phase 1: User Selection & Validation

### Entry Points

- **Main**: `LocationsPanel.handleChooseWatchedDir()` - Primary "Add Location" button
- **Recovery**: `LocationRecoveryDialog.handleLocate()` - When recovering missing locations

### Folder Selection Process

```typescript
// User clicks "Add Location" button
const { filePaths } = await RendererMessenger.showOpenDialog({
  properties: ['openDirectory'],
});
const selectedPath = filePaths[0];
```

### Validation Checks

Before proceeding, OneFolder validates the selected folder:

1. **Duplicate Check**: Ensures folder isn't already added as a location
2. **Parent-Child Conflicts**:
   - Cannot add a sub-folder of an existing location
   - Cannot add a parent folder of existing locations
3. **Path Accessibility**: Verifies the folder exists and is readable

### Error Handling

- Shows toast notifications for validation failures
- Prevents creation of problematic location hierarchies
- Provides clear user feedback on why a folder can't be added

---

## Phase 2: Location Creation

### Database Record Creation

```typescript
// LocationStore.create()
const newLocation = new ClientLocation(
  store,
  generateId(),
  selectedPath,
  new Date(), // dateAdded
  [], // subLocations (discovered later)
  enabledExtensions,
  locationIndex,
);
```

### Location Properties

- **ID**: Unique identifier for database relations
- **Path**: Absolute path to the watched folder
- **Date Added**: Timestamp of when location was created
- **Sub-locations**: Directory tree (populated during scanning)
- **Enabled Extensions**: File types to watch (jpg, png, etc.)
- **Index**: Display order in locations panel

---

## Phase 3: Folder Scanning

### Worker Initialization

The heavy lifting is done by the `FolderWatcherWorker` using the Chokidar library:

```typescript
// ClientLocation.watch()
const worker = new Worker('src/frontend/workers/folderWatcher.worker');
const WorkerFactory = wrap<typeof FolderWatcherWorker>(worker);
this.worker = await new WorkerFactory();
```

### File Discovery Process

1. **Recursive Scanning**: Chokidar traverses all subdirectories
2. **Extension Filtering**: Only includes supported image/video formats
3. **Exclusion Rules**:
   - Ignores dotfiles and hidden folders
   - Respects user-excluded subdirectories
   - Configurable depth limits

### File Statistics Collection

For each discovered file, the worker extracts:

```typescript
const fileStats: FileStats = {
  absolutePath: path,
  dateCreated: stats.birthtime,
  dateModified: stats.mtime,
  size: Number(stats.size),
  ino: stats.ino.toString(), // Unique file system identifier
};
```

### Progress Feedback

- Shows "Finding all images..." toast with cancel option
- Updates progress as directories are scanned
- User can cancel during this phase

---

## Phase 4: File Processing & Metadata Extraction

### Parallel Processing

Files are processed in batches with controlled concurrency:

```typescript
// LocationStore.initLocation()
const N = 50; // Configurable batch size
const files = await promiseAllLimit(
  filePaths.map((path) => () => pathToIFile(path, location, imageLoader)),
  N,
  showProgressToaster,
  () => isCancelled,
);
```

### File Metadata Extraction (`pathToIFile`)

Each file undergoes metadata extraction:

1. **Basic Information**:

   - File name and extension
   - File size and creation date
   - Relative path within location

2. **Image Resolution**:

   - Uses `ImageLoader.getImageResolution()`
   - Extracts width/height from image headers
   - Different methods for different file formats

3. **Database Record Creation**:
   ```typescript
   const fileDTO: FileDTO = {
     id: generateId(),
     ino: stats.ino,
     locationId: location.id,
     absolutePath: stats.absolutePath,
     relativePath: stats.absolutePath.replace(location.path, ''),
     tags: [],
     dateAdded: new Date(),
     dateModified: new Date(),
     dateLastIndexed: new Date(),
     annotations: '{}',
     // ... metadata from getMetaData()
   };
   ```

### Format-Specific Handling

Different file types require different processing approaches:

- **Web formats** (jpg, png, webp): Direct browser support
- **RAW formats** (tif, exr): Custom decoders via WebAssembly
- **Specialized formats** (psd, kra, heic): Dedicated workers
- **Videos** (mp4, mov): Basic metadata extraction

---

## Phase 5: Database Storage

### Bulk Operations

Files are inserted efficiently using bulk operations:

```typescript
// Backend.createFilesFromPath()
await this.#db.transaction('rw', this.#files, async () => {
  // Check for existing files to avoid duplicates
  const existingFilePaths = new Set(
    await this.#files.where('absolutePath').startsWith(path).keys(),
  );

  // Filter out duplicates and insert new files
  retainArray(files, (file) => !existingFilePaths.has(file.absolutePath));
  await this.#files.bulkAdd(files);
});
```

### Duplicate Prevention

- Checks existing file paths before insertion
- Uses absolute paths as unique keys
- Handles edge cases like symlinks and moved files

---

## Phase 6: Thumbnail Path Initialization

### Thumbnail Path Setup

During file creation, thumbnail paths are pre-calculated:

```typescript
// FileStore.filesFromBackend()
file.thumbnailPath = imageLoader.needsThumbnail(fileDTO)
  ? getThumbnailPath(fileDTO.absolutePath, thumbnailDirectory)
  : fileDTO.absolutePath;
```

### Thumbnail Strategy

- **Small images**: Use original file directly
- **Large images**: Generate scaled thumbnails
- **Special formats**: Extract embedded thumbnails or use decoders
- **Videos**: Currently use original file (thumbnails planned)

> **Note**: Actual thumbnail generation happens lazily when images are first viewed. See [Thumbnail Generation](thumbnail-generation.md) for detailed process.

---

## Phase 7: UI Updates & Completion

### Store Refreshes

After successful database insertion:

```typescript
// LocationStore.initLocation()
await this.rootStore.fileStore.refetch();
await this.rootStore.fileStore.refetchFileCounts();
```

### User Feedback

- Shows "Location ready!" success toast
- Updates file counts in navigation
- Location appears in locations panel
- Files become visible in gallery view

### Background Tasks

- Continues watching for file system changes
- Queues thumbnail generation for lazy loading
- Updates UI reactively as thumbnails are generated

---

## Phase 8: Optional Tag Import

### EXIF Tag Reading

If enabled in preferences (`importMetadataAtLocationLoading`):

```typescript
// FileStore.readTagsFromFiles()
for (const file of fileList) {
  const tagHierarchies = await exifTool.readTags(file.absolutePath);
  // Create/match tags and assign to files
}
```

### Tag Processing

1. **Read Metadata**: Extracts HierarchicalSubject, Subject, Keywords
2. **Tag Matching**: Finds existing tags or creates new ones
3. **Hierarchy Building**: Respects tag parent-child relationships
4. **File Assignment**: Associates tags with files

---

## Error Handling & Recovery

### Common Issues

- **Missing Directories**: Shows recovery dialog for broken locations
- **Permission Errors**: Graceful fallback with user notification
- **Corrupted Files**: Skips problematic files with logging
- **Network Drives**: Special handling for disconnected mounts

### Recovery Mechanisms

- **Location Recovery Dialog**: Helps relocate moved folders
- **File Matching**: Uses `ino` field to detect renamed/moved files
- **Graceful Degradation**: Continues processing even with partial failures

### User Controls

- **Cancel Button**: Stops processing at any phase
- **Retry Options**: For temporary failures
- **Skip Problematic Files**: Continues with remaining files

---

## Performance Considerations

### Concurrency Limits

- **File Processing**: 50 files processed simultaneously
- **Thumbnail Workers**: 4 parallel thumbnail generators
- **Database Operations**: Bulk inserts for efficiency

### Memory Management

- **Worker Isolation**: Heavy processing in separate threads
- **Streaming Processing**: Files processed in batches, not all at once
- **Cache Management**: Limited caches with cleanup

### System Resource Usage

- **Disk I/O**: Optimized file reading patterns
- **CPU Usage**: Work distributed across cores via workers
- **Memory**: Controlled through batch processing

---

## File System Watching

### Ongoing Monitoring

After initial load, the location continues watching for changes:

- **New Files**: Automatically detected and processed
- **Deleted Files**: Marked as broken, can be cleaned up
- **Renamed Files**: Detected via `ino` matching
- **Modified Files**: Thumbnails regenerated if needed

### Change Detection

```typescript
// FolderWatcherWorker event handling
worker.onmessage = ({ data }) => {
  if (data.type === 'add') {
    // Process new file
    this.store.addFile(data.value, this);
  } else if (data.type === 'remove') {
    // Mark file as missing
    this.store.hideFile(data.value);
  }
};
```

---

## Related Documentation

- [Thumbnail Generation](thumbnail-generation.md) - Detailed thumbnail creation process
- [File Metadata](metadata-extraction.md) - EXIF and image metadata handling
- [File System Watching](file-watching.md) - Ongoing change detection

---

## Key Files & Components

### Core Classes

- `LocationStore` - Orchestrates the entire process
- `ClientLocation` - Represents a watched folder
- `FolderWatcherWorker` - Handles file system scanning

### Supporting Systems

- `ImageLoader` - Metadata extraction and format handling
- `ExifIO` - EXIF metadata reading/writing
- `Backend` - Database operations

### UI Components

- `LocationsPanel` - Location management interface
- `LocationRecoveryDialog` - Handles missing locations
- Various toast notifications for user feedback
