/**
 * CLI.
 */

import chalk from 'chalk';
import yArgs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Run from './resources/cli/cmds/run.js';
import * as u from './resources/cli/utilities.js';

u.propagateUserEnvVars(); // i.e., `USER_` env vars.

declare const $$__APP_PKG_VERSION__$$: string;

/**
 * Yargs CLI config. ⛵🏴‍☠
 *
 * @see http://yargs.js.org/docs/
 */
void (async () => {
	const yargs = yArgs(hideBin(process.argv));
	await yargs
		.scriptName('madrun')
		.parserConfiguration({
			'dot-notation': false,
			'strip-aliased': true,
			'strip-dashed': true,
			'greedy-arrays': true,
			'boolean-negation': false,
		})
		.help('madrunHelp') // Version passed explicitly.
		.version('madrunVersion', $$__APP_PKG_VERSION__$$)
		.wrap(Math.max(80, yargs.terminalWidth() / 2))

		.command({
			command: ['$0'],
			describe: 'Runs one or more commands configured by a mad JS file; in sequence.',
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
		.fail(async (message, error /* , yargs */) => {
			if (error?.stack && typeof error.stack === 'string') u.err(chalk.gray(error.stack));
			u.err(await u.error('madrun: Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		})
		.parse();
})();
