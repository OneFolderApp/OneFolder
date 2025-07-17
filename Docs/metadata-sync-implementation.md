---
title: Metadata Sync Implementation Plan
author: @system
last_updated: 2025-01-17
scope: feature
aliases: ["metadata-sync", "immediate-sync", "tag-sync"]
---

# Metadata Sync Implementation Plan

This document outlines the implementation of immediate metadata synchronization between OneFolder's database and image file metadata, replacing the current manual export workflow.

## Overview

**Goal**: Keep OneFolder's database and image metadata in perfect sync by writing changes immediately when users modify tags, while maintaining smooth UX.

**Strategy**: ✅ **IMPLEMENTED** - Immediate sync with error handling works perfectly.

**Status**: Phase 1 complete and tested with 50+ files - feels instant and reliable.

---

## Current State Analysis

### What's Currently Disabled

```typescript
// In src/frontend/entities/File.ts - ClientFile.addTag()
// this.exifTool.writeTags(this.absolutePath, tagHierarchy); // ⭐ COMMENTED OUT!
```

### Why It Was Disabled

1. **Performance**: Individual writes seemed slower than batch operations
2. **UX Concerns**: Fear of blocking user interactions
3. **Error Handling**: No graceful failure recovery

---

## ✅ **Current Implementation (Phase 1)**

### **Immediate Sync**

- **Immediate UI Update**: Tags appear instantly in OneFolder ✅
- **Immediate File Write**: Metadata written immediately to file ✅
- **Performance**: Tested with 50+ rapid changes - feels instant ✅

### **Error Handling**

- **Silent Success**: No notification when writes succeed ✅
- **Visible Failures**: Toast notification with retry option ✅
- **Graceful Degradation**: App continues working even if file writes fail ✅

### **Bug Fixes Applied**

- **Clear Tags Fix**: Removing all tags now properly clears file metadata ✅

### **User Experience**

- ✅ **Success**: Silent background sync, no interruptions
- ❌ **Failures**: Toast notifications like "Failed to sync tags for IMG_001.jpg [Retry]"

---

## ✅ **Completed Implementation**

### Phase 1: Immediate Sync ✅

1. ✅ Uncommented `writeTags()` calls in `File.ts`
2. ✅ Added error handling with toast notifications and retry
3. ✅ Fixed clear tags bug in `ExifIO.ts`
4. ✅ Tested with 50+ files - works perfectly and feels instant

## 🚀 **Future Enhancements (Optional)**

### Advanced Features

- **Debouncing**: Add if performance issues arise with larger collections
- **User Preferences**: Enable/disable sync toggle in settings
- **Bulk Operations**: Keep batch processing for tag renames affecting many files

---

## Implementation Details

### Files Modified

- **`src/frontend/entities/File.ts`**: Added immediate sync to `addTag()`/`removeTag()` with error handling
- **`common/ExifIO.ts`**: Fixed clear tags bug - now properly clears metadata when no tags remain

### Key Features

- **Error Handling**: Toast notifications with retry for failed writes
- **Performance**: No debouncing needed - immediate writes work perfectly
- **Reliability**: App continues working even if file writes fail
