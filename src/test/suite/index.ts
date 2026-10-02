import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';

export async function run(): Promise<void> {
	const mocha = new Mocha({ ui: 'tdd', color: true });
	const testsRoot = __dirname;

	for (const file of fs.readdirSync(testsRoot, { recursive: true }) as string[]) {
		if (file.endsWith('.test.js')) {
			mocha.addFile(path.resolve(testsRoot, file));
		}
	}

	await new Promise<void>((resolve, reject) =>
		mocha.run(failures => (failures ? reject(new Error(`${failures} tests failed.`)) : resolve())),
	);
}
