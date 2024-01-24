
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/OneFolderApp/OneFolder/assets/27826950/f0f17d41-d0c2-4c28-82f7-7114b17b56a5">
  <img alt="Text changing depending on mode. Light: 'So light!' Dark: 'So dark!'" src="https://github.com/OneFolderApp/OneFolder/assets/27826950/91e1c746-6f0e-4139-8fea-241b7a0c0c2a">
</picture>


## Roadmap
We use GitHub projects as a project manager, you can view and comment here: https://github.com/OneFolderApp/OneFolder/milestones

## Development

### Quick Start

You need to have [NodeJS](https://nodejs.org/en/download/) and a package manager such as [Yarn](https://yarnpkg.com/lang/en/docs/install/) installed.
Then run the following commands to get started:

1. Run `yarn install` to install or update all necessary dependencies.
2. Run `yarn dev` to build the project files to the `/build` directory. This will keep running to immediately build changed files when they are updated.
3. In a second terminal, run `yarn start` to start the application. Refresh the window (Ctrl/Cmd + R) after modifying a file to load the updated build files.

### Release Build

An installable executable can be built using `yarn package` for your platform in the `/dist` folder. The building is performed using the [electron-builder](https://www.electron.build/) package, and is configured by a section in the `package.json` file.
Builds are automatically published to Github Releases when a tag is created in GitHub.

### Tech Stack
This project is a fork from [Allusion](https://github.com/allusion-app/Allusion).
* [ElectronJS](https://www.electronjs.org/) - the framework for desktop development
* [ReactJS](https://react.dev/) - Front-end library
* [MobX](https://mobx.js.org/README.html) - State Manadgment
* [ExifTool](https://exiftool.org/) - Edit image metadata
* [Annotorious](https://annotorious.github.io/) - Face selection on images
* [TenserFlowJS](https://www.tensorflow.org/js) - Face detection
