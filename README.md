# ts-dev-server README

This is the README for "ts-dev-server".

### 0.0.5

Initial release of ts-dev-server

ts-dev-server is a simple inbuilt web server for Visual Studio Code that provides transparent transpiling of .ts and .tsx files via sucrase. This allows live development
against typescript files without needing the overhead of bundling when using a browser that supports es6 modules.

Contains bodgy path resolution based on path definition in tsconfig, but could be better (and probably will be in later revisions).

tsconfig ignoreExports array for excluding type only exports.

OPTIONS handling for CORS