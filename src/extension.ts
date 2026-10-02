import * as vscode from 'vscode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const debugServer = require('ts-debug-reload-server');

const TOGGLE_COMMAND = 'tsdevserver.toggleServer';

let channel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

function updateStatusBarItem() {
	if (debugServer.isRunning()) {
		statusBarItem.text = '$(debug-stop) Dev Server: Running';
		statusBarItem.tooltip = 'Click to stop the dev server';
	} else {
		statusBarItem.text = '$(play) Dev Server: Stopped';
		statusBarItem.tooltip = 'Click to start the dev server';
	}
	statusBarItem.show();
}

function startServer() {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('Open a folder to start the dev server.');
		return;
	}

	const config = vscode.workspace.getConfiguration('tsdevserver');
	const port = config.get<number>('port', 8080);
	const host = config.get<string>('host', 'localhost');

	debugServer.startServer(port, host, folder.uri.fsPath, (msg: string) => channel.appendLine(msg));
	channel.show(true);
}

function stopServer() {
	if (debugServer.isRunning()) {
		debugServer.stopServer();
	}
}

function toggleServer() {
	if (debugServer.isRunning()) {
		stopServer();
	} else {
		startServer();
	}
	updateStatusBarItem();
}

export function activate(context: vscode.ExtensionContext) {
	channel = vscode.window.createOutputChannel('Dev Server');

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = TOGGLE_COMMAND;
	updateStatusBarItem();

	context.subscriptions.push(
		channel,
		statusBarItem,
		vscode.commands.registerCommand(TOGGLE_COMMAND, toggleServer),
		{ dispose: stopServer },
	);
}

export function deactivate() {
	stopServer();
}
