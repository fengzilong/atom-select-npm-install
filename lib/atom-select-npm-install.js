'use babel';

import { CompositeDisposable } from 'atom';
import findDeps from 'atom-selected-requires';
import pkgConf from 'pkg-conf';
import path from 'path';
import relative from 'relative-require-regex';
import core from 'resolve/lib/core.json';
import $ from 'jquery';
import { spawn } from 'child_process';
import { MessagePanelView, PlainMessageView } from 'atom-message-panel';
import split from 'split';
import Combine from 'combine-stream';
import ansiHTML from 'ansi-to-html';
import pkgDir from 'pkg-dir';
import which from 'which';
import isModuleInstalled from './is-module-installed';
import uniqArray from './unique-string-array';

const convert = new ansiHTML({
	newline: false,
	escapeXML: false,
	stream: true
});
const ansiToHtml = content => convert.toHtml( content );

let pos = {
	top: 0,
	left: 0,
};
let deps = [];
let $tooltip;
let tooltipDispose;

const TYPE_DEPENDENCIES = 1;
const TYPE_DEV_DEPENDENCIES = 2;

export default {
	subscriptions: null,
	panel: null,
	cp: null,
	root: null,
	config: {
		npmRegisteryName: {
			type: 'string',
			default: 'npm',
			enum: [ 'npm', 'cnpm' ]
		}
	},

	install( root, deps, type ) {
		if( !root ) {
			atom.notifications.addError('project root not found', {});
			return;
		}

		if( this.cp ) {
			this.cp.kill();
			this.cp = null;
		}

		var npmRegisteryName = atom.config.get( 'atom-select-npm-install.npmRegisteryName' );

		var newPath = process.env.Path + ':/usr/bin/node:/usr/local/bin';
		npmName = process.platform === 'win32' ? `${npmRegisteryName}.cmd` : npmRegisteryName;
		which(npmName, {
			path: newPath
		}, ( err, npm ) => {
			if( err ) {
				console.log( 'err', err );
				return err;
			}

			const cp = spawn(
				npm,
				[ 'install', ...deps, type === TYPE_DEV_DEPENDENCIES ? '-D' : '-S', '-d' ],
				{
					cwd: root,
				}
			);

			const panel = this.panel || new MessagePanelView({
				title: `${npmRegisteryName} install`,
				autoScroll: true
			});

			panel.clear();
			panel.attach();

			const output = new Combine([ cp.stdout, cp.stderr ]);
			output.pipe( split() ).on('data', line => {
				line = ansiToHtml( line ).replace(/ /g, function( match, offset, total ) {
					if( /^ *$/.test( total.slice( 0, offset ) ) ) {
						return '&nbsp;';
					} else {
						return ' ';
					}
				})
				panel.add(new PlainMessageView({
					message: line,
					raw: true
				}));
				panel.updateScroll();
			});

			cp.on('close', function (code) {
				console.log('child process exited with code ' + code);
				if( code === 0 ) {
					panel.toggle();
				}
			});

			this.cp = cp;
			this.panel = panel;
		})
	},

	activate( state ) {
		this.subscriptions = new CompositeDisposable();

		this.subscriptions.add( atom.workspace.onDidStopChangingActivePaneItem(() => {
			if (typeof $tooltip !== 'undefined') {
				$tooltip.remove();
			}
		}) );

		this.subscriptions.add( atom.workspace.observeTextEditors( editor => {
			// only support those file extensions
			if( !/\.(js|jsx|es6|tag|vue)$/.test( editor.getPath() ) ) {
				return;
			}

			const editorElement = atom.views.getView( editor );
			const $editorElement = $( editorElement );
			const $editorScrollElement = $( editorElement.shadowRoot ).find( '.scroll-view' );

			$editorElement.off( 'mousemove' ).on( 'mousemove', e => {
				const offset = $editorElement.offset();
				pos.top = e.pageY;
				pos.left = e.pageX;
			} );

			$editorElement.off( 'mouseup' ).on( 'mouseup', e => {
				if (typeof $tooltip !== 'undefined') {
					$tooltip.remove();
				}
				if (typeof tooltipDispose !== 'undefined') {
					tooltipDispose.dispose();
				}

				if (deps.length > 0) {
					deps = uniqArray( deps );
					$tooltip = $( `
						<div class="tooltip fade bottom in atom-select-npm-install" role="tooltip" style="display: block;">
							<div class="tooltip-arrow" style="left: 50%;"></div>
							<div class="tooltip-inner">
								<div class="J_deps">
									${deps.map(dep => {
										return `
											<div class="tag">
												<div class="checkbox">
													<label for="atom-select-npm-install:${dep}">
														<input id="atom-select-npm-install:${dep}" data-value="${dep}" type="checkbox" checked="checked">
														<div class="setting-title">${dep}</div>
													</label>
												</div>
											</div>
										`;
									}).join('')}
								</div>
								<div class="sep"></div>
								<div class="checkbox">
									<label for="atom-select-npm-install:devDependencies">
										<input class="J_installAsDevDependencies" id="atom-select-npm-install:devDependencies" type="checkbox">
										<div class="setting-title">Install as devDependencies</div>
									</label>
								</div>
								<button class="J_install">install</button>
							</div>
						</div>
					` ).css( {
						top: pos.top + 1,
						left: pos.left + 1,
						transform: 'translateX(-50%)',
						'-webkit-transform': 'translateX(-50%)',
					} ).find( '.J_install' ).on( 'click', () => {
						// filter selected deps
						const $checkboxes = $tooltip.find( '.J_deps input[type="checkbox"]:checked' );
						const checkedDeps = $checkboxes.map(( i, c ) => {
							return c.getAttribute( 'data-value' );
						});

						// dep type
						let type = TYPE_DEPENDENCIES;
						const installAsDevDependencies = $tooltip.find( '.J_installAsDevDependencies' )[0].checked;
						if( installAsDevDependencies ) {
							type = TYPE_DEV_DEPENDENCIES;
						}

						this.install( this.root, checkedDeps, type );
						deps = [];
						$tooltip.remove();
					} ).end();
					$( 'body' ).append( $tooltip );
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

				try {
					deps = findDeps( editor );
				} catch( e ) {
					atom.notifications.addError( `failed to resolve dependencies`, {});
					return;
				}
				deps = deps
					.filter( name => !relative().test( name ) )
					.filter( name => core.indexOf( name ) === -1 )
					.map( dir => dir.split( '/' )[0] )
					// .filter( name => !(name in pkgDeps) )

				this.root = pkgDir.sync( editor.getPath() );
				if( this.root ) {
					deps = deps.filter(name => !isModuleInstalled( name, this.root ));
				}

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
