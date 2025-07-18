---
title: Metadata Sync Implementation Plan
author: @system
last_updated: 2025-01-18
scope: feature
aliases: ["metadata-sync", "immediate-sync", "tag-sync"]
---

# Metadata Sync Implementation Plan

This document outlines the implementation of immediate metadata synchronization between OneFolder's database and image file metadata, replacing the current manual export workflow.

## Overview

**Goal**: Keep OneFolder's database and image metadata in perfect sync by writing changes immediately when users modify tags, while maintaining smooth UX.

**Strategy**: ✅ **IMPLEMENTED** - Immediate sync with debouncing and error handling works perfectly.

**Status**: Phase 1 complete with performance optimizations - tested and optimized for large libraries.

---

## 🚨 **Performance Issue & Resolution (v1.0.24 → v1.0.25)**

### **Issue Identified**

- **Symptoms**: High CPU usage (50%), high RAM (1GB), very slow sync (5-10 mins → 40 mins)
- **Root Cause**: Every tag change spawned individual ExifTool processes without batching
- **Impact**: Bulk operations created hundreds/thousands of concurrent ExifTool processes

### **✅ Performance Fixes Applied**

1. **Debouncing Mechanism**:

   - Added 300ms debounce to `scheduleMetadataWrite()` in `File.ts`
   - Multiple rapid tag changes now batch into single write operation
   - Prevents cascading ExifTool processes during bulk operations

2. **Parallel Processing Optimization**:

   - Updated `readTagsFromFiles()` to use parallel processing with concurrency limit (3)
   - Replaced sequential file processing with `promiseAllLimit()`
   - Significantly improved bulk tag reading performance

3. **Enhanced Error Handling**:
   - Improved retry mechanism to prevent error cascading
   - Better cleanup of pending operations during bulk mode

---

## Current State Analysis

### What's Currently Optimized

```typescript
// In src/frontend/entities/File.ts - ClientFile.addTag()
this.scheduleMetadataWrite(); // ✅ DEBOUNCED AND BATCHED!
```

### Why The Original Implementation Had Issues

1. **No Debouncing**: Each tag change = new ExifTool process
2. **Sequential Processing**: Bulk operations processed files one by one
3. **Error Cascading**: Failed retries multiplied the load

---

## ✅ **Current Implementation (Phase 1 + Performance Fixes)**

### **Immediate Sync with Debouncing**

- **Immediate UI Update**: Tags appear instantly in OneFolder ✅
- **Debounced File Write**: Metadata written after 300ms delay to batch rapid changes ✅
- **Performance**: Tested with large libraries - restored to original speed ✅

### **Bulk Operations Optimization**

- **Parallel Processing**: `readTagsFromFiles()` uses concurrency limit of 3 ✅
- **Progress Tracking**: Real-time progress updates during bulk operations ✅
- **Resource Management**: Prevents system overload during large operations ✅

### **Error Handling**

- **Silent Success**: No notification when writes succeed ✅
- **Visible Failures**: Toast notification with retry option ✅
- **Graceful Degradation**: App continues working even if file writes fail ✅
- **Cleanup**: Proper cleanup of pending operations during bulk mode ✅

### **Bug Fixes Applied**

- **Clear Tags Fix**: Removing all tags now properly clears file metadata ✅
- **Performance Regression Fix**: Debouncing prevents excessive ExifTool processes ✅
- **Bulk Operations Fix**: Parallel processing instead of sequential ✅

### **User Experience**

- ✅ **Success**: Silent background sync with optimal performance
- ❌ **Failures**: Toast notifications like "Failed to sync tags for IMG_001.jpg [Retry]"
- ✅ **Bulk Operations**: Fast parallel processing with progress indicators

---

## ✅ **Completed Implementation**

### Phase 1: Immediate Sync ✅

1. ✅ Uncommented `writeTags()` calls in `File.ts`
2. ✅ Added error handling with toast notifications and retry
3. ✅ Fixed clear tags bug in `ExifIO.ts`

### Phase 2: Performance Optimization ✅

1. ✅ Added debouncing mechanism to prevent excessive ExifTool processes
2. ✅ Optimized bulk tag reading with parallel processing
3. ✅ Enhanced error handling and cleanup
4. ✅ Tested with large libraries - performance restored

## 🚀 **Performance Characteristics**

### **Individual Tag Changes**

- **Debounce Delay**: 300ms (allows batching of rapid changes)
- **Resource Usage**: Minimal - single ExifTool process per batch
- **User Experience**: Instant UI feedback, silent background sync

### **Bulk Operations**

- **Concurrency Limit**: 3 parallel ExifTool processes
- **Progress Updates**: Real-time percentage display
- **Memory Usage**: Controlled and optimized

---

## Implementation Details

### Files Modified

- **`src/frontend/entities/File.ts`**:

  - Added debouncing mechanism (`scheduleMetadataWrite()`)
  - Enhanced `disableImmediateSync()` to handle pending operations
  - Improved error handling in retry logic

- **`src/frontend/stores/FileStore.ts`**:

  - Optimized `readTagsFromFiles()` with parallel processing
  - Added concurrency limit to prevent system overload
  - Enhanced progress tracking

- **`common/ExifIO.ts`**: Fixed clear tags bug - properly clears metadata when no tags remain

### Key Features

- **Debounced Writes**: 300ms delay batches rapid tag changes
- **Parallel Processing**: Concurrent operations with resource limits
- **Error Handling**: Toast notifications with retry for failed writes
- **Performance**: Optimized for both individual changes and bulk operations
- **Reliability**: App continues working even if file writes fail
