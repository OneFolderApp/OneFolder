Hello, I'm Antoine a web developer, and today I need you to be a profetional software developer, with lots of wisdom and experience, but open minded bc we are doing weird stuff today.

We are building a Desktop Electron app to navigate pictures and other files based on metadata and tags. It's called OneFolder.

The goal of the app is to have a local first way to tag and explore images.

This app is made in React, MobX, Dixie.js and indexDb. And it works very well.

Today I want to do a thought experiment, is weird so hear me out:

Many users are syncing files via Google Drive, Dropbox and others. And the problem is that even if the tags are writen in the image metadata itself, for performance reasonsn we don't read the image tags all the time, only at the beginning, we then rely only in the indexDB of the electron app.

So when 2 computers sync via this solutions, the tags don't get refreshed bc each local indexDB doesn't know it needs to refresh. I don't know if you understand the problem, please ask if is not clear.

We could make a stronger file metadata sync with the db, where it watches for files changed. But we want to add support for files that don't have metadata, so the only option we have left is to finde a smarth way to sync this two indexDB on each computer. Again, if you don't get it just ask, all the question you may need.

Here is my plan: using CRDTs (Conflict-free Replicated Data Types) to sync those two databases.

The complicated part is that the sync method has to be google drive, it can't be a http server.

So my plan is that inside of the .onefolder folder, each user has a history of changes, and we sync those databases on each client.

A full example with xavier and antoine syncing via google drive the same folder:

```
photo.png
presentation.ptt
.onefolder
    /antoine.db
    /xavier.db
```

If Xavier adds a tag to `photo.png` it will modify the `xavier.db`, then both files (`photo.png` and `xavier.db`) will be synced via Google Drive. Antoine will check on a regular interval if there is no update on `xavier.db`, if there is, it syncs them.

What do you think of this plan?
