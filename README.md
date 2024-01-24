<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/OneFolderApp/OneFolder/assets/27826950/e12e0f46-a1a8-484f-a443-b71d4a30d37f">
  <img alt="Text changing depending on mode. Light: 'So light!' Dark: 'So dark!'" src="https://github.com/OneFolderApp/OneFolder/assets/27826950/b6291e54-daf9-42c1-8649-ec14532d79c7">
</picture>

Navigate your files based on image metadata.

- Website: https://onefolder.app/
- Reoadmap: https://onefolder.canny.io/feedback

## Do you want to help?
There is many ways people can help:
- feedback and suggestion on design
- Test new features
- Copy Writting and bloggin
- Growth
- Coding

If you are interested here is a form so we can reach out:
https://forms.gle/TpU1NxBQSreadki18

## Quick Start

You need to have [NodeJS](https://nodejs.org/en/download/) and a package manager such as [Yarn](https://yarnpkg.com/lang/en/docs/install/) installed.
Then run the following commands to get started:

1. Run `yarn install` to install or update all necessary dependencies.
2. Run `yarn dev` to build the project files to the `/build` directory. This will keep running to immediately build changed files when they are updated.
3. In a second terminal, run `yarn start` to start the application. Refresh the window (Ctrl/Cmd + R) after modifying a file to load the updated build files.

## Release Build

An installable executable can be built using `yarn package` for your platform in the `/dist` folder. The building is performed using the [electron-builder](https://www.electron.build/) package, and is configured by a section in the `package.json` file.
Builds are automatically published to Github Releases when a tag is created in GitHub.

## Tech Stack
This project is a fork from [Allusion](https://github.com/allusion-app/Allusion).
* [ElectronJS](https://www.electronjs.org/) - the framework for desktop development
* [ReactJS](https://react.dev/) - Front-end library
* [MobX](https://mobx.js.org/README.html) - State Manadgment
* [ExifTool](https://exiftool.org/) - Edit image metadata
* [Annotorious](https://annotorious.github.io/) - Face selection on images
* [TenserFlowJS](https://www.tensorflow.org/js) - Face detection
