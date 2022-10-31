import Sass from 'sass.js/dist/sass';
import plugin from '../plugin.json';
import Path from './utils/Path';
import Url from './utils/Url';

const { acode, appSettings } = window;
const { fsOperation } = acode;

Sass.setWorkerUrl(new URL('sass.js/dist/sass.worker.js', import.meta.url));
class AcodePlugin {
  $page;
  #count = 0;

  constructor() {
    if (!appSettings.value[plugin.id]) {
      appSettings.value[plugin.id] = {
        outputDir: '',
        watch: true,
        style: 'nested',
        precision: -1,
        indent: '  ',
        comments: false,
        linefeed: '\n',
        sourceMapContents: true,
        sourceMapEmbed: false,
        sourceMapOmitUrl: true,
      };
      appSettings.update();
    }

    this.compile = this.compile.bind(this);
  }

  async init($page) {
    this.$page = $page;
    editorManager.on('save-file', this.compile);
    editorManager.editor.commands.addCommand({
      name: 'liveSassSettings',
      description: 'Live SASS plugin settings',
      exec: this.editSettings.bind(this),
    });
  }

  async destroy() {
    editorManager.off('save-file', this.compile);
    editorManager.editor.commands.removeCommand('liveSassSettings');
  }

  async compile(file) {
    const { location, name, session } = file;
    if (!location || !/\.(scss|sass)$/.test(name)) return;

    try {
      const text = session.getValue();

      if (/^\/\/--ignore-compile/.test(text)) return;

      const sass = new Sass();
      const settings = appSettings.value[plugin.id];
      let indentedSyntax = false;
      if (/\.sass$/.test(name)) indentedSyntax = true;
      sass.options({
        style: Sass.style[settings.style],
        precision: settings.precision,
        comments: settings.comments,
        indent: settings.indent,
        linefeed: settings.linefeed,
        sourceMapContents: settings.sourceMapContents,
        sourceMapEmbed: settings.sourceMapEmbed,
        sourceMapOmitUrl: settings.sourceMapOmitUrl,
        indentedSyntax,
      }, () => {
        sass.importer(async (req, res) => {
          if (!req.current) return;
          const file = Url.join(location, req.current);
          const text = await fsOperation(file).readFile('utf8');
          res({
            content: text,
          });
        });

        sass.compile(text, async (res) => {
          const cssname = file.name.replace(/scss$/, 'css');
          let css = Url.join(file.location, cssname);

          if (settings.outputDir) {
            css = Url.join(file.location, settings.outputDir, cssname);
          }

          const cssfs = fsOperation(css);

          if (res.status) {
            toast(res.message);
          }

          if (res.text) {
            if (!await cssfs.exists()) {
              await this.createFileRecursive(
                file.location,
                Path.join(settings.outputDir, cssname),
              );
            }
            await cssfs.writeFile(res.text);
          }
          sass.destroy();

          ++this.#count;
          if (this.#count === 9) {
            window.toast('Ad comming up.');
          }

          if (IS_FREE_VERSION && this.#count === 10) {
            this.#count = 1;
            if (!await window.iad?.isLoaded()) {
              await window.iad?.load();
            }
            window.iad?.show();
          }
        });
      });
    } catch (error) {
      toast('Error occured while compiling ' + name);
    }
  }

  async createFileRecursive(parent, dir) {
    if (typeof dir === 'string') {
      dir = dir.split('/');
    }
    dir = dir.filter(d => d);
    const cd = dir.shift();
    const newParent = Url.join(parent, cd);
    if (!(await fsOperation(newParent).exists())) {
      if (dir.length) {
        await fsOperation(parent).createDirectory(cd);
      } else {
        await fsOperation(parent).createFile(cd);
      }
    }
    if (dir.length) {
      await this.createFileRecursive(newParent, dir);
    }
  }

  async editSettings() {
    const file = fsOperation(appSettings.settingsFile);
    const { name } = await file.stat();
    const text = await file.readFile('utf8');
    const lines = text.split('\n');
    let row = 0;
    let column = 0;

    const regex = new RegExp(`"${plugin.id}"`);
    lines.find((line) => {
      const res = regex.test(line);
      row += 1;
      column = line.length;
      return res;
    });

    acode.newEditorFile(name, {
      text,
      uri: appSettings.settingsFile,
      render: true,
    });

    editorManager.editor.moveCursorTo(row, column);
    editorManager.editor.scrollToRow(row);
  }
}

if (window.acode) {
  const acodePlugin = new AcodePlugin();
  acode.setPluginInit(plugin.id, (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    acodePlugin.baseUrl = baseUrl;
    acodePlugin.init($page, cacheFile, cacheFileUrl);
  });
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}