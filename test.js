let assert = require('assert')
let nock = require('nock')
let requestPromise = require('request-promise')
let got = require('got')
let fetch = require('node-fetch')
let swaddle = require('.')

describe('swaddle', function () {
  let BASE_URL = 'http://api'
  let client = swaddle(BASE_URL)

  describe('url', function () {
    it('throws if missing the base url', function () {
      assert.throws(() => {
        swaddle()
      }, Error)
    })

    it('removes the trailing slash from the url', function () {
      let client = swaddle('foo/')
      assert.equal(client._url, 'foo')
    })
  })

  describe('property access', function () {
    it('appends to the target url', function () {
      let url = client.foo._url
      assert.equal(url, 'http://api/foo')
    })

    it('returns a new Proxy for chaining', function () {
      let a = client.foo.bar.baz
      let b = client.foo.bar.qux
      assert.equal(a._url, 'http://api/foo/bar/baz')
      assert.equal(b._url, 'http://api/foo/bar/qux')
    })
  })

  describe('invocation', function () {
    it('appends to the target url', function () {
      let url = client('foo')._url
      assert.equal(url, 'http://api/foo')
    })

    it('returns a new Proxy for chaining', function () {
      let a = client.foo('bar')
      let b = client.foo('bar').baz('qux')
      assert.equal(a._url, 'http://api/foo/bar')
      assert.equal(b._url, 'http://api/foo/bar/baz/qux')
    })
  })

  describe('HTTP methods', function () {
    let methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    methods.forEach((method) => {
      it(`${method} performs a ${method.toUpperCase()} request`, function (done) {
        nock(BASE_URL)
          .intercept('/foo', method.toUpperCase())
          .reply(200)

        client.foo[method]((err, res) => {
          assert(!err)
          done()
        })
      })
    })
  })

  describe('options', function () {
    it('allows options to be set during creation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {foo: 'bar', method: 'GET'})
        done()
      }
      let client = swaddle(BASE_URL, {fn, foo: 'bar'})
      client.foo.get()
    })

    it('allows options to be set during invocation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {foo: 'bar', method: 'GET'})
        done()
      }
      let client = swaddle(BASE_URL, {fn})
      client.foo.get({foo: 'bar'})
    })

    it('merges properties from creation and invocation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {a: 0, b: 2, c: 3, method: 'GET'})
        done()
      }
      let client = swaddle(BASE_URL, {fn, a: 1, b: 2})
      client.foo.get({a: 0, c: 3})
    })

    describe('fn', function () {
      it('sets the request function to use', function (done) {
        let fn = () => done()
        let client = swaddle(BASE_URL, { fn })
        client.foo.get()
      })
    })

    describe('returnBody', function () {
      it('returns the response body', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, 'foo')

        let client = swaddle(BASE_URL, { returnBody: true })
        client.foo.get((err, res) => {
          assert(!err)
          assert.equal(res, 'foo')
          done()
        })
      })
    })

    describe('json', function () {
      it('parses the JSON response', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '{"a": 1}')

        let client = swaddle(BASE_URL, { json: true })
        client.foo.get((err, res) => {
          assert(!err)
          assert.deepEqual(res.body, {a: 1})
          done()
        })
      })
    })

    describe('extension', function () {
      it('appends the extension to the url', function (done) {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, { extension: 'json' })
        client.foo.get((err, res) => {
          assert(!err)
          done()
        })
      })

      it('works when passing a string in the method', function (done) {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, { extension: 'json' })
        client.get('foo', (err, res) => {
          assert(!err)
          done()
        })
      })

      it('is compatible with query strings', function (done) {
        nock(BASE_URL)
          .get('/search.json')
          .query({q: 'foo'})
          .reply(200)

        let client = swaddle(BASE_URL, { extension: 'json' })
        client.search.get('?q=foo', (err, res) => {
          assert(!err)
          done()
        })
      })
    })

    describe('whitelist', function () {
      let client = swaddle(BASE_URL, {whitelist: ['foo', 'bar']})

      it('allows properties in the whitelist', function () {
        client.foo(1).bar(2)
      })

      it('throws for properties not in the whitelist', function () {
        assert.throws(() => {
          client.foo(1).baz(2)
        }, Error)
      })
    })
  })

  describe('compatibility', function () {
    let body = '{"foo": "bar"}'
    let parsedBody = JSON.parse(body)

    beforeEach(function () {
      nock(BASE_URL)
        .get('/foo/bar')
        .reply(200, body)
    })

    describe('request-promise', function () {
      it('performs the request', function () {
        let client = swaddle(BASE_URL, {fn: requestPromise})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('returnBody is ignored by default', function () {
        let client = swaddle(BASE_URL, {fn: requestPromise, returnBody: true})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('json parses the body', function () {
        let client = swaddle(BASE_URL, {fn: requestPromise, json: true})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })
    })

    describe('got', function () {
      it('performs the request', function () {
        let client = swaddle(BASE_URL, {fn: got})
        return client.foo.get('bar').then((res) => {
          assert.equal(res.body, body)
        })
      })

      it('returnBody returns the body', function () {
        let client = swaddle(BASE_URL, {fn: got, returnBody: true})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('json parses the body', function () {
        let client = swaddle(BASE_URL, {fn: got, json: true})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res.body, parsedBody)
        })
      })

      it('json and returnBody returns the parsed body', function () {
        let client = swaddle(BASE_URL, {fn: got, json: true, returnBody: true})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })
    })

    describe('fetch', function () {
      it('performs the request', function () {
        let client = swaddle(BASE_URL, {fn: fetch})
        return client.foo.get('bar').then((res) => {
          return res.text()
        }).then((res) => {
          assert.equal(res, body)
        })
      })

      it('returnBody returns the body', function () {
        let client = swaddle(BASE_URL, {fn: fetch, returnBody: true})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('json is ignored, still need to use res.json()', function () {
        let client = swaddle(BASE_URL, {fn: fetch, json: true})
        return client.foo.get('bar').then((res) => {
          return res.json()
        }).then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })

      it('json and returnBody returns the parsed body', function () {
        let client = swaddle(BASE_URL, {fn: fetch, json: true, returnBody: true})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })
    })
  })
})
