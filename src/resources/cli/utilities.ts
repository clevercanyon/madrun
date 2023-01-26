#!/usr/bin/env node
/**
 * CLI.
 */

import coloredBox from 'boxen';
import chalk, { supportsColor } from 'chalk';

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
