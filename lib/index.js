let extend = require('extend')
let Helper = require('./helper')
let defaultRequestFn = getDefaultRequestFn()
let underscored = require('underscore.string/underscored')

class Wrapper {
  /**
   * Creates a new Wrapper given a client (function) and options object.
   * A function is required, over other values such as objects, so that
   * invocations may be proxied and trapped using apply.
   *
   * @constructor
   * @param {function} client
   * @param {object}   opts
   */
  constructor (client, opts) {
    this._client = client
    this._opts = opts
  }

  /**
   * Static factory method that, given an API URL and options object, returns
   * a new Proxy. An instance of the Wrapper class is applied as the handler
   * to a target function.
   *
   * @param   {string} url
   * @param   {object} opts
   * @returns {Proxy}
   */
  static create (url, opts) {
    let client = function () {}
    client._url = Helper.removeTrailingSlash(url)

    if (opts.whitelist) {
      let keys = opts.whitelist
      if (!(keys instanceof Array)) {
        keys = Object.keys(opts.whitelist)
      }

      keys.forEach((key) => {
        client[key] = function () {}
      })
    }

    let wrapper = new Wrapper(client, opts)

    let methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    methods.forEach((method) => {
      client[method] = function () {
        return wrapper._invokeMethod(client, method.toUpperCase(), [...arguments])
      }
    })

    if (opts.aliases) {
      Object.keys(opts.aliases).forEach((key) => {
        let val = opts.aliases[key]
        client[key] = client[val].bind(client)
      })
    }

    return new Proxy(client, wrapper)
  }

  /**
   * Handles invocations outside of HTTP methods, e.g. client.users(1)
   *
   * @param   {function} client
   * @param   {function} context
   * @param   {*[]}      args
   * @returns {Proxy}
   */
  apply (client, context, args) {
    let str = args.join('/')
    let url = `${client._url}/${str}`
    return Wrapper.create(url, this._opts)
  }

  /**
   * Handles property accesses, e.g. client.users
   *
   * @param   {function} client
   * @param   {*}        name
   * @returns {Proxy|function|bool}
   * @throws  Will throw if a whitelist is supplied, and the property name
   *          is not in the list
   */
  get (client, name) {
    let whitelist = this._opts.whitelist

    let createUpdated = (str) => {
      let opts = Object.assign({}, this._opts)
      if (opts.camelCase) str = underscored(str)
      if (opts.whitelist) {
        opts.whitelist = opts.whitelist[str] || []
      }
      let url = `${client._url}/${str}`
      return Wrapper.create(url, opts)
    }

    if (typeof name === 'symbol') {
      // Likely inspecting the object in node where showProxy is false
      return true
    } else if (whitelist && this._inWhitelist(name)) {
      return createUpdated(name)
    } else if (name in client) {
      return client[name]
    } else if (whitelist) {
      let err = new Error(`${name} not listed in swaddle's whitelist`)
      throw err
    } else if (client === this._client) {
      return createUpdated(name)
    }
  }

  /**
   * Invokes the specified HTTP method with the supplied request library.
   * Handles modifications to the result, as well as response body.
   *
   * @param   {function} client
   * @param   {string}   method
   * @param   {*[]}      args
   * @returns {*}
   */
  _invokeMethod (client, method, args) {
    let part
    if (this._shouldWrapInBody(method, args)) {
      args[0] = {body: args[0]}
    } else if (this._isPartOfPath(args[0])) {
      part = args[0]
      args.shift()
    }

    if (!args[0] || typeof args[0] !== 'object') {
      args.unshift({})
    }

    let opts = args[0] = extend(true, {}, this._opts, args[0])
    opts.method = method

    let url = this._buildUrl(client._url, part, opts.extension)
    let returnBody = opts.returnBody
    let fn = opts.fn

    this._updateCamelCaseRequest(opts)
    this._updateJSONRequest(opts)

    let keys = ['returnBody', 'fn', 'whitelist', 'camelCase',
      'extension', 'aliases', 'sendAsBody']
    keys.forEach((key) => delete opts[key])

    args.unshift(url)

    if (returnBody && typeof args[args.length - 1] === 'function') {
      let cb = args[args.length - 1]
      args[args.length - 1] = (err, res) => cb(err, this._getBody(res))
    }

    let req = fn.apply(null, args)

    if (returnBody && req.then) {
      req = req.then(res => this._getBody(res))
    }

    return req
  }

  /**
   * Returns whether or not the string is in the whitelist.
   *
   * @param   {string} str
   * @returns {bool}
   */
  _inWhitelist (str) {
    let whitelist = this._opts.whitelist

    if (!whitelist) {
      return false
    } else if (whitelist instanceof Array) {
      return whitelist.indexOf(str) !== -1
    } else {
      return (str in whitelist)
    }
  }

  /**
   * Returns whether or not a value should be included in an URL's path.
   *
   * @param   {*}    x
   * @returns {bool}
   */
  _isPartOfPath (x) {
    return x != null && (!!x.substring || !!x.toFixed)
  }

  /**
   * Returns whether or not the data passed to the current invocation should
   * be nested in a body attribute, as specified by the sendAsBody option.
   *
   * @param   {string} method
   * @param   {*[]}    args
   * @returns {bool}
   */
  _shouldWrapInBody (method, args) {
    let methods = ['POST', 'PUT', 'PATCH']

    return args.length && this._opts.sendAsBody &&
      typeof args[0] !== 'function' && methods.indexOf(method) !== -1
  }

  /**
   * Returns the final request url, based on the current client url,
   * a part to append to the path, as well as an optional file extension.
   *
   * @param   {string} url
   * @param   {string} part
   * @param   {string} extensions
   * @returns {string}
   */
  _buildUrl (url, part, extension) {
    if (extension) {
      if (part == null) {
        url += `.${extension}`
      } else if (part.indexOf('?') === 0) {
        url += `.${extension}${part}`
      } else {
        url += `/${part}.${extension}`
      }
    } else if (part != null) {
      if (part.indexOf('?') === 0) {
        url += part
      } else {
        url += `/${part}`
      }
    }
    return url
  }

  /**
   * If the camelCase option was enabled, renames all camelCase keys in the
   * request body object to be snake_case.
   *
   * @param {object} opts
   */
  _updateCamelCaseRequest (opts) {
    if (!opts.camelCase) return

    if (opts.json instanceof Object) {
      // request sets content-type to json when opts.json is an object
      return Helper.convertToSnakeCase(opts.json)
    } else if (!('body' in opts)) {
      return
    }

    Helper.convertToSnakeCase(opts.body)
  }

  /**
   * If the json option was enabled, serializes the request body and adds
   * a content-type header.
   *
   * @param {object} opts
   */
  _updateJSONRequest (opts) {
    if (!opts.json || !('body' in opts)) return

    if (opts.fn.name.toLowerCase() === 'fetch') {
      // Need to stringify for fetch
      opts.body = JSON.stringify(opts.body)
    }

    // content-type needs to be set to json when using body
    opts.headers = opts.headers || {}
    opts.headers['content-type'] = 'application/json'
  }

  /**
   * Returns the body of the response. For fetch and fetch-compliant libraries,
   * returns a promise that resolves to the body. If the json opt is truthy,
   * the response body is parsed. If camelCase was true, it's also converted.
   *
   * @param   {*} res
   * @returns {*}
   */
  _getBody (res) {
    if (!res) return

    // Optionally normalize object keys
    let normalize = (res) => {
      return (this._opts.camelCase) ? Helper.convertToCamelCase(res) : res
    }

    // Handle whatwg spec fetch. Note that empty response body will cause
    // res.json() to throw, so use res.text() instead
    if (typeof res.text === 'function') {
      if (!this._opts.json) return res.text()
      return res.text().then((res) => {
        return res ? normalize(JSON.parse(res)) : res
      })
    }

    // Other request libraries, which serialize JSON automatically
    let body = this._isResponseObject(res) ? res.body : res
    return normalize(body)
  }

  /**
   * Returns whether or not an object is a response object, based on the
   * internal classes used by got, request, and fetch.
   *
   * @param   {*} res
   * @returns {bool}
   */
  _isResponseObject (res) {
    let hasReadableState = res._readableState instanceof Object &&
      res._readableState.constructor.name === 'ReadableState'
    let type = res.constructor.name

    return hasReadableState ||
      type === 'IncomingMessage' ||
      type.indexOf('Response') !== -1
  }
}

/**
 * Attempts to require and return request, got, or the window.fetch function,
 * in that order.
 *
 * @returns {function}
 */
function getDefaultRequestFn () {
  let libs = ['got', 'request-promise', 'request']
  for (let i = 0; i < libs.length; i++) {
    try {
      return require(libs[i])
    } catch (err) {
      // no-op
    }
  }

  if (typeof window !== 'undefined') {
    return window.fetch
  }
}

module.exports = function swaddle (url, opts = {}) {
  opts = opts || {}
  opts.fn = opts.fn || defaultRequestFn
  opts.headers = opts.headers || {}

  let defaultTrue = ['json', 'returnBody']
  defaultTrue.forEach((key) => {
    if (key in opts) return
    opts[key] = true
  })

  if (!url) {
    let err = new Error('swaddle requires an URL')
    throw err
  }

  if (opts.camelCase && (!opts.returnBody || !opts.json)) {
    let err = new Error('camelCase must be used with returnBody and json')
    throw err
  }

  if (!opts.fn) {
    let err = new Error(`swaddle requires one of the following:
      * request is installed (npm install --save request)
      * got is installed (npm install --save got)
      * that fetch be available in the browser
      * a request function is supplied via the "fn" option`)
    throw err
  }

  if (!opts.headers['User-Agent']) {
    opts.headers['User-Agent'] = 'swaddle'
  }

  return Wrapper.create(url, opts)
}
