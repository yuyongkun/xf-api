/*
 * This module provides an object which is simply an alias of the global
 * `console`. Use this module in production code where logging is required,
 * and use the original `console.xxx()` at development time which is marked
 * as lint warnings that should be cleared before pushed to production. For
 * debugging in production, use `debug` module instead.
 */

module.exports = global.console
