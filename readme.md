# SASS compiler

This plugin compile scss to css on file save. **Note**, this plugin is monetized with ads in _free version_ of the app.

## Ignore file

To prevent file from compiling add `//--ignore-compile` at the top of your scss file.

## Settings

To edit settings, search command 'live sass settings' in command palette.

- style: Format output: nested, expanded, compact, compressed
- precision: Decimal point precision for outputting fractional numbers
- comments: If you want inline source comments
- indent: String to be used for indentation
- linefeed: String to be used to for line feeds
- sourceMapContents: Embed included contents in maps
- sourceMapEmbed: Embed sourceMappingUrl as data uri
- sourceMapOmitUrl: Disable sourceMappingUrl in css output

- outputDir: Path to write output file
- watch: Weather to comple scss/sass file on save
