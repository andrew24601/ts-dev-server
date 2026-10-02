import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Tests', () => {
	test('registers the toggle command', async () => {
		const ext = vscode.extensions.getExtension('extremebasic.ts-dev-server');
		await ext?.activate();
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('tsdevserver.toggleServer'));
	});
});
