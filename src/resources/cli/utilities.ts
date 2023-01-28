#!/usr/bin/env node
/**
 * CLI.
 */

import _ꓺomit from 'lodash/omit.js';

import coloredBox from 'boxen';
import chalk, { supportsColor } from 'chalk';

import * as se from 'shescape';
import spawnPlease from 'spawn-please';
import { execSync } from 'node:child_process';

/**
 * Logs to stdout.
 */
export const log = console.log;

/**
 * Logs to stderr.
 */
export const err = console.error;

/**
 * Echoes output to stdout.
 */
export const echo = process.stdout.write.bind(process.stdout);

/**
 * Echoes output to stderr.
 */
export const echoErr = process.stdout.write.bind(process.stderr);

/**
 * `$ madrun` config file names.
 */
export const configFiles = ['.madrun.json', '.madrun.js', '.madrun.cjs', '.madrun.mjs'];

/**
 * Args to omit from named CMD args.
 */
export const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrunVersion', 'madrunDebug'];

/**
 * Escapes a string for use in a regular expression.
 *
 * @returns Escaped string for use in a regular expression.
 */
export const escRegExp = (str: string): string => {
	return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
};

/**
 * Executes command line operation.
 *
 * @param   cmd  CMD + any args, or shell script to run.
 * @param   opts Any additional execSync options.
 *
 * @returns      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
 */
export const exec = async (cmd: string, opts: { [x: string]: unknown } = {}): Promise<string> => {
	return (
		execSync(cmd, {
			cwd: process.cwd(),
			shell: 'bash',
			stdio: 'inherit',
			env: {
				...process.env,
				PARENT_IS_TTY:
					process.stdout.isTTY || //
					process.env.PARENT_IS_TTY
						? 'true'
						: 'false',
			},
			...opts,
		}) || Buffer.from('')
	).toString();
};

/**
 * Spawns command line operation.
 *
 * @param   cmd  CMD name or path.
 * @param   args Any CMD arguments.
 * @param   opts Any additional spawn options.
 *
 * @returns      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
 */
export const spawn = async (cmd: string, args: string[] = [], opts: { [x: string]: unknown } = {}): Promise<string> => {
	if ('shell' in opts ? opts.shell : 'bash') {
		// When using a shell, we must escape everything ourselves.
		// i.e., Node does not escape `cmd` or `args` when a `shell` is given.
		(cmd = se.quote(cmd)), (args = se.quoteAll(args));
	}
	return await spawnPlease(cmd, args, {
		cwd: process.cwd(),
		shell: 'bash',
		stdio: 'inherit',
		env: {
			...process.env,
			PARENT_IS_TTY:
				process.stdout.isTTY || //
				process.env.PARENT_IS_TTY
					? 'true'
					: 'false',
		},
		// Output handlers do not run when `stdio: 'inherit'` or `quiet: true`.
		stdout: opts.quiet ? null : (buffer: Buffer) => echo(chalk.white(buffer.toString())),
		stderr: opts.quiet ? null : (buffer: Buffer) => echoErr(chalk.gray(buffer.toString())),

		..._ꓺomit(opts, ['quiet']),
	});
};

/**
 * Outputs CLI error.
 *
 * @param   title Output title.
 * @param   text  Output text.
 *
 * @returns       Output string; error.
 */
export const error = async (title: string, text: string) => {
	if (!process.stdout.isTTY || !supportsColor || !supportsColor?.has16m) {
		return chalk.red(text); // No box.
	}
	return (
		'\n' +
		coloredBox(chalk.bold.red(text), {
			margin: 0,
			padding: 0.75,
			textAlignment: 'left',

			dimBorder: false,
			borderStyle: 'round',
			borderColor: '#551819',
			backgroundColor: '',

			titleAlignment: 'left',
			title: chalk.bold.redBright('⚑ ' + title),
		})
	);
};

/**
 * Outputs CLI finale.
 *
 * @param   title Output title.
 * @param   text  Output text.
 *
 * @returns       Output string; finale.
 */
export const finale = async (title: string, text: string): Promise<string> => {
	if (!process.stdout.isTTY || !supportsColor || !supportsColor?.has16m) {
		return chalk.green(text); // No box.
	}
	return (
		'\n' +
		coloredBox(chalk.bold.hex('#ed5f3b')(text), {
			margin: 0,
			padding: 0.75,
			textAlignment: 'left',

			dimBorder: false,
			borderStyle: 'round',
			borderColor: '#8e3923',
			backgroundColor: '',

			titleAlignment: 'left',
			title: chalk.bold.green('✓ ' + title),
		})
	);
};

/**
 * Propagates user environment variables.
 */
export const propagateUserEnvVars = (): void => {
	process.env.NPM_TOKEN = process.env.USER_NPM_TOKEN || '';
	process.env.GH_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.CLOUDFLARE_API_TOKEN = process.env.USER_CLOUDFLARE_TOKEN || '';
};
