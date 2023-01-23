export default {
	test: async (args, { se }) => {
		return 'echo ' + se.quote( args._[0] || '' );
	}
}
