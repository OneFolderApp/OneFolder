# Custom themes

This folder contains a couple of theme presets, that will be copied to the user's OneFolder custom themes directory when installing OneFolder.

## Creating a custom theme

The default theme of OneFolder can be used as a reference, which can be found in the `/resources/style/remake/themes.scss` file of OneFolder's source code.

## Loading a custom theme

1. Open the settings panel
2. In Appearance > Theme Customization, click the Folder button to open the "themes" folder
3. Copy one of the preset files or create a new `.css` file with the name of your theme and customize it to your liking
4. Click the Refresh button in the settings panel
5. Pick the theme from the dropdown menu
6. Enjoy!

## DevTools

The built-in Chrome Dev Tools can be used to preview colors intuitively before noting them down in a CSS file. It can be accessed through the settings panel at Advanced > Toggle DevTools or by pressing `Ctrl + Shift + I` in the main OneFolder window.

The theme colors are applied through the `.light` and `.dark` classes, which are set on the first HTML child element of `body > #app`.
