'use babel';

export default arr => {
	let tmp = {};
	for( let i = 0, len = arr.length; i < len; i++ ) {
		if( !tmp[ arr[ i ] ] ) {
			tmp[ arr[ i ] ] = true;
		}
	}
	return Object.keys( tmp );
};
