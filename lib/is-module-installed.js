'use babel';

import path from 'path';
import jetpack from 'fs-jetpack';

const getInstalledModules = root => {
	const paths = jetpack.list( path.resolve(root, 'node_modules') );
	return paths;
};

export default ( name, root ) => {
	const installed = getInstalledModules( root );
	if( installed && ~installed.indexOf( name ) ) {
		return true;
	}
	return false;
}
