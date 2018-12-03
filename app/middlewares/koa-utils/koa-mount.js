///
/// This module is forked from koa-mount.
///
/// Frank Shaka has modified this module so that it sets back
/// original paths correctly regardless of exceptions.
///

/**
 * Module dependencies.
 */

const debug = require('debug')('koa-mount')
const compose = require('koa-compose')
const assert = require('assert')

/**
 * Expose `mount()`.
 */

module.exports = mount

/**
 * Mount `app` with `prefix`, `app`
 * may be a Koa application or
 * middleware function.
 *
 * @param {String|Application|Function} prefix, app, or function
 * @param {Application|Function} [app or function]
 * @return {Function}
 * @api public
 */

function mount(prefix, app) {
  if ('string' != typeof prefix) {
    app = prefix
    prefix = '/'
  }

  assert('/' == prefix[0], 'mount path must begin with "/"')

  // compose
  const downstream = app.middleware
    ? compose(app.middleware)
    : app

  // don't need to do mounting here
  if ('/' == prefix) return downstream

  const trailingSlash = '/' == prefix.slice(-1)

  const name = app.name || 'unnamed'
  debug('mount %s %s', prefix, name)

  return async function (ctx, upstream) {
    const prev = ctx.path
    const newPath = match(prev)
    debug('mount %s %s -> %s', prefix, name, newPath)
    if (!newPath) return await upstream()

    ctx.mountPath = prefix
    ctx.mountPaths = (ctx.mountPaths || []).concat([prefix])
    ctx.path = newPath
    debug('enter %s -> %s', prev, ctx.path)

    try {
      await downstream(ctx, async () => {
        ctx.path = prev
        try {
          await upstream()
        } finally {
          ctx.path = newPath
        }
      })
    } finally {
      debug('leave %s -> %s', prev, ctx.path)
      ctx.path = prev
    }
  }

  /**
   * Check if `prefix` satisfies a `path`.
   * Returns the new path.
   *
   * match('/images/', '/lkajsldkjf') => false
   * match('/images', '/images') => /
   * match('/images/', '/images') => false
   * match('/images/', '/images/asdf') => /asdf
   *
   * @param {String} prefix
   * @param {String} path
   * @return {String|Boolean}
   * @api private
   */

  function match(path) {
    // does not match prefix at all
    if (0 != path.indexOf(prefix)) return false

    const newPath = path.replace(prefix, '') || '/'
    if (trailingSlash) return newPath

    // `/mount` does not match `/mountlkjalskjdf`
    if ('/' != newPath[0]) return false
    return newPath
  }
}
