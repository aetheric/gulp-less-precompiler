/* global require, describe, it, Promise */
'use strict';

var assert = require('assert');
var vinyl = require('vinyl-fs');
var files = require('fs');
var gutil = require('gulp-util');
var eol = require('eol');

var precompiler = require('../..');

describe('The gulp-less-precompiler', function() {

	describe('when reading vinyl files', function() {

		var expected = new Promise(function(resolve, reject) {
			files.readFile('src/test/files/expected.less', function(error, result) {
				return error ? reject(error) : resolve(result);
			});
		});

		it('should replace imports in less files', function(done) {

			vinyl.src('src/test/files/one.less')

				.pipe(precompiler())

				.once('data', function(file) {
					gutil.log('File received: ' + file.path);
					expected.then(function(result) {

						var left = eol.auto(file.contents.toString('utf8'));
						var right = eol.auto(result.toString('utf8'));
						assert.equal(left, right);

						done();

					}).catch(function(error) {
						done(error);

					})
				})

				.on('error', gutil.log);

		});

	});

});
