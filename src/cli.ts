/**
 * CLI.
 */

import Run from './resources/cli/cmds/run.js';
import * as u from './resources/cli/utilities.js';

/**
 * Yargs ⛵🏴‍☠.
 */
void (async () => {
	await u.propagateUserEnvVars(); // i.e., `USER_` env vars.
	const yargs = await u.yargs({ strict: false, scriptName: 'madrun', errorBoxName: 'madrun', helpOption: 'madrunHelp', versionOption: 'madrunVersion' });
	await yargs
		.command({
			command: ['$0'],
			describe: 'Runs commands, shell scripts, or JS functions configured by a `' + u.configFilesGlob + '` file.',
			builder: (yargs) => {
				return yargs
					.options({
						madrunDebug: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Debug?',
						},
					})
					.check(async (/* args */) => {
						return true;
					});
			},
			handler: async (args) => {
				await new Run(args).run();
			},
		})
		.parse();
})();
