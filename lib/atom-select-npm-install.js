'use babel';

import AtomSelectNpmInstallView from './atom-select-npm-install-view';
import { CompositeDisposable } from 'atom';
import findDeps from 'atom-selected-requires';
import pkgConf from 'pkg-conf';
import path from 'path';
import relative from 'relative-require-regex';
import core from 'resolve/lib/core.json';
import $ from 'jquery';

let pos = {
	top: 0,
	left: 0,
};
let deps = [];
let $tooltip;
let tooltipDispose;

export default {
	subscriptions: null,

	activate( state ) {
		this.subscriptions = new CompositeDisposable();

		// const treeViewPkg = atom.packages.getActivePackage('tree-view');
		// const $treeView = treeViewPkg.mainModule.treeView;

		this.subscriptions.add( atom.workspace.observeTextEditors( editor => {
			const editorElement = atom.views.getView( editor );
			const $editorElement = $( editorElement );
			const $editorScrollElement = $( editorElement.shadowRoot ).find( '.scroll-view' );

			$editorElement.off( 'mousemove' ).on( 'mousemove', e => {
				const offset = $editorElement.offset();
				pos.top = e.pageY - offset.top;
				pos.left = e.pageX - offset.left;
			} );

			$editorElement.off( 'mouseup' ).on( 'mouseup', e => {
				console.log( deps );
				if (typeof $tooltip !== 'undefined') {
					$tooltip.remove();
				}
				if (typeof tooltipDispose !== 'undefined') {
					tooltipDispose.dispose();
				}

				if (deps.length > 0) {
					$tooltip = $( '<div />' ).css( {
						width: 0,
						height: 0,
						top: pos.top + 1,
						left: pos.left + 1
					} );
					$( editorElement ).parent().append( $tooltip );
					tooltipDispose = atom.tooltips.add( $tooltip[0], {
						placement: 'auto bottom',
						trigger: 'manual',
						title: 'title'
					} );
				}
			} );

			this.subscriptions.add( editor.onDidChangeSelectionRange( e => {
				const bufferRange = e.newBufferRange;
				const cursor = e.selection.cursor;

				deps = [];

				if (bufferRange.isEmpty()) {
					return;
				}
				const content = editor.getTextInBufferRange( bufferRange );
				if (!content.includes( 'require' ) && !content.includes( 'import' )) {
					return;
				}

				deps = findDeps( editor );
				deps = deps
					.filter( name => !relative().test( name ) )
					.filter( name => core.indexOf( name ) === -1 )
					.map( dir => dir.split( '/' )[0] )
					// .filter( name => !(name in pkgDeps) )

				console.log( 'deps', deps );

			// const filepath = editor.getPath();
			// const cwd = path.dirname( filepath );
			//
			// Promise.all( [
			// 	pkgConf( 'dependencies', {
			// 		cwd
			// 	} ),
			// 	pkgConf( 'devDependencies', {
			// 		cwd
			// 	} ),
			// ] ).then( ret => {
			// 	const pkgDeps = [
			// 		...Object.keys( ret[0] ),
			// 		...Object.keys( ret[1] )
			// 	];
			//
			// 	console.log( 'pkgDeps', pkgDeps );
			// } );
			} ) );
		} ) );
	},

	deactivate() {
		this.subscriptions.dispose();
	},

	serialize() {
		return {};
	},
};
