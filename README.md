# ts-dev-server README

This is the README for "ts-dev-server".

### 0.0.12

Initial release of ts-dev-server

ts-dev-server is a simple inbuilt web server for Visual Studio Code that provides transparent transpiling of .ts and .tsx files via sucrase. This allows live development
against typescript files without needing the overhead of bundling when using a browser that supports es6 modules.

switched to using a modified tsconfig-paths for consistent paths resolution

OPTIONS handling for CORS

HTML-free ts/tsx method running
