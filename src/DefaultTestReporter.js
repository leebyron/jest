/**
 * Copyright (c) 2014, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var colors = require('./lib/colors');
var path = require('path');

var FAIL_COLOR = colors.RED_BG + colors.BOLD;
var PASS_COLOR = colors.GREEN_BG + colors.BOLD;
var TEST_NAME_COLOR = colors.BOLD;

// A RegExp that matches paths that should not be included in error stack traces
// (mostly because these paths represent noisy/unhelpful libs)
var STACK_TRACE_LINE_IGNORE_RE = new RegExp('^(?:' + [
    path.resolve(__dirname, '..', 'node_modules', 'q'),
    path.resolve(__dirname, '..', 'vendor', 'jasmine')
].join('|') + ')');

function _printConsoleMessage(process, msg) {
  switch (msg.type) {
    case 'dir':
    case 'log':
      process.stdout.write(msg.data);
      break;
    case 'warn':
      process.stderr.write(
        colors.colorize(msg.data, colors.YELLOW)
      );
      break;
    case 'error':
      process.stderr.write(
        colors.colorize(msg.data, colors.RED)
      );
      break;
    default:
      throw new Error('Unknown console message type!: ' + msg.type);
  }
}

function _getResultHeader(passed, testName, columns) {
  var passFailTag = passed
    ? colors.colorize(' PASS ', PASS_COLOR)
    : colors.colorize(' FAIL ', FAIL_COLOR);

  return [
    passFailTag,
    colors.colorize(testName, TEST_NAME_COLOR)
  ].concat(columns || []).join(' ');
}

function _printWaitingOn(process, aggregatedResults) {
  var completedTests =
    aggregatedResults.numPassedTests +
    aggregatedResults.numFailedTests;
  var remainingTests = aggregatedResults.numTotalTests - completedTests;
  if (remainingTests > 0) {
    var pluralTests = remainingTests === 1 ? 'test' : 'tests';
    process.stdout.write(
      colors.colorize(
        'Waiting on ' + remainingTests + ' ' + pluralTests + '...',
        colors.GRAY + colors.BOLD
      )
    );
  }
}

function _clearWaitingOn(process) {
  process.stdout.write('\r\x1B[K');
}

function DefaultTestReporter(customProcess) {
  this.process = customProcess || process;
}

DefaultTestReporter.prototype.log = function(str) {
  this.process.stdout.write(str + '\n');
};

DefaultTestReporter.prototype.onRunStart =
function(config, aggregatedResults) {
  _printWaitingOn(this.process, aggregatedResults);
};

DefaultTestReporter.prototype.onTestResult =
function(config, testResult, aggregatedResults) {
  _clearWaitingOn(this.process);

  var pathStr =
    config.rootDir
    ? path.relative(config.rootDir, testResult.testFilePath)
    : testResult.testFilePath;

  if (testResult.testExecError) {
    this.log(_getResultHeader(false, pathStr));
    this.log(testResult.testExecError);
    return false;
  }

  var allTestsPassed = testResult.numFailingTests === 0;

  var testRunTime =
    testResult.perfStats
    ? (testResult.perfStats.end - testResult.perfStats.start) / 1000
    : null;

  var testRunTimeString = '(' + testRunTime + 's)';
  if (testRunTime > 2.5) {
    testRunTimeString = colors.colorize(testRunTimeString, FAIL_COLOR);
  }

  /*
  if (config.collectCoverage) {
    // TODO: Find a nice pretty way to print this out
  }
  */

  this.log(_getResultHeader(allTestsPassed, pathStr, [
    testRunTimeString
  ]));

  testResult.logMessages.forEach(function (message) {
    _printConsoleMessage(this.process, message);
  });

  if (!allTestsPassed) {
    var ancestrySeparator = ' \u203A ';
    var descBullet = colors.colorize('\u25cf ', colors.BOLD);
    var msgBullet = '  - ';
    var msgIndent = msgBullet.replace(/./g, ' ');

    testResult.testResults.forEach(function(result) {
      if (result.failureMessages.length === 0) {
        return;
      }

      var testTitleAncestry =
        result.ancestorTitles.map(function(title) {
          return colors.colorize(title, colors.BOLD);
        }).join(ancestrySeparator) + ancestrySeparator;

      this.log(descBullet + testTitleAncestry + result.title);

      result.failureMessages.forEach(function(errorMsg) {
        // Filter out q and jasmine entries from the stack trace.
        // They're super noisy and unhelpful
        errorMsg = errorMsg.split('\n').filter(function(line) {
          if (/^\s+at .*?/.test(line)) {
            // Extract the file path from the trace line
            var filePath = line.match(/(?:\(|at (?=\/))(.*):[0-9]+:[0-9]+\)?$/);
            if (filePath
                && STACK_TRACE_LINE_IGNORE_RE.test(filePath[1])) {
              return false;
            }
          }
          return true;
        }).join('\n');
        this.log(msgBullet + errorMsg.replace(/\n/g, '\n' + msgIndent));
      });
    });
  }

  _printWaitingOn(this.process, aggregatedResults);
};

DefaultTestReporter.prototype.onRunComplete =
function (config, aggregatedResults) {
  var numFailedTests = aggregatedResults.numFailedTests;
  var numPassedTests = aggregatedResults.numPassedTests;
  var numTotalTests = aggregatedResults.numTotalTests;
  var runTime = aggregatedResults.runTime;

  var results = '';
  if (numFailedTests) {
    results += colors.colorize(
      numFailedTests + ' test' + (numFailedTests === 1 ? '' : 's') + ' failed',
      colors.RED + colors.BOLD
    );
    results += ', ';
  }
  results += colors.colorize(
    numPassedTests + ' test' + (numPassedTests === 1 ? '' : 's') + ' passed',
    colors.GREEN + colors.BOLD
  );
  results += ' (' + numTotalTests + ' total)';

  this.log(results);
  this.log('Run time: ' + runTime + 's');
};

module.exports = DefaultTestReporter;
