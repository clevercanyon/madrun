/**
 * Module.
 */

declare module 'spawn-please' {
	export default function spawn(cmd: string, args: string[], opts: { [x: string]: unknown }): Promise<string>;
}
