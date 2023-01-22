export default {
	test: (args, { se }) => {
		return 'echo ' + se.quote( args._[0] || '' );
	}
}
