let extend = require('extend')
let defaultRequestFn = getDefaultRequestFn()

class Wrapper {
  constructor (api, opts) {
    this._api = api
    this._opts = opts
  }

  static create (url, opts) {
    let api = function () {}
    if (url.match(/\/$/)) {
      url = url.slice(0, -1)
    }
    api._url = url

    if (opts.whitelist) {
      opts.whitelist.forEach((key) => {
        api[key] = function() {}
      })
    }

    let wrapper = new Wrapper(api, opts)

    let methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    methods.forEach((method) => {
      api[method] = function () {
        return wrapper._invokeMethod(api, method.toUpperCase(), [...arguments])
      }
    })

    return new Proxy(api, wrapper)
  }

  apply (api, context, args) {
    // Handle invocations outside of an HTTP method, e.g. api.users(1)
    let url = `${api._url}/${args[0]}`
    return Wrapper.create(url, this._opts)
  }

  get (api, name) {
    let whitelist = this._opts.whitelist
    let createUpdated = () => {
      let url = `${api._url}/${name}`
      return Wrapper.create(url, this._opts)
    }

    if (typeof name === 'symbol') {
      // Likely inspecting the object in node where showProxy is false
      return true
    } else if (whitelist && whitelist.indexOf(name) !== -1) {
      return createUpdated()
    } else if (name in api) {
      return api[name]
    } else if (whitelist) {
      let err = new Error(`${name} not listed in swaddle's whitelist`)
      throw err
    } else if (api === this._api) {
      return createUpdated()
    }
  }

  _invokeMethod (api, method, args) {
    let url = api._url
    let urlPart;

    if (this._isUrlPart(args[0])) {
      urlPart = args[0]
      args.shift()
    }

    if (!args[0] || typeof args[0] !== 'object') {
      args.unshift({})
    }

    let opts = args[0] = extend(true, this._opts, args[0])
    opts.method = method

    if (opts.extension) {
      if (urlPart.indexOf('?') === 0) {
        url += `.${opts.extension}${urlPart}`
      } else {
        url += `/${urlPart}.${opts.extension}`
      }
      delete opts.extension
    } else {
      url += `/${urlPart}`
    }

    let returnBody = opts.returnBody
    let fn = opts.fn
    delete opts.returnBody
    delete opts.fn
    delete opts.whitelist

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

  _getBody (res, json) {
    // Handle whatwg spec fetch
    if (typeof res.json === 'function') {
      return json ? res.json() : res.text()
    }

    // Other request libraries, which serialize JSON automatically
    return this._isResponseObject(res) ? res.body : res
  }

  _isResponseObject (res) {
    let type = res.constructor.name
    return type === 'IncomingMessage' || type.indexOf('Response') !== -1
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

  if (typeof fetch !== 'undefined') {
    return fetch
  }
}

module.exports = function swaddle (url) {
  let args = [...arguments]
  let opts, fn

  if (args[1] instanceof Function) {
    fn = args[1]
  } else {
    [opts, fn] = args.slice(1, 3)
  }

  opts = opts || {}
  opts.fn = fn || defaultRequestFn

  if (!opts.fn) {
    var err = new Error(`swaddle requires one of the following:
      * request is installed (npm install --save request)
      * got is installed (npm install --save got)
      * that fetch be available in the browser
      * a request function is supplied via the "fn" option`)
    throw err
  }

  return Wrapper.create(url, opts)
}
