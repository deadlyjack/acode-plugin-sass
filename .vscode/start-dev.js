/* eslint-disable no-console */
const { fork, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pluginJson = require('../plugin.json');

main();

async function main() {
  let serverStarted = false;
  console.log('+--------------+');
  console.log('| Starting dev |');
  console.log('+--------------+');
  const webpack = fork(path.resolve(__dirname, './run-webpack.js'));
  webpack.on('message', (chunk) => {
    if (chunk.search(/compiled\ssuccessfully/)) {
      if (!serverStarted) {
        startServer();
        serverStarted = true;
      }

      moveFiles();
    }
  });

  webpack.on('error', (err) => {
    console.log('WEBPACK ERROR', err);
    webpack.kill(1);
    process.exit(1);
  });
}

async function startServer() {
  const server = fork(path.resolve(__dirname, './start-server.js'));
  server.on('error', (err) => {
    console.log('SERVER ERROR', err);
    server.kill(1);
    process.exit(1);
  });
}

function moveFiles() {
  let fileUpdate = false;
  const files = fs.readdirSync(path.resolve(__dirname, '../dist'));
  files.forEach((file) => {
    if (file === 'main.js') return;
    if (pluginJson.files.includes(file)) return;
    pluginJson.files.push(file);
    fileUpdate = true;
  });

  if (fileUpdate) {
    fs.writeFileSync(path.resolve(__dirname, '../plugin.json'), JSON.stringify(pluginJson, null, 2));
  }
}
