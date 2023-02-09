import Sass from 'sass.js/dist/sass';
import plugin from '../plugin.json';
import Path from './utils/Path';
import Url from './utils/Url';

const { acode } = window;
const { fsOperation } = acode;
const appSettings = acode.require('settings');

Sass.setWorkerUrl(new URL('sass.js/dist/sass.worker.js', import.meta.url));
class AcodePlugin {
  $page;
  #saveCount = 0;

  constructor() {
    let settingsChanged = false;
    // traverse all default settings and set if not set or type is different
    if (!this.settings) {
      appSettings.value[plugin.id] = {};
    }
    Object.keys(this.defaultSettings).forEach((key) => {
      const type = typeof this.defaultSettings[key];
      if (typeof this.settings[key] !== type) {
        settingsChanged = true;
        this.settings[key] = this.defaultSettings[key];
      }
    });
    if (settingsChanged) appSettings.update();
    this.compile = this.compile.bind(this);
  }

  async init($page) {
    this.$page = $page;
    $page.settitle(plugin.name);
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
      sass.options(
        {
          style: Sass.style[settings.style],
          precision: settings.precision,
          comments: settings.comments,
          indent: this.indent,
          linefeed: this.linefeed,
          sourceMapContents: settings.sourceMapContents,
          sourceMapEmbed: settings.sourceMapEmbed,
          sourceMapOmitUrl: settings.sourceMapOmitUrl,
          indentedSyntax,
        },
        () => {
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
              this.$page.content = <code
                style={{
                  display: 'block',
                  padding: '10px',
                  borderBottom: 'solid 1px rgba(255,255,255,0.1)',
                }}
              >{res.formatted}</code>;
              this.$page.show();
            }

            if (res.text) {
              if (!(await cssfs.exists())) {
                await this.createFileRecursive(file.location, Path.join(settings.outputDir, cssname));
              }
              await cssfs.writeFile(res.text);
            }
            sass.destroy();

            if (!IS_FREE_VERSION) {
              return;
            }

            ++this.#saveCount;
            if (this.#saveCount === 4) {
              window.toast('Ad coming up.');
              this.#saveCount = 0;

              if (!(await window.iad?.isLoaded())) {
                await window.iad?.load();
              }

              window.iad?.show();
            }
          });
        }
      );
    } catch (error) {
      toast('Error occured while compiling ' + name);
    }
  }

  async createFileRecursive(parent, dir) {
    if (typeof dir === 'string') {
      dir = dir.split('/');
    }
    dir = dir.filter((d) => d);
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

  get settingsJson() {
    const list = [
      {
        key: 'outputDir',
        text: 'Output directory',
        value: this.settings.outputDir,
        prompt: 'Output directory',
        promptType: 'text',
        promptOptions: {
          placeholder: 'e.g. css',
          // should valid folder name
          match: /^[a-zA-Z0-9-_]+$/,
        }
      },
      {
        key: 'watch',
        text: 'Compile on save',
        checkbox: this.settings.watch,
      },
      {
        key: 'style',
        text: 'Output style',
        select: ['nested', 'expanded', 'compact', 'compressed'],
        value: this.settings.style,
      },
      {
        key: 'precision',
        text: 'Precision',
        value: this.settings.precision,
        prompt: 'Precision',
        promptType: 'number',
        promptOptions: {
          placeholder: 'e.g. 5',
          // should be a number
          match: /^[0-9]+$/,
        },
      },
      {
        key: 'comments',
        text: 'Include comments',
        checkbox: this.settings.comments,
      },
      {
        key: 'indent',
        text: 'Indent type',
        select: ['space', 'tab'],
        value: this.settings.indent,
      },
      {
        key: 'indentWidth',
        text: 'Indent width',
        value: this.settings.indentWidth,
        prompt: 'Indent width',
        promptType: 'number',
        promptOptions: {
          placeholder: 'e.g. 2',
          // should be a number
          match: /^[0-9]+$/,
        },
      },
      {
        key: 'linefeed',
        text: 'Linefeed type',
        select: ['cr', 'crlf', 'lf', 'lfcr'],
        value: this.settings.linefeed,
      },
      {
        key: 'sourceMapContents',
        text: 'Embed source map contents',
        checkbox: this.settings.sourceMapContents,
      },
      {
        key: 'sourceMapEmbed',
        text: 'Embed source map',
        checkbox: this.settings.sourceMapEmbed,
      },
      {
        key: 'sourceMapOmitUrl',
        text: 'Omit source map url',
        checkbox: this.settings.sourceMapOmitUrl,
      }
    ];

    return {
      list,
      cb: (key, value) => {
        this.settings[key] = value;
        appSettings.update();
      },
    };
  }

  get indent() {
    if (this.settings.indent === 'tab') {
      return '\t';
    }
    return ' '.repeat(
      parseInt(this.settings.indentWidth, 10) || 2
    );
  }

  get linefeed() {
    switch (this.settings.linefeed) {
      case 'cr':
        return '\r';
      case 'crlf':
        return '\r\n';
      case 'lfcr':
        return '\n\r';
      default:
        return '\n';
    }
  }

  get settings() {
    return appSettings.value[plugin.id];
  }

  get defaultSettings() {
    return {
      outputDir: '',
      watch: true,
      style: 'expanded',
      precision: -1,
      indent: 'space',
      indentWidth: 2,
      comments: false,
      linefeed: 'lf',
      sourceMapContents: true,
      sourceMapEmbed: false,
      sourceMapOmitUrl: true,
    };
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
  }, acodePlugin.settingsJson);
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
