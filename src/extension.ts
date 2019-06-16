// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const debugServer = require('ts-debug-reload-server');

let channel : vscode.OutputChannel;
let myStatusBarItem: vscode.StatusBarItem;

function updateStatusBarItem() {
	if (!debugServer.isRunning()) {
		myStatusBarItem.text = 'Stopped';
	} else {
		myStatusBarItem.text = 'Running';
	}
	myStatusBarItem.show();
}

function startServer() {
	const port = vscode.workspace.getConfiguration().get('tsdevserver.port') as number;
	const host = vscode.workspace.getConfiguration().get('tsdevserver.host') as string;

	if (vscode.workspace.workspaceFolders === undefined) {
		return;
	}

	let root = vscode.workspace.workspaceFolders[0].uri.fsPath;

	debugServer.startServer(port, host, root, (msg:string)=>channel.appendLine(msg));
	channel.show(true);
}

function closeServer() {
	debugServer.stopServer();
}

function toggleServer() {
	if (!debugServer.isRunning()) {
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
