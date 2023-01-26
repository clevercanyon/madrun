/**
 * CLI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'desm';

import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Run from './resources/cli/cmds/run.js';
import * as u from './resources/cli/utilities.js';

const __dirname = dirname(import.meta.url);
const projDir = path.resolve(__dirname, '..');

const pkgFile = path.resolve(projDir, './package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile).toString()) as { [x: string]: unknown };

if (typeof pkg !== 'object') {
	throw new Error('Failed to parse `./package.json`.');
}
const { error: err } = console; // Shorter reference.

/**
 * Yargs CLI config. ⛵🏴‍☠
 *
 * @see http://yargs.js.org/docs/
 */
void (async () => {
	await yargs(hideBin(process.argv))
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
			if (error?.stack && typeof error.stack === 'string') err(chalk.gray(error.stack));
			err(await u.error('Madrun: Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		})
		.help('madrunHelp')
		.version('madrunVersion', pkg.version as string)
		.parse();
})();
