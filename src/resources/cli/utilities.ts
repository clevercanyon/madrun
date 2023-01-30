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

import yArgs from 'yargs';
import { hideBin as yargsꓺhideBin } from 'yargs/helpers';
import type { Argv as Yargs, Arguments as yargsꓺArgs } from 'yargs';

declare const $$__APP_PKG_VERSION__$$: string;

/**
 * Synchronous utilities.
 */

/**
 * Logs to stdout|stderr.
 */
export const { log, error: logError, debug: logDebug } = console;

/**
 * Echoes output to stdout.
 */
export const echo = process.stdout.write.bind(process.stdout);

/**
 * Echoes output to stderr.
 */
export const echoError = process.stdout.write.bind(process.stderr);

/**
 * Echoes output to stdout.
 */
export const echoDebug = process.stdout.write.bind(process.stdout);

/**
 * `$ madrun` config file names.
 */
export const configFilesGlob = '.madrun.{json,js,cjs,mjs}';
export const configFiles = ['.madrun.json', '.madrun.js', '.madrun.cjs', '.madrun.mjs'];

/**
 * Args to omit from named CMD args.
 */
export const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrunVersion', 'madrunDebug'];

/**
 * Encodes a URI component.
 *
 * @param   ...args {@see encodeURIComponent()} for details.
 *
 * @returns         Returns {@see encodeURIComponent()} return type.
 */
export const encURI = (...args: Parameters<typeof encodeURIComponent>): ReturnType<typeof encodeURIComponent> => {
	return encodeURIComponent(...args);
};

/**
 * Escapes a string for use in a regular expression.
 *
 * @returns Escaped string for use in a regular expression.
 */
export const escRegExp = (str: string): string => {
	return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
};

/**
 * Asynchronous utilities.
 */

/**
 * Propagates user environment variables.
 */
export const propagateUserEnvVars = async (): Promise<void> => {
	process.env.NPM_TOKEN = process.env.USER_NPM_TOKEN || '';
	process.env.GH_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.CLOUDFLARE_API_TOKEN = process.env.USER_CLOUDFLARE_TOKEN || '';
};

/**
 * Defaults args to {@see yargs()} utility.
 */
export interface yargsꓺOpts {
	bracketedArrays?: boolean;
	scriptName?: string;
	errorBoxName?: string;
	helpOption?: string;
	versionOption?: string;
	maxTerminalWidth?: number;
	showHidden?: boolean;
	strict?: boolean;
}
const yargsꓺdefaultOpts: yargsꓺOpts = {
	bracketedArrays: true,
	scriptName: '',
	errorBoxName: '',
	helpOption: 'help',
	versionOption: 'version',
	maxTerminalWidth: 80,
	showHidden: false,
	strict: true,
};

/**
 * Creates a new Yargs instance.
 *
 * @param   opts Instance creation options.
 *
 * @returns      A new pre-configured Yargs instance.
 */
export const yargs = async (opts: yargsꓺOpts = yargsꓺdefaultOpts): Promise<Yargs> => {
	let newYargs: Yargs; // Initialize.
	opts = Object.assign({}, opts, yargsꓺdefaultOpts);

	if (opts.bracketedArrays) {
		newYargs = await yArgsꓺwithBracketedArrays();
	} else {
		newYargs = yArgs(yargsꓺhideBin(process.argv));
	}
	if (opts.scriptName) {
		newYargs.scriptName(opts.scriptName);
	}
	return newYargs
		.parserConfiguration({
			'strip-dashed': true,
			'strip-aliased': true,
			'greedy-arrays': true,
			'dot-notation': false,
			'boolean-negation': false,
		})
		.help(opts.helpOption as string) // Given explicitly.
		.version(opts.versionOption as string, $$__APP_PKG_VERSION__$$)

		.wrap(Math.max(opts.maxTerminalWidth as number, newYargs.terminalWidth() / 2))
		.showHidden(opts.showHidden as boolean) // `false` = permanently hide hidden options.
		.strict(opts.strict as boolean) // `true` = no arbitrary commands|options.

		.fail(async (message, error /* , yargs */) => {
			if (error?.stack && typeof error.stack === 'string') logError(chalk.gray(error.stack));
			logError(await errorBox((opts.errorBoxName ? opts.errorBoxName + ': ' : '') + 'Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		});
};

/**
 * Creates a new Yargs instance that supports bracketed arrays.
 *
 * @returns A new pre-configured Yargs instance that supports bracketed arrays.
 */
const yArgsꓺwithBracketedArrays = async (): Promise<Yargs> => {
	const bracketedArrayArgNames: string[] = [];
	const newYargsArgs = yargsꓺhideBin(process.argv);

	for (const arg of newYargsArgs) {
		let m: null | string[] = null;
		if ((m = arg.match(/^-{1,2}((?:[^-[\]\s][^[\]\s]*)?\[\]?)$/u))) {
			if ('[]' === m[1]) bracketedArrayArgNames.push('[');
			bracketedArrayArgNames.push(m[1]);
		}
	}
	if (!bracketedArrayArgNames.length) {
		return yArgs(newYargsArgs); // New Yargs instance.
	}
	for (let i = 0, inBracketedArrayArgs = false; i < newYargsArgs.length; i++) {
		if (inBracketedArrayArgs) {
			if (']' === newYargsArgs[i] || '-]' === newYargsArgs[i]) {
				inBracketedArrayArgs = false;
				newYargsArgs[i] = '-]'; // Closing arg.
			}
		} else if (newYargsArgs[i].match(/^-{1,2}((?:[^-[\]\s][^[\]\s]*)?\[)$/u)) {
			inBracketedArrayArgs = true;
		}
	}
	return yArgs(newYargsArgs) // New Yargs instance.
		.array(bracketedArrayArgNames)
		.options({
			']': {
				hidden: true,
				type: 'boolean',
				requiresArg: false,
				demandOption: false,
				default: false,
			},
		})
		.middleware((args) => {
			const partialArgs: Partial<yargsꓺArgs> = args;
			delete partialArgs[']']; // Ditch closing brackets.

			for (const [name] of Object.entries(args)) {
				if (['$0', '_', ']'].includes(name)) {
					continue; // Not applicable.
				} else if (!bracketedArrayArgNames.includes(name)) {
					continue; // Not applicable.
				}
				if (args[name] instanceof Array) {
					args[name] = (args[name] as Array<string | number>) //
						.map((v) => (typeof v === 'string' ? v.replace(/,$/u, '') : v))
						.filter((v) => '' !== v);
				}
			}
		}, true);
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
 * @returns      Stdout; always. No exceptions.
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
		stderr: opts.quiet ? null : (buffer: Buffer) => echoError(chalk.gray(buffer.toString())),

		..._ꓺomit(opts, ['quiet']),
	});
};

/**
 * Outputs CLI error box.
 *
 * @param   title Output title.
 * @param   text  Output text.
 *
 * @returns       Output string; error.
 */
export const errorBox = async (title: string, text: string) => {
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
 * Outputs CLI finale box.
 *
 * @param   title Output title.
 * @param   text  Output text.
 *
 * @returns       Output string; finale.
 */
export const finaleBox = async (title: string, text: string): Promise<string> => {
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
