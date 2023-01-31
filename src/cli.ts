/**
 * CLI handler.
 */

import Run from './resources/cli/cmds/run.js';

import * as u from './resources/cli/utilities.js';
import { cli as $yargsꓺcli } from '@clevercanyon/utilities.node/yargs';

import type { Args } from './resources/cli/utilities.js';

/**
 * Yargs ⛵🏴‍☠.
 */
void (async () => {
	await (
		await $yargsꓺcli({
			strict: false,
			scriptName: 'madrun',
			errorBoxName: 'madrun',
			helpOption: 'madrunHelp',
			versionOption: 'madrunVersion',
			version: u.version,
		})
	)
		.command({
			command: ['$0'], // Default and only well-defined CMD here.
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
				await u.propagateUserEnvVars();
				await new Run(args as Args).run();
			},
		})
		.parse();
})();
