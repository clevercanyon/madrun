#!/usr/bin/env node
/**
 * `$ madrun` CLI config.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 */
/* eslint-env es2021, node */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { dirname } from 'desm';
import path from 'node:path';

import u from '../../bin/includes/utilities.mjs';

const __dirname = dirname(import.meta.url);
const projDir = path.resolve(__dirname, '../../../..');

export default {
	'on::madrun:default:new': [
		/**
		 * Installs new project.
		 */
		'npx @clevercanyon/madrun install project',

		/**
		 * Configures new project.
		 */
		async (args) => {
			/**
			 * Propagates `USER_` env vars.
			 */

			await u.propagateUserEnvVars(); // i.e., `USER_` env vars.

			/**
			 * Deletes Dotenv Vault associated with template.
			 */

			await fsp.rm(path.resolve(projDir, './.env.me'), { force: true });
			await fsp.rm(path.resolve(projDir, './.env.vault'), { force: true });

			/**
			 * Initializes a few variables.
			 */

			const dirBasename = path.basename(projDir);
			const parentDir = path.dirname(projDir); // One level up.
			const parentDirBasename = path.basename(parentDir);

			/**
			 * Updates `./package.json` in new project directory.
			 */

			await u.updatePkg({
				name: args.pkgName || '@' + parentDirBasename + '/' + dirBasename,
				repository: 'https://github.com/' + u.encURI(parentDirBasename) + '/' + u.encURI(dirBasename),
				homepage: 'https://github.com/' + u.encURI(parentDirBasename) + '/' + u.encURI(dirBasename) + '#readme',
				bugs: 'https://github.com/' + u.encURI(parentDirBasename) + '/' + u.encURI(dirBasename) + '/issues',

				$unset: /* Effectively resets these to default values. */ [
					'private', //
					'publishConfig.access',

					'version',
					'license',
					'description',
					'funding',
					'keywords',

					'author',
					'contributors',

					'config.c10n.&.github.teams',
					'config.c10n.&.github.labels',
					'config.c10n.&.github.configVersion',
					'config.c10n.&.github.envsVersion',

					'config.c10n.&.npmjs.teams',
					'config.c10n.&.npmjs.configVersions',
				],
				...(args.pkg ? { $set: { private: false } } : {}),
				...(args.pkg && args.public ? { $set: { 'publishConfig.access': 'public' } } : {}),
			});

			/**
			 * Updates `./README.md` file in new project directory.
			 */

			const readmeFile = path.resolve(projDir, './README.md');
			let readme = fs.readFileSync(readmeFile).toString(); // Markdown.

			readme = readme.replace(/@clevercanyon\/[^/?#\s]+/gu, args.pkgName || '@' + parentDirBasename + '/' + dirBasename);
			await fsp.writeFile(readmeFile, readme); // Updates `./README.md` file.

			/**
			 * Initializes this as a new git repository.
			 */
			await u.spawn('git', ['init']);

			/**
			 * Updates Vite build after the above changes.
			 */

			if (await u.isViteBuild()) await u.viteBuild();

			/**
			 * Saves changes made here as first initial commit.
			 */

			await u.gitAddCommit('Initializing project directory. [n]');

			/**
			 * Attempts to create a remote repository origin at GitHub; if at all possible.
			 */

			if ('clevercanyon' === parentDirBasename) {
				if (process.env.GH_TOKEN && 'owner' === (await u.gistGetC10NUser()).github?.role) {
					await u.spawn('gh', ['repo', 'create', parentDirBasename + '/' + dirBasename, '--source=.', args.public ? '--public' : '--private'], { stdio: 'inherit' });
				} else {
					const origin = 'https://github.com/' + u.encURI(parentDirBasename) + '/' + u.encURI(dirBasename) + '.git';
					await u.spawn('git', ['remote', 'add', 'origin', origin], { stdio: 'inherit' });
				}
			} else if (process.env.USER_GITHUB_USERNAME === parentDirBasename) {
				if (process.env.GH_TOKEN) {
					await u.spawn('gh', ['repo', 'create', parentDirBasename + '/' + dirBasename, '--source=.', args.public ? '--public' : '--private'], { stdio: 'inherit' });
				} else {
					const origin = 'https://github.com/' + u.encURI(parentDirBasename) + '/' + u.encURI(dirBasename) + '.git';
					await u.spawn('git', ['remote', 'add', 'origin', origin], { stdio: 'inherit' });
				}
			}

			/**
			 * Signals completion with success.
			 */

			u.log(await u.finale('Success', 'New project ready.'));
		},
	],
};