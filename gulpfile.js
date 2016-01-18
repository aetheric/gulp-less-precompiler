/* global require */
'use strict';

var gulp = require('gulp');
var mocha = require('gulp-mocha');
var utils = require('gulp-util');

gulp.task('test', function(done) {

	gulp.src('src/test/**/*.spec.*')

		.pipe(mocha({
			ui: 'bdd',
			reporter: 'spec',
			bail: false
		}))

		.on('error', utils.log)
		.once('end', done);

});

gulp.task('default', [ 'test' ]);

