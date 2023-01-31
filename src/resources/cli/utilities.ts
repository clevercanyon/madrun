#!/usr/bin/env node
/**
 * Utilities.
 */

declare const $$__APP_PKG_VERSION__$$: string;
import type { Args as $yargsꓺArgs } from '@clevercanyon/utilities.node/yargs';

/**
 * `$ madrun` version.
 */
export const version = $$__APP_PKG_VERSION__$$;

/**
 * `$ madrun` config file names.
 */
export const configFilesGlob = '.madrun.{json,js,cjs,mjs}';
export const configFiles = ['.madrun.json', '.madrun.js', '.madrun.cjs', '.madrun.mjs'];

/**
 * Argument types and utilities.
 */
export type Args = $yargsꓺArgs<{ madrunHelp: boolean; madrunVersion: boolean; madrunDebug: boolean }>;
export type CMDArgs = Omit<Args, '$0' | 'madrunHelp' | 'madrunVersion' | 'madrunDebug'>;
export const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrunVersion', 'madrunDebug'];

/**
 * Propagates user environment variables.
 */
export const propagateUserEnvVars = async (): Promise<void> => {
	process.env.NPM_TOKEN = process.env.USER_NPM_TOKEN || '';
	process.env.GH_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN || '';
	process.env.CLOUDFLARE_API_TOKEN = process.env.USER_CLOUDFLARE_TOKEN || '';
};
