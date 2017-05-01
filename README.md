# swaddle

Stop writing API wrappers, use `swaddle` instead!

``` javascript
let repos = await api.users('danielstjules').repos.get()
// GET https://api.github.com/users/danielstjules/repos
```

[![Build Status](https://travis-ci.org/danielstjules/swaddle.svg?branch=master)](https://travis-ci.org/danielstjules/swaddle)

* [Overview](#overview)
* [Installation](#installation)
* [Node support](#node-support)
* [Browser support](#browser-support)
* [Options](#options)
  * [fn](#fn)
  * [returnBody](#returnbody)
  * [json](#json)
  * [extension](#extension)
  * [whitelist](#whitelist)

## Overview

The library wraps an API, returning an object that builds the target URL with
each property and invocation. It performs the request when an HTTP method is
invoked. Properties reserved for HTTP methods include: get, post, put, patch,
delete, head, and options.

``` javascript
let swaddle = require('swaddle')
let api = swaddle('https://api.github.com', {
  headers: {'User-Agent': 'request'}, // Required for GitHub API
  json: true, // Parses JSON response bodies
  returnBody: true // Returns the response body instead of response object
})

api.users.get('danielstjules', (err, user) => {
  // GET https://api.github.com/users/danielstjules
  user.public_repos // 35
})

api.users('danielstjules').repos.get((err, repos) => {
  // GET https://api.github.com/users/danielstjules/repos
})

api.search.repositories.get('?q=tetris', (err, repos) => {
  // GET https://api.github.com/search/repositories?q=tetris
});
```

The library is compatible with a range of HTTP request clients,
including:
[`request`](https://github.com/request/request),
[`request-promise`](https://github.com/request-promise),
[`got`](https://github.com/sindresorhus/got),
[`whatwg-fetch`](https://github.com/github/fetch), and
[`node-fetch`](https://github.com/bitinn/node-fetch).

None are installed as a dependency, giving you the freedom to pick your
favorite. Unless provided, it will default to trying to require `request`,
`got`, or the browser's `fetch`, in that order.

``` javascript
let swaddle = require('swaddle')
let got = require('got')
let api = swaddle('https://api.github.com', {
  fn: got // Use `got` to perform requests
})
```

## Installation

``` bash
npm install swaddle
npm install request # optional
```

## Node support

Requires Node 6.4.0+

## Browser support

The library makes use of Proxies, which means it works in Chrome 49+, FF 18+,
Opera 36+, Safari 10+, and Edge. For older browsers, such as IE9+ and Safari 6+,
three things are required:
* Installing a polyfill like
  [`proxy-polyfill`](https://github.com/GoogleChrome/proxy-polyfill)
* Using browserify or webpack to load the module in your build
* Enumerating available properties via `whitelist`

This is because polyfills require that properties you want to proxy be known at
creation time. In a browser with fetch, an example would then be:

``` javascript
var api = swaddle('https://api.github.com', {
  whitelist: ['users', 'repos'],
  returnBody: true,
  json: true
});

// Default to using fetch in the browser
api.users('danielstjules').repos.get().then((repos) => {
  // repos
});

api.search
// Error: search not listed in swaddle's whitelist
```

## Options

Options are passed to the underlying request library in two ways. The first,
is during initialization:

``` javascript
let api = swaddle('https://api.example.com', {
  auth: {
    user: 'username',
    pass: 'password',
    sendImmediately: false
  }
})
```

Any options set during initialization will be stored and inherited by all
requests to that API, unless otherwise overwritten. That is, in the following
request, both basic auth and the custom User-Agent would be set:

``` javascript
api.search.repositories.get('?q=tetris', {
  headers: {'User-Agent': 'request'}
})
```

All options are passed through to the underlying request function,
except for those reserved by swaddle.

### fn

The request function to use. Unless provided, it will default to requiring
`request`, `got`, or the browser's `fetch`, in that order.

``` javascript
let swaddle = require('swaddle')
let request = require('request-promise')
let api = swaddle('https://api.example.com', {
  fn: request
})
```

### returnBody

Returns the response body instead of response object.

``` javascript
let swaddle = require('swaddle')
let api = swaddle('https://api.example.com', {
  returnBody: true
})

api.users.get((err, res) => {
  // Don't need to access res.body
})
```

### json

Parses the JSON response. This is built into some libraries, but not all
(e.g. fetch).

``` javascript
let swaddle = require('swaddle')
let api = swaddle('https://api.example.com', {
  json: true
})

api.users.get((err, res) => {
  // res.body has been parsed
})
```

### extension

Allows you to specify an extension to be appended to any requests,
required by some APIs.

```
let swaddle = require('swaddle')
let api = swaddle('https://api.example.com', {
  extension: 'json'
})

api.search.get('?q=foo', (err, res) => {
  // https://api.example.com/search.json?q=foo
})
```

### whitelist

Whitelists properties that can be accessed. Required when polyfilling Proxy
support for older browsers. Note that the exception is thrown during the
property access, and not during request execution.

``` javascript
var api = swaddle('https://api.example.com', {
  whitelist: ['users']
});

api.users().repos.get((err, res) => {
  // success
});

api.search
// Error: search not listed in swaddle's whitelist
```
