// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { start } from 'repl';

const sucrase = require('./sucrase');

interface DevServerContentPath {
	type: "content";
	url: string;
	path: string;
}

interface DevServerProxyPath {
	type: "proxy";
	url: string;
	server: string;
}

type DevServerPath = DevServerContentPath | DevServerProxyPath;

interface DevServerConfig {
	port?: number;
	paths?: DevServerPath[];
}

const mimeLookup:{[index:string]:string} = {
	".css": "text/css;charset=utf-8",
	".js": "text/javascript",
	".ts": "text/javascript",
	".tsx": "text/javascript",
	".html": "text/html;charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml"
}

let channel : vscode.OutputChannel;
let myStatusBarItem: vscode.StatusBarItem;
let server: http.Server | null = null;
let serverPaths : DevServerPath[] | null = null;
let matcher: any;
let rootFolder: string;

function setHeaders(response:http.ServerResponse, ext: string, mtime: Date) {
	const mimeType = mimeLookup[ext];

	response.setHeader("Last-Modified", mtime.toUTCString());
	response.setHeader("Cache-Control", "must-revalidate");
	if (mimeType !== undefined) {
		response.setHeader("Content-Type", mimeType);
	}

}

function loadTSConfig(folder: string) {
	const configPath = path.join(folder, "tsconfig.json");
	if (fs.existsSync(configPath)) {
		rootFolder = folder;
		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
		if (config.compilerOptions !== undefined && config.compilerOptions.baseUrl !== undefined) {
			config.basePath = path.join(folder, config.compilerOptions.baseUrl);
		} else {
			config.basePath = folder;
		}
		return config;
	}
	return null;
}

let tsconfigCache:{[index:string]: any} = {

}

function getTSConfig(folder: string) {
	let search = folder;
	if (tsconfigCache[folder]) {
		return tsconfigCache[folder];
	}
	while (true) {
		const config = loadTSConfig(search);
		if (config !== null) {
			tsconfigCache[folder] = config;
			if (config.compilerOptions === undefined) {
				config.compilerOptions = {};
			}
			if (config.compilerOptions.baseUrl === undefined) {
				config.compilerOptions.baseUrl = ".";
			}
			if (config.compilerOptions.paths === undefined) {
				config.compilerOptions.paths = {
					"*": ["node_modules/*"]
				};
			}
			return config;
		}
		const parentFolder = path.dirname(search);
		if (parentFolder === folder) {
			break;
		}
		search = parentFolder;
	}
	tsconfigCache[folder] = null;
	return null;
}

function findModule(tsconfig: any, moduleName: string) {
	const paths:string[] = tsconfig.compilerOptions.paths['*'];
	const root = tsconfig.basePath;

	for(const p of paths) {
		const modulePath = path.join(root, p.substring(0, p.length - 2), moduleName);
		const packageJSONPath = path.join(modulePath, 'package.json');
		if (fs.existsSync(packageJSONPath)) {
			const json = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));
			const module = path.join(modulePath, json.module);
			return module;
		}
	}
	return null;
}

function serveStaticFile(dataPath: string, subPath:string, response:http.ServerResponse) {
	let srcPath = path.join(dataPath, subPath);

	if (!fs.existsSync(srcPath)) {
		response.writeHead(404);
		response.end("No file at " + srcPath);
		return;
	}

	const ext = path.extname(srcPath);

	const mtime = fs.statSync(srcPath).mtime;

	if (ext === ".ts" || ext === ".tsx") {
		const tsconfig = getTSConfig(path.dirname(srcPath));
		if (tsconfig !== null && tsconfig.compilerOptions !== undefined) {
			const src = fs.readFileSync(srcPath, "utf-8");

			try {
				const jsxPragma = tsconfig !== null && tsconfig.compilerOptions !== undefined && tsconfig.compilerOptions.jsxFactory ? tsconfig.compilerOptions.jsxFactory : "React.createElement";
				const txform = sucrase.transform(src, {
					transforms:ext === ".tsx" ? ["typescript", "jsx"] : ["typescript"],
					jsxPragma,
					filePath: srcPath,
					moduleResolver(name: string) {
						if (name.startsWith(".")) {
							const target = path.join(srcPath, "..", name);
							if (fs.existsSync(target)) {
								return name;
							}
							if (fs.existsSync(target + ".ts")) {
								return name + ".ts";
							}
							if (fs.existsSync(target + ".tsx")) {
								return name + ".tsx";
							}
							console.log("Unknown path " + target + " reference from " + srcPath)
							return name;
						} else {
							const modulePath = findModule(tsconfig, name);

							if (modulePath != null) {
								return path.relative(path.join(srcPath, '..'), modulePath).split('\\').join('/');
							} else {
								return name;
							}
						}
					}
				});
				setHeaders(response, ext, mtime);
				response.writeHead(200);
				response.end(txform.code);
			} catch (e) {
				response.setHeader("Content-Type", "text/plain");
				response.writeHead(503);
				response.end(e.toString());
				channel.appendLine(e.toString())
			}

			return;
		}
	}

	setHeaders(response, ext, mtime);
	response.writeHead(200);

	fs.createReadStream(srcPath).pipe(response);
}

function serveProxyFile(server: string, subPath:string, request:http.IncomingMessage, response:http.ServerResponse) {
	var proxy = http.request(server + "/" + subPath, function (res) {
		response.writeHead(res.statusCode || 500, res.headers)
		res.pipe(response, {
		  end: true
		});
	  });
	
	  request.pipe(proxy, {
		end: true
	  });
}

function matchPath(spec: DevServerPath, bits: string[], request:http.IncomingMessage, response:http.ServerResponse): boolean {
	const specBits = spec.url.split("/");

	if (specBits.length > bits.length) {
		return false;
	}
	for (let idx = 0; idx < specBits.length; idx++) {
		if (specBits[idx] !== bits[idx]) {
			return false;
		}
	}

	const subPath = bits.slice(specBits.length).join("/");

	if (spec.type === "content") {
		if (vscode.workspace.workspaceFolders !== undefined) {
			for (const f of vscode.workspace.workspaceFolders) {
				try {
					const root = f.uri.fsPath;

					const dataPath = path.join(root, spec.path);
					if (fs.existsSync(dataPath)) {
						serveStaticFile(dataPath, subPath, response);
						return true;
					}
				} catch {

				}
			}
		}
		response.writeHead(404);
		response.end("");
	} else if (spec.type === "proxy") {
		serveProxyFile(spec.server, subPath, request, response);
		return true;
	}

	response.writeHead(200);
	response.end("yep");

	return true;
}

function updateStatusBarItem() {
	if (server === null) {
		myStatusBarItem.text = 'Stopped';
	} else {
		myStatusBarItem.text = 'Running';
	}
	myStatusBarItem.show();
}

const requestHandler:http.RequestListener = (request:http.IncomingMessage, response:http.ServerResponse) => {  
	let url = request.url;

	if (url === undefined || serverPaths === null) {
		response.writeHead(404);
		response.end("Nope");
		return;
	}

	const qidx = url.indexOf("?");
	if (qidx > 0) {
		url = url.substring(0, qidx);
	}

	const urlBits = url.split("/");
	for (const p of serverPaths) {
		if (matchPath(p, urlBits, request, response)) {
			return;
		}
	}
	if (matchPath({
		type: "content",
		url: "",
		path: ""
	}, urlBits, request, response)) {
		return;
	}

	response.writeHead(404);
	response.end("unrecognised path");
};

const liveSockets = new Map();

function startServer() {
	checkConfiguration();
	const port = vscode.workspace.getConfiguration().get('tsdevserver.port') as number;
	const host = vscode.workspace.getConfiguration().get('tsdevserver.host') as string;

	server = http.createServer(requestHandler);
	server.listen(port, host, (err:any) => {  
		if (err) {
		  return console.log('something bad happened', err);
		}
	  
		channel.appendLine(`server is listening on ${host}:${port}`);
		channel.show(true);
		console.log(`server is listening on ${host}:${port}`);
	});

	server.on('connection', function (socket) {
		liveSockets.set(socket, true);
		socket.on('close', ()=>liveSockets.delete(socket));
	});
}

function closeServer() {
	if (server !== null) {
		server.close(()=>{
			channel.appendLine(`server closed`);
		});
		for (const sock of liveSockets.keys()) {
			sock.destroy();
		}
		liveSockets.clear();
	}
	tsconfigCache = {};
	server = null;
}

function checkConfiguration() {
	let serverConfig : DevServerConfig | null = null;

	if (vscode.workspace.workspaceFolders !== undefined) {
		for (const f of vscode.workspace.workspaceFolders) {
			try {
				const configPath = path.join(f.uri.fsPath, "tsdevserver.json");
				if (fs.existsSync(configPath)) {
					serverConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
					break;
				}
			} catch {

			}
		}
	}
	if (serverConfig !== null) {
		serverPaths = serverConfig.paths !== undefined ? serverConfig.paths : [];
	} else {
		serverPaths = [];
	}
}

function toggleServer() {
	if (server === null) {
		startServer();
	} else {
		closeServer();
	}
	updateStatusBarItem();
}

export function activate(context: vscode.ExtensionContext) {
		channel = vscode.window.createOutputChannel("Dev Server");

		const myCommandId = 'tsdevserver.toggleServer';
		context.subscriptions.push(vscode.commands.registerCommand(myCommandId, toggleServer));

		myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		myStatusBarItem.command = myCommandId;
		updateStatusBarItem();
/*
		context.subscriptions.push(		vscode.workspace.onDidChangeConfiguration(e=>{
			console.log(`config was changed`);
		}));

		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e=>{
			console.log(`${e.fileName} was saved`);
		}));

		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(e=>{
			console.log(`workspace folders was changed`);
		}));
*/
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push({
		dispose: ()=>{
			closeServer();
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log(`deactivate called`);

}
