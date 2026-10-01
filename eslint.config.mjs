import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['out/**', '.vscode-test/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			curly: 'warn',
			eqeqeq: 'warn',
			semi: ['warn', 'always'],
		},
	},
);
