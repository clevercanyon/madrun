/**
 * Default config file.
 */

import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';

import type { CMDConfigFnRtns, CMDFnArgs, CMDFnCtxUtils } from './resources/cli/cmds/run.js';

export default {
	/**
	 * `$ madrun new [dir] --use [repo]`.
	 */
	'new': async (): Promise<CMDConfigFnRtns> => {
		return {
			cmds: [
				async (args: CMDFnArgs, u: CMDFnCtxUtils): Promise<void> => {
					const args_ = args._ as Array<string | number>;

					if (!String(args_[0] || '')) {
						throw new Error('_[1]: Missing directory.');
					}
					const dir = path.resolve(u.cwd, String(args_[0] || ''));
					const parentDir = path.dirname(dir);

					if (fs.existsSync(dir)) {
						throw new Error('Directory already exists: `' + dir + '`.');
					}
					if (!fs.existsSync(parentDir)) {
						throw new Error('Nonexistent parent directory: `' + parentDir + '`.');
					}
					let use = String(args.use || 'skeleton');
					const branch = String(args.branch || 'main');

					if (use.indexOf('/') === -1) {
						use = 'clevercanyon/' + use;
					}
					if (use.indexOf('//') === -1) {
						use = 'https://github.com/' + use;
					}
					if (!use.endsWith('.git')) {
						use += '.git';
					}
					await u.spawn('git', ['clone', use, dir, '--branch', branch, '--depth=1']);
					await fsp.rm(path.resolve(dir, './.git'), { recursive: true, force: true });

					const madrunFile = await u.findUp(u.configFiles, { cwd: dir, stopAt: dir });
					if (madrunFile && fs.existsSync(madrunFile)) {
						await u.spawn('npx', ['@clevercanyon/madrun', 'on::madrun:default:new'], { cwd: dir });
					}
				},
			],
		};
	},
};
