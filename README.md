<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/OneFolderApp/OneFolder/assets/27826950/e12e0f46-a1a8-484f-a443-b71d4a30d37f">
  <img alt="Text changing depending on mode. Light: 'So light!' Dark: 'So dark!'" src="https://github.com/OneFolderApp/OneFolder/assets/27826950/b6291e54-daf9-42c1-8649-ec14532d79c7">
</picture>

- Website: https://onefolder.app/
- Roadmap: https://onefolder.canny.io/feedback

## What is it?

Desktop app to view your photos like you do in Google Photos or Apple Photos (e.g. Calendar, list, map, etc..) but locally and respecting metadata open standards (not creating a separate database to store that information\*).

Sorting your files this way ensures you always own them, and can store them wathever you want: any cloud provider, a USB Drive or just your computer. They are just files!

![of-screenshot](https://github.com/OneFolderApp/OneFolder/assets/27826950/8a720625-18ce-4bf2-8ad5-c70896af514e)
![Screenshot 2024-01-25 at 08 33-PhotoRoom](https://github.com/OneFolderApp/OneFolder/assets/27826950/fc735aff-1941-4120-b5e6-b52894e2308a)

## The OneFolder Manifesto

_Your files, your folder, forever._

1. **File-Over-App**  
   Your pictures live as ordinary image files—no proprietary library, no lock-in.

2. **One Source of Truth**  
   Every photo you care about sits in a single folder you control. Back it up or sync it anywhere; the structure stays intact.

3. **Built-In Organization**  
   Dates, duplicates, and other housekeeping are solved _inside_ the files themselves—so even without our app, your collection stays clean.

4. **Open Standards First**  
   We read and write well-known metadata (EXIF / XMP) instead of inventing new formats. Any modern viewer can understand your photos today—and in 20 years.

5. **Integrity, Not Optimism**  
   Edits never overwrite originals without your say-so. Your folder remains a reliable archive, not a guessing game.

6. **Future-Proof Freedom**  
   Because the rules live in the files, you can switch tools, change clouds, or hand the folder to your grand-kids—and everything still works.

## Features

- Watch folders (it does not copy them in a separate place, it watches and updates the folder in question)
- List and Grid View
- Edit metadata

Comming soon:

- Map View
- Calendar View
- Detect duplicates
- HEIC

## Do you want to help?

There is many ways people can help:

- Test new features
- feedback and suggestion on design
- Copy Writting and bloggin
- Detect new communities for growth
- Coding

If you are interested here is a form so we can reach out:
https://forms.gle/TpU1NxBQSreadki18

## Documentation

### Stack

This project is a fork from [Allusion](https://github.com/allusion-app/Allusion).

- [ElectronJS](https://www.electronjs.org/) - the framework for desktop development
- [ReactJS](https://react.dev/) - Front-end library
- [MobX](https://mobx.js.org/README.html) - State Manadgment
- [ExifTool](https://exiftool.org/) - Edit image metadata
- [Annotorious](https://annotorious.github.io/) - Face selection on images
- [TenserFlowJS](https://www.tensorflow.org/js) - Face detection

### Quick Start

You need to have [NodeJS](https://nodejs.org/en/download/) and a package manager such as [Yarn](https://yarnpkg.com/lang/en/docs/install/) installed.
Then run the following commands to get started:

1. Run `yarn install` to install or update all necessary dependencies.
2. Run `yarn dev` to build the project files to the `/build` directory. This will keep running to immediately build changed files when they are updated.
3. In a second terminal, run `yarn start` to start the application. Refresh the window (Ctrl/Cmd + R) after modifying a file to load the updated build files.

### Release Build

An installable executable can be built using `yarn package` for your platform in the `/dist` folder. The building is performed using the [electron-builder](https://www.electron.build/) package, and is configured by a section in the `package.json` file.
Builds are automatically published to Github Releases when a tag is created in GitHub.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=OneFolderApp/OneFolder&type=Date)](https://star-history.com/#OneFolderApp/OneFolder&Date)

### Releasing

When you want to create a new release, follow these steps:

1. Update the version in your project's `package.json` file (e.g. `1.2.3`)
2. Add `git add .`
3. Commit that change (`git commit -am v1.2.3`)
4. Tag your commit (`git tag v1.2.3`). Make sure your tag name's format is `v*.*.*`. Your workflow will use this tag to detect when to create a release
5. Push your changes to GitHub (`git push && git push --tags`)

note: the release name of the release has to start with the version number and a hyphen (e.g. `1.0.19 - ...`) if not the auto downloader won't pick it up

After building successfully, the action will publish your release artifacts. By default, a new release draft will be created on GitHub with download links for your app. If you want to change this behavior, have a look at the [`electron-builder` docs](https://www.electron.build).
