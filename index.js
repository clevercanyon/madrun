#!/usr/bin/env node
/**
 * `madrun` CLI.
 */
/* eslint-env es2021, node */

import path from 'node:path';
import { findUp } from 'find-up';

import * as se from 'shescape';
import _ꓺomit from 'lodash/omit.js';

import coloredBox from 'boxen';
import chalk, { supportsColor } from 'chalk';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from 'node:child_process';

const { error: err } = console; // Shorter reference.

const isParentTTY = process.stdout.isTTY ? true : false;
const isTTY = process.stdout.isTTY || process.env.PARENT_IS_TTY ? true : false;

const configFilesGlob = ['.madrun.{js|cjs|mjs}'];
const configFiles = ['.madrun.js', '.madrun.cjs', '.madrun.mjs'];

const omitFromCMDArgs = ['$0', '_']; // Named arguments we omit from CMD args.
const regexpCMDArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
const regexpCMDArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

/**
 * Run command.
 */
class Run {
	/**
	 * Constructor.
	 */
	constructor(args) {
		this.args = args;

		this.cmdName = args._?.[0] || '';
		this.cmdArgs = {
			_: args._.slice(1),
			..._ꓺomit(args, omitFromCMDArgs),
		};
		if ('' === this.cmdName) {
			throw new Error('Missing command name.');
		}
	}

	/**
	 * Runs CMD.
	 */
	async run() {
		for (let cmd of await this.cmds()) {
			execSync(await this.populateReplacementCodes(cmd), {
				stdio: [0, 1, 2],
				cwd: process.cwd(),
				env: { ...process.env, PARENT_IS_TTY: isTTY },
			});
		}
	}

	/**
	 * Finds config file.
	 */
	async configFile() {
		const configFile = await findUp(configFiles);

		if (!configFile) {
			throw new Error('`' + configFilesGlob + '` not found!');
		}
		return configFile;
	}

	/**
	 * Parses config file.
	 */
	async config() {
		const configFile = await this.configFile();
		const config = (await import(configFile)).default;

		if (typeof config !== 'object') {
			throw new Error('`' + path.basename(configFile) + '` config failure.');
		}
		return config;
	}

	/**
	 * Gets CMD function from config file.
	 */
	async cmdFn() {
		const config = await this.config();
		const cmdFn = config[this.cmdName] || null;

		if (typeof cmdFn !== 'function') {
			throw new Error('`' + this.cmdName + '` command is not available.');
		}
		return cmdFn;
	}

	/**
	 * Gets CMDs from config file CMD function.
	 */
	async cmds() {
		const cmdFn = await this.cmdFn();
		let cmds = await cmdFn(this.cmdArgs, { se });
		cmds = typeof cmds === 'string' && '' !== cmds ? [cmds] : cmds;

		if (!(cmds instanceof Array)) {
			throw new Error('`' + this.cmdName + '` command has invalid data.');
		}
		return cmds;
	}

	/**
	 * Populates CMD replacement codes.
	 */
	async populateReplacementCodes(cmd) {
		this.cmdArgs._.forEach((v, i) => {
			const pos = String(i + 1);
			const escREPos = this.escRegExp(pos);

			const argValue = se.quote(String(v));
			// Both formats supported for consistency, but always populated by value.

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, argValue).replace(regExpArgValue, argValue);
		});
		for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromCMDArgs))) {
			const prefix = '-'.repeat(1 === n.length ? 1 : 2);
			const escREName = this.escRegExp(prefix + n);

			const argParts = se.quote(prefix + n) + (true === v ? '' : ' ' + se.quote(String(v)));
			const argValue = true === v ? '' : se.quote(String(v));

			cmd = cmd.replace(new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu'), argParts);
			cmd = cmd.replace(new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu'), argValue);
		}
		cmd = cmd.replaceAll('${@}', (/* All arguments. */) => {
			const args = []; // Initialize list of arguments.

			for (const v of this.cmdArgs._) {
				args.push(String(v)); // Positional argument.
			}
			for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromCMDArgs))) {
				const prefix = '-'.repeat(1 === n.length ? 1 : 2);
				const name = prefix + n;

				args.push(name); // Named argument.
				true === v ? null : args.push(String(v));
			}
			return se.quoteAll(args).join(' ');
		});
		// Empty any others remaining that were not filled above.
		return cmd.replace(regexpCMDArgParts, '').replace(regexpCMDArgValues, '');
	}

	/*
	 * Escapes a string for use in a regular expression.
	 */

	escRegExp(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	}
}

/**
 * Utilities.
 */
class u {
	/**
	 * Error utilities.
	 */
	static async error(title, text) {
		if (!isParentTTY || !supportsColor?.has16m) {
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
	}

	/**
	 * Finale utilities.
	 */
	static async finale(title, text) {
		if (!isParentTTY || !supportsColor?.has16m) {
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
	}
}

/**
 * Yargs CLI config. ⛵🏴‍☠
 *
 * @see http://yargs.js.org/docs/
 */
(async () => {
	await yargs(hideBin(process.argv))
		.command({
			command: ['$0'],
			desc: 'Runs one or more commands configured by a mad JS file; in sequence.',
			builder: (yargs) => {
				yargs.check(async (/* args */) => {
					return true;
				});
			},
			handler: async (args) => {
				await new Run(args).run();
			},
		})
		.fail(async (message, error /* , yargs */) => {
			if (error?.stack && typeof error.stack === 'string') err(chalk.gray(error.stack));
			err(await u.error('Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		})
		.parse();
})();
