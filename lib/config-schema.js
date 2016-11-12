module.exports = {
	installCommand: {
		title: 'Choose',
		description: 'the command to run with',
		type: 'string',
		default: 'npm',
		enum: [ 'npm', 'cnpm', 'yarn' ]
	}
};
