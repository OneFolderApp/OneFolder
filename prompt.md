Hello, I'm Antoine a web developer, and today I need you to be a profetional software developer, with lots of wisdom and experience, but open minded bc we are doing weird stuff today.

We are building a Desktop Electron app to navigate pictures and other files based on metadata and tags. It's called OneFolder.

The goal of the app is to have a local first way to tag and explore images.

This app is made in React, MobX, Dixie.js (more on this later) and indexDb. And it works very well.

But we we started a fork a couple days ago, to try a Proof-of-concept, is weird so hear me out:

Many users are syncing files via Google Drive, Dropbox and others. And the problem is that even if the tags are writen in the image metadata itself, for performance reasons we don't read the image tags all the time, only at the beginning, we then rely only in the indexDB of the electron app.

So when 2 computers sync via this solutions, the tags don't get refreshed bc each local indexDB doesn't know it needs to refresh. I don't know if you understand the problem, please ask if is not clear.

We could make a stronger file metadata sync with the db, where it watches for files changed. But we want to add support for files that don't have metadata, so the only option we have left is to finde a smart way to sync this two indexDB on each computer. Again, if you don't get it just ask, all the question you may need.

Here is my plan: using CRDTs (Conflict-free Replicated Data Types) to sync those two databases.

The complicated part is that the sync method has to be Google Drive (the transport Layer), it can't be a http server.

So my plan is that inside of the .onefolder folder, each user has a history of changes, and we sync those databases on each client.

A full example with xavier and antoine syncing via Google Drive the same folder:

```
photo.png
presentation.ptt
.onefolder
    /antoine.db
    /xavier.db
```

If Xavier adds a tag to `photo.png` it will modify the `xavier.db`, then both files (`photo.png` and `xavier.db`) will be synced via Google Drive. Antoine will check on a regular interval if there is no update on `xavier.db`, if there is, it syncs them.

Like I said, we started a couple of days ago, and we have made some good progress, so here is a summary of each day:

--- day #1 start ---

# OneFolder: Migration from Dexie.js to Yjs and Backup/Restore Enhancements

This document summarizes the technical decisions, implementation details, and lessons learned during the migration of OneFolder’s database layer from Dexie.js to Yjs with the y-indexeddb provider. It also covers the design and implementation of the backup and restore functionality based on Yjs’s update API.

## Overview

OneFolder is a local-first desktop Electron app designed for navigating and tagging images and files. Originally, the app used Dexie.js as an IndexedDB abstraction. The goal of this migration was to:

- Support **CRDT-based** conflict-free merging for offline edits.
- Transition to a local-first, synchronized data store using **Yjs**.
- Enable efficient backup and restore using Yjs document updates.

## Migration from Dexie.js to Yjs

### Replacing Dexie with Yjs

- **Y.Doc as the Core Data Store:**  
  Instead of using Dexie tables, all application data (files, tags, locations, searches) is now stored in a single Yjs document (`Y.Doc`). Each entity type is maintained in its own `Y.Map`.

- **Persistence via y-indexeddb:**  
  The [y-indexeddb](https://github.com/yjs/y-indexeddb) provider is used to persist the Yjs document state in IndexedDB. This ensures that changes are stored locally and can be synchronized with other devices.

- **DataStorage Interface Implementation:**  
  The new `Backend` class implements the existing `DataStorage` interface, with methods such as `fetchFiles`, `createTag`, and `saveFiles` now operating on Yjs maps instead of Dexie tables.

  - **In-Memory Filtering:** Since Yjs does not support advanced query capabilities like Dexie, filtering and sorting are performed in-memory by iterating over the values of the maps.
  - **Date Rehydration:** Date fields stored in the Yjs document (which may be serialized as plain objects or strings) are rehydrated into proper JavaScript `Date` objects. This avoids runtime errors (e.g., calling `.getTime()` on an invalid date).

- **Filter Functions:**  
  The filtering logic (e.g., `filterLambda`) was ported over from the Dexie implementation to work with in-memory arrays.

## Backup and Restore Functionality

### Implementing Backups with Yjs

- **Yjs Update API:**  
  Backups are created by encoding the entire document state into a binary update using `Y.encodeStateAsUpdate(ydoc)`. This update is written to a file (as a binary blob) via Node’s filesystem APIs.

- **Restoring Data:**  
  Restoring involves reading the binary file, creating a `Uint8Array` from its contents, and applying it to the Y.Doc using `Y.applyUpdate(ydoc, update)`.
  - **Overwrite vs. Merge:**
    - **Overwrite:** Destroy the existing Y.Doc, create a new one, and apply the backup update. This prevents merging with leftover data and avoids duplication.
    - **Merge:** If merging is desired, careful deduplication is needed. However, merging without deduplication may result in duplicate records (e.g., duplicate images) if IDs differ.

### Addressing Common Issues

- **Empty Backups:**  
  Initial backups were only 2 bytes because separate Y.Doc instances were used for the backend and the backup scheduler. The solution was to share a single Y.Doc instance between them.

- **Database Naming Conflicts:**  
  The original Dexie database used the name `"OneFolder"`, which conflicted with y-indexeddb’s object stores. Changing the database name for y-indexeddb (e.g., to `"OneFolderYjs"`) avoids collisions and schema mismatches.

## Data Consistency and Tag Hierarchy

- **Duplicates on Restore:**  
  Duplicates may occur if the backup update is merged with an existing document that still holds data. To prevent this:
  - **Overwrite Mode:** Clear the existing Y.Doc before applying the backup.
  - **Merge with Deduplication:** Implement logic to identify and merge duplicate records based on consistent IDs (e.g., using file paths or unique identifiers).

## Best Practices and Recommendations

- **Single Y.Doc Instance:**  
  Always use the same Y.Doc instance across all components (backend, backup scheduler, etc.) to ensure consistency and proper synchronization.

- **Clear Database Naming:**  
  Use a dedicated database name for y-indexeddb (e.g., `"OneFolderYjs"`) to prevent conflicts with legacy Dexie databases.

- **Restoration Strategy:**  
  Decide between merging or completely overwriting local data during restore. Overwriting avoids duplication, but merging may be needed for incremental updates.

## Conclusion

Migrating OneFolder from Dexie.js to Yjs provides a robust, CRDT-based solution that supports offline editing and future synchronization across devices. The new architecture leverages Yjs’s powerful update API for backup and restore operations while rehydrating data (such as date fields) to maintain compatibility with existing front-end expectations. Special care must be taken to use a single shared Y.Doc, resolve database naming conflicts, and decide on a consistent strategy for handling data merges and tag hierarchies.

This summary serves as a technical documentation reference for future maintenance and enhancements of the OneFolder data layer.

--- day #1 end ---

My notes for day 2:
Currently the bacups are being properly stored in Yjs binary format, and we did manadge to load that data back to the indexDB, so the data is properly stored and readable.

But the load back _strategy_ is not working properly, we are merging, and even that doesn't work exactly like expected, so that is what we are going to work on now.

To give you a more clear path to where we are going, I want to replace Dexie JS properly, spetailly the backup part, because is crucial to the overall plan of syncing two devices only with files.

So the next step would be to re-implmenet the restoration of a database, to work exaclty like before, where the entire data is deleted and replaced with the incoming data.

I will give you the old DexieJS backup file, and then the new one under Yjs so you can spot the differences and try to replicate the workings of the old one.

Please ask all of the questions you may need (enumerate them to make it easier to answer), if you need documentation about indexdDB, Yjs or anything just ask.

--- day #2 start ---
Summary of Recent Changes to the OneFolder Backup System:

1. BackupScheduler Enhancements:

   - Added a new method `updateBackupDirectory(newDir: string)` to allow dynamically changing the backup directory. This enables backups to be stored in the 'onefolder_tags' folder located at the root of the user's primary location.
   - Introduced a getter method `getBackupDirectory()` so that the current backup directory can be retrieved by other parts of the application.
   - The backup methods now use the updated directory context when creating automatic backups and manual export backups, ensuring that backup files are placed in a cloud-synced folder rather than the default Application Support folder.

2. Renderer and RootStore Adjustments:

   - Modified the renderer (src/renderer.tsx) to update the BackupScheduler's directory based on the primary location fetched from the backend. This means that after loading the user's location data, the backup directory is set to `<primary-location>/onefolder_tags`.
   - Updated RootStore to expose the backup directory via a getter. This involved casting the backup instance to the extended BackupScheduler type to access the new `getBackupDirectory()` method, resolving the TypeScript error while preserving all original comments.
   - The Import/Export UI (src/frontend/containers/Settings/ImportExport.tsx) now uses the context-aware backup directory from RootStore for both exporting and importing database backups.

3. Overall Outcome:
   - Backups are now stored in a folder that is monitored by cloud services (e.g., Google Drive, Dropbox), facilitating easier synchronization between devices.
   - The changes ensure that both automatic backups (every 10 minutes) and manual exports use the new backup directory.
   - The modifications resolve previous issues with backup locations and maintain the original documentation and comments for clarity and future maintenance.

--- day #2 end ---

Notes for day 3:
With everything now working we have to move to the more weird part of this POC. The part where we create a diferent "session" for each user. And honestly I have no idea on how to do it, and I'm already imagining many edge cases that can be weird to handle.

Here is how I'm imagining it: every onefolder installation has it's own unic id. And that id is used inside of the `onefolder_tags` folder to separate between each session (I call sesion for each user, I don't know if is the right name, I'm open to ideas).

I don't know how to generate that session id, nor where to store it (maybe Electron has something like that? or maybe there is a simpler way?).

How do I see it working:

```
photos.png
work.ppt
/onfolder_tags
  /database
    /<sessionId>
      /database.db
```

Every 30 seconds the system will update the session database (if there is a change), and check for all of the other sessions in the database folder to see if there are updates, and if there are merge them with Yjs.

How does that sound?
