/* global require, process, Buffer */
'use strict';

var through2 = require('through2');
var gutil = require('gulp-util');
var readline = require('readline');
var files = require('fs');
var paths = require('path');
var StringBuilder = require('stringbuilder');
var File = require('vinyl');
var sourcemaps = require('vinyl-sourcemaps-apply');
var from = require('new-from');

var REGEX_IMPORT = new RegExp('@import [\'"](.+?)[\'"];');

/**
 *
 * @param {File} file
 * @param {Promise<Buffer>} promise
 * @param {Object} context
 * @param {Boolean} debug Whether to display debug messages during work.
 * @returns {Promise<Buffer>}
 */
function scanFile(file, promise, context, debug) {
	return new Promise(function(resolve, reject) {

		var target = file.path;

		// Make sure the file hasn't already been processed
		if (context[target]) {
			promise.then(resolve, reject);
		}

		// Add target file to the context to avoid repeats.
		context[target] = file;

		// Start the promise chain.
		var lastPromise = promise;

		var lineStream = readline.createInterface({
			input: files.createReadStream(target),
			terminal: false
		});

		lineStream.on('line', function(line) {
			lastPromise = lastPromise.then(function(builder) {

				var matches = REGEX_IMPORT.exec(line);
				if (!matches) {

					if (debug) {
						gutil.log('=> ' + line);
					}

					return builder.appendLine(line);

				}

				var filename = matches[1];
				if (!paths.extname(filename)) {
					filename += '.less';
				}

				var fileDir = paths.dirname(file.path);
				var targetPath = paths.resolve(fileDir, filename);
				var targetFile = new File({
					path: targetPath,
					history: [ targetPath ],
					cwd: file.cwd,
					base: file.base
				});

				return scanFile(targetFile, promise, context, debug);

			});
		});

		lineStream.on('error', function(error) {
			gutil.log('Stream error');
			reject(error);
		});

		lineStream.on('close', function() {
			lastPromise.then(resolve).catch(reject);
		});

	});
}

/**
 * @param {File} file
 * @param {Boolean} debug Whether to display debug messages during work.
 * @returns {Promise<Buffer>}
 **/
function startScan(file, debug) {
	gutil.log('Starting style precompilation with ' + file.path);
	return scanFile(file, Promise.resolve(new StringBuilder()), [], debug);
}

/**
 * Creates a new precompiler for use in a gulp workflow.
 * @param {Object} [options] The plugin options.
 * @param {Boolean} [options.debug] Whether to log debug messages.
 */
module.exports = function lessPrecompiler(options) {

	var config = {

		debug: options
			&& options.debug,

		sourceMaps: options
			? options.sourceMaps !== false
			: true,

		push: options
			&& options.push

	};

	var finished = false;
	var pending = 0;
	var stream;

	function tryClose() {

		if (!finished || pending > 0) {
			return;
		}

		process.nextTick(function() {
			stream.emit('end');
			process.nextTick(function() {
				stream.emit('close');
			});
		});

	}

	function write(file, encoding, done) {
		var self = this;

		if (file.isNull() || !file.isBuffer() || !file.isStream() || !file.path.match(/\.less$/)) {
			done(null, file);
		}

		pending++;

		startScan(file, config.debug).then(function(builder) {
			return builder.build(function(error, result) {

				if (error) {
					return done(error);
				}

				file.clone();

				files.truncate(file.path, 0, function(error) {

					if (error) {
						return done(error);
					}

					file.content = file.isBuffer()
							? new Buffer(result)
							: from([ result ]);

					if (config.sourceMaps && file.sourceMap) {
						sourcemaps(file, result.map);
					}

					self.push(file, done);
					tryClose(--pending);

				});

			});
		}).catch(function(error) {
			gutil.log('Scan failed: ' + error.stack);
			done(error);
		});

	}

	stream = through2.obj(write, function() {
		tryClose(finished = true);
	});

	return stream;

};
