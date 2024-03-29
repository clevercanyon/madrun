#!/usr/bin/env node
/**
 * Utilities.
 */

import type * as $yargs from '@clevercanyon/utilities.node/yargs';

/**
 * `$ madrun` pkg name & version.
 */
export const appPkgName = $$__APP_PKG_NAME__$$;
export const appPkgVersion = $$__APP_PKG_VERSION__$$;

/**
 * `$ madrun` config file names.
 */
export const configFilesGlob = '{madrun.config,.madrun}.{mjs,cjs,js,json}';
export const configFiles = ['madrun.config.mjs', '.madrun.mjs', 'madrun.config.cjs', '.madrun.cjs', 'madrun.config.js', '.madrun.js', 'madrun.config.json', '.madrun.json'];

/**
 * Argument types and utilities.
 */
export type AllArgs = $yargs.Args<{ madrunHelp: boolean; madrunVersion: boolean; madrunDebug: boolean }>;
export type Args = Omit<AllArgs, '$0' | 'madrunHelp' | 'madrunVersion' | 'madrunDebug'>;
export const omitFromNamedArgs = ['$0', '_', 'madrunHelp', 'madrunVersion', 'madrunDebug'];

/**
 * Propagates user environment variables.
 */
export const propagateUserEnvVars = async (): Promise<void> => {
    process.env.NPM_TOKEN = process.env.USER_NPM_TOKEN || '';
    process.env.GH_TOKEN = process.env.USER_GITHUB_TOKEN || '';
    process.env.GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN || '';
    process.env.CLOUDFLARE_API_TOKEN = process.env.USER_CLOUDFLARE_TOKEN || '';
};
