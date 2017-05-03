<h1 align="center">
  <img height="150" src="https://cloud.githubusercontent.com/assets/817212/25590381/5e0275c6-2e7e-11e7-9874-09e03071300b.png" alt="swaddle">
  <br>
  <br>
  <br>
</h1>

Automagically create API clients/wrappers in JavaScript. This is a great
alternative for when client libraries don't already exist, and they can't be
easily generated from a swagger API.


``` javascript
let repos = await github.users('octocat').repos.get()
// GET https://api.github.com/users/octocat/repos
```

[![Build Status](https://travis-ci.org/danielstjules/swaddle.svg?branch=master)](https://travis-ci.org/danielstjules/swaddle)

* [Overview](#overview)
* [Installation](#installation)
* [Options](#options)
  * [aliases](#aliases)
  * [fn](#fn)
  * [returnBody](#returnbody)
  * [sendAsBody](#sendasbody)
  * [json](#json)
  * [camelCase](#camelcase)
  * [extension](#extension)
  * [whitelist](#whitelist)
* [Node support](#node-support)
* [Browser support](#browser-support)

## Overview

The library wraps an API, returning an object that builds the target URL with
each property and invocation. It performs the request when an HTTP method is
invoked. Properties reserved for HTTP methods include: get, post, put, patch,
delete, head, and options.

The library also comes with some sane defaults for JSON APIs. Two options are
set to true by default: json and returnBody. JSON response bodies are parsed,
and the response body itself is returned instead of the response object.
In the example below, we also make use of the camelCase option, which creates
a camelCase client for a snake_case JSON API.

``` javascript
let swaddle = require('swaddle')
let github = swaddle('https://api.github.com', {camelCase: true})

github.users.get('octocat', (err, user) => {
  // GET https://api.github.com/users/octocat
  user.publicRepos // instead of user.public_repos
})

github.users('octocat').repos.get((err, repos) => {
  // GET https://api.github.com/users/octocat/repos
})

github.repos('octocat', 'Spoon-Knife').stargazers.get((err, stargazers) => {
  // GET https://api.github.com/repos/octocat/Spoon-Knife/stargazers
})

github.search.repositories.get('?q=tetris', (err, repos) => {
  // GET https://api.github.com/search/repositories?q=tetris
});

// Identical operations, both perform
// GET https://api.example.com/users/octocat
github.users('octocat').get()
github.users().get('octocat')
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
let github = swaddle('https://api.github.com', {
  fn: got // Use `got` to perform requests
})
```

## Installation

``` bash
npm install --save swaddle
npm install request # optional
```

## Options

Options are passed to the underlying request library in two ways. The first,
is during initialization:

``` javascript
let client = swaddle('https://api.example.com', {
  auth: {
    user: 'username',
    pass: 'password',
    sendImmediately: false
  }
})
```

Any options set during initialization will be stored and inherited by all
requests to that API, unless otherwise overwritten. That is, in the following
request, both basic auth and the custom header would be set:

``` javascript
client.search.get('?q=foo', {
  headers: {'x-custom-header': 'value'}
}, (err, res) => {
  // ...
})
```

All options are passed through to the underlying request function,
except for those reserved by swaddle.

### aliases

Creates aliases for the supplied HTTP methods. Default: none

``` javascript
let swaddle = require('swaddle')
let client = swaddle('https://api.example.com', {
  aliases: {create: 'post', destroy: 'delete'}
  json: true
})

client.threads.create({body: {subject: 'hi'}}, (err, res) => {
  // POST https://api.example.com/threads
  // body: '{"subject": "hi"}'
})
```

### fn

The request function to use. Unless provided, it will default to requiring
`request`, `got`, or the browser's `fetch`, in that order.

``` javascript
let swaddle = require('swaddle')
let request = require('request-promise')
let client = swaddle('https://api.example.com', {
  fn: request
})
```

### returnBody

Returns the response body instead of response object. Default: true

``` javascript
let swaddle = require('swaddle')

let client = swaddle('https://api.example.com')
client.users.get((err, res) => {
  // Don't need to access res.body
})

client = swaddle('https://api.example.com', {returnBody: false})
client.users.get((err, res) => {
  // Need to access res.body
})
```

### sendAsBody

Any literal or object passed to post, put, or patch, is set as the request body.
Thus no additional headers or options can be set at the time of the request.
Combined with aliases, it can prevent an otherwise leaky HTTP abstraction.
Default: false

``` javascript
let swaddle = require('swaddle')
let client = swaddle('https://api.example.com', {
  aliases: {create: 'post'},
  sendAsBody: true
})

// Don't need to write:
// client.messages.post({body: 'foo'})

client.messages.create('foo', (err, res) => {
  // POST https://api.example.com/messages
  // body: "foo"
})
```

### json

Parses the JSON response. This is built into some libraries, but not all
(e.g. fetch). Default: true

``` javascript
let swaddle = require('swaddle')

let client = swaddle('https://api.example.com')
client.users.get((err, res) => {
  // res.body has been parsed
})

client = swaddle('https://api.example.com', {json: false})
client.users.get((err, res) => {
  // res.body is a string response
})
```

### camelCase

Creates a camelCase client for a snake_case JSON API. Only available when both
returnBody and json are set to true. Camel case properties are appended as
snake case to the resulting url. Arguments passed during function invocation
are unaffected. Any objects request or response body are recursively formatted.
Default: false

``` javascript
let client = swaddle('https://api.example.com')

client.jobStatuses.get((err, res) => {
  // GET http://api/job_statuses
})

client.fooBar('bazQux').get((err, res) => {
  // GET http://api/foo_bar/bazQux
})

client.users(1).get((err, res) => {
  // If the original response body was '{"is_admin": false}', then res is
  // {isAdmin: false}
})

client.users.post({body: {isAdmin: false, name: 'Foo Bar'}}, (err, res) => {
  // POST http://api/users
  // body: '{"is_admin": false, "name": "Foo Bar"}'
})
```

### extension

Allows you to specify an extension to be appended to any requests,
required by some APIs. Default: empty

``` javascript
let swaddle = require('swaddle')
let client = swaddle('https://api.example.com', {
  extension: 'json'
})

client.users(1).get((err, res) => {
  // https://api.example.com/users/1.json
})

client.search.get('?q=foo', (err, res) => {
  // https://api.example.com/search.json?q=foo
})
```

### whitelist

Whitelists properties that can be accessed. Required when polyfilling Proxy
support for older browsers. Note that the exception is thrown during the
property access, and not during request execution. Default: empty

``` javascript
var client = swaddle('https://api.example.com', {
  whitelist: ['users']
});

client.users().get((err, res) => {
  // success
});

client.search
// Error: search not listed in swaddle's whitelist
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
var github = swaddle('https://api.github.com', {
  whitelist: ['users', 'repos']
});

// Default to using fetch in the browser
github.users('octocat').repos.get().then((repos) => {
  // repos
});

github.search
// Error: search not listed in swaddle's whitelist
```
