let extend = require('extend')
let defaultRequestFn = getDefaultRequestFn()
let camelize = require('underscore.string/camelize')
let underscored = require('underscore.string/underscored')

class Wrapper {
  constructor (client, opts) {
    this._client = client
    this._opts = opts
  }

  static create (url, opts) {
    let client = function () {}
    if (url.match(/\/$/)) {
      url = url.slice(0, -1)
    }
    client._url = url

    if (opts.whitelist) {
      opts.whitelist.forEach((key) => {
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

  apply (client, context, args) {
    // Handle invocations outside of an HTTP method, e.g. client.users(1)
    let url = `${client._url}/${args[0]}`
    return Wrapper.create(url, this._opts)
  }

  get (client, name) {
    let whitelist = this._opts.whitelist
    let createUpdated = () => {
      let url = `${client._url}/${name}`
      return Wrapper.create(url, this._opts)
    }

    if (typeof name === 'string' && this._opts.camelCase) {
      name = underscored(name)
    }

    if (typeof name === 'symbol') {
      // Likely inspecting the object in node where showProxy is false
      return true
    } else if (whitelist && whitelist.indexOf(name) !== -1) {
      return createUpdated()
    } else if (name in client) {
      return client[name]
    } else if (whitelist) {
      let err = new Error(`${name} not listed in swaddle's whitelist`)
      throw err
    } else if (client === this._client) {
      return createUpdated()
    }
  }

  _invokeMethod (client, method, args) {
    let url = client._url
    let urlPart

    if (this._shouldWrapInBody(method, args)) {
      args[0] = {body: args[0]}
    } else if (this._isUrlPart(args[0])) {
      urlPart = args[0]
      args.shift()
    }

    if (!args[0] || typeof args[0] !== 'object') {
      args.unshift({})
    }

    let opts = args[0] = extend(true, {}, this._opts, args[0])
    opts.method = method

    if (opts.extension) {
      if (urlPart == null) {
        url += `.${opts.extension}`
      } else if (urlPart.indexOf('?') === 0) {
        url += `.${opts.extension}${urlPart}`
      } else {
        url += `/${urlPart}.${opts.extension}`
      }
    } else if (urlPart != null) {
      url += `/${urlPart}`
    }

    let returnBody = opts.returnBody
    let fn = opts.fn
    this._updateCamelCaseRequestBody(opts)

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
      req = req.then(res => this._getBody(res, opts.json))
    }

    return req
  }

  _isUrlPart (x) {
    return x != null && (!!x.substring || !!x.toFixed)
  }

  _shouldWrapInBody(method, args) {
    let methods = ['POST', 'PUT', 'PATCH']

    return args.length && this._opts.sendAsBody &&
      typeof args[0] !== 'function' && methods.indexOf(method) !== -1
  }

  _updateCamelCaseRequestBody (opts) {
    if (!opts.camelCase) return

    if (opts.json instanceof Object) {
      // request sets content-type to json when opts.json is an object
      opts.json = this._convertToSnakeCase(opts.json)
      return
    }

    opts.body = this._convertToSnakeCase(opts.body)
    if (opts.fn.name !== 'request') {
      // Need to stringify for got/fetch
      opts.body = JSON.stringify(opts.body)
    }
    opts.headers = opts.headers || {}
    // content-type needs to be set to json when using body
    opts.headers['content-type'] = 'application/json'
  }

  _getBody (res, json) {
    if (!res) return

    // Optionally normalize object keys
    let normalize = (res) => {
      return (this._opts.camelCase) ? this._convertToCamelCase(res) : res
    }

    // Handle whatwg spec fetch. Note that empty response body will cause
    // res.json() to throw, so use res.text() instead
    if (typeof res.text === 'function') {
      if (!json) return res.text()
      return res.text().then((res) => {
        return res ? normalize(JSON.parse(res)) : res
      })
    }

    // Other request libraries, which serialize JSON automatically
    let body = this._isResponseObject(res) ? res.body : res
    return normalize(body)
  }

  _isResponseObject (res) {
    let type = res.constructor.name
    return type === 'IncomingMessage' || type.indexOf('Response') !== -1
  }

  _convertToCamelCase (obj) {
    return this._convertCase(obj, camelize)
  }

  _convertToSnakeCase (obj) {
    return this._convertCase(obj, underscored)
  }

  _convertCase (obj, fn) {
    if (!(obj instanceof Object)) {
      return obj
    }

    Object.keys(obj).forEach((key) => {
      let updated = fn(key)
      if (updated !== key) {
        obj[updated] = obj[key]
        delete obj[key]
      }
      this._convertCase(obj[updated], fn)
    })

    return obj
  }
}

function getDefaultRequestFn (name) {
  let libs = ['request', 'got']
  for (let i = 0; i < libs.length; i++) {
    try {
      return require(libs[i])
    } catch (err) {
      // no-op
    }
  }

  if (typeof window.fetch !== 'undefined') {
    return window.fetch
  }
}

module.exports = function swaddle (url, opts = {}) {
  opts = opts || {}
  opts.fn = opts.fn || defaultRequestFn

  if (!url) {
    let err = new Error('swaddle requires an URL')
    throw err
  }

  if (opts.camelCase && !opts.returnBody && !opts.json) {
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

  return Wrapper.create(url, opts)
}
