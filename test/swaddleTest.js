let assert = require('assert')
let nock = require('nock')
let requestPromise = require('request-promise')
let got = require('got')
let fetch = require('node-fetch')
let swaddle = require('../lib/')

describe('swaddle', function () {
  let BASE_URL = 'http://api'
  let client = swaddle(BASE_URL)
  let snakeCaseObj = {
    foo_bar: 'notChanged',
    baz: {foo_bar: true}
  }
  let camelCaseObj = {
    fooBar: 'notChanged',
    baz: {fooBar: true}
  }

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

    it('joins multiple arguments with /', function () {
      let url = client('foo', 'bar')._url
      assert.equal(url, 'http://api/foo/bar')
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
          if (err) return done(err)
          done()
        })
      })
    })
  })

  describe('options', function () {
    it('has a default user agent and json set to true', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {
          headers: {'User-Agent': 'swaddle'},
          json: true,
          method: 'GET'
        })
        done()
      }
      let client = swaddle(BASE_URL, {fn})
      client.foo.get()
    })

    it('allows options to be set during creation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {
          headers: {'User-Agent': 'swaddle'},
          json: true,
          method: 'GET',
          foo: 'bar'
        })
        done()
      }
      let client = swaddle(BASE_URL, {fn, foo: 'bar'})
      client.foo.get()
    })

    it('allows options to be set during invocation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {
          headers: {'User-Agent': 'swaddle'},
          json: true,
          method: 'GET',
          foo: 'bar'
        })
        done()
      }
      let client = swaddle(BASE_URL, {fn})
      client.foo.get({foo: 'bar'})
    })

    it('merges properties from creation and invocation', function (done) {
      let fn = (url, opts) => {
        assert.deepEqual(opts, {
          headers: {'User-Agent': 'swaddle'},
          json: true,
          method: 'GET',
          a: 0,
          b: 2,
          c: 3
        })
        done()
      }
      let client = swaddle(BASE_URL, {fn, a: 1, b: 2})
      client.foo.get({a: 0, c: 3})
    })

    describe('aliases', function () {
      it('sets aliases for the different client methods', function (done) {
        let fn = (url, opts) => {
          assert(opts.method, 'POST')
          done()
        }
        let client = swaddle(BASE_URL, {fn, aliases: {create: 'post'}})
        client.create()
      })
    })

    describe('fn', function () {
      it('sets the request function to use', function (done) {
        let fn = () => done()
        let client = swaddle(BASE_URL, {fn})
        client.foo.get()
      })
    })

    describe('returnBody', function () {
      it('returns the response body when true', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, 'foo')

        let client = swaddle(BASE_URL)
        client.foo.get((err, res) => {
          if (err) return done(err)
          assert.equal(res, 'foo')
          done()
        })
      })

      it('returns the full response when false', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, 'foo')

        let client = swaddle(BASE_URL, {returnBody: false})
        client.foo.get((err, res) => {
          if (err) return done(err)
          assert.equal(res.body, 'foo')
          done()
        })
      })
    })

    describe('sendAsBody', function () {
      it('nests the post data in the req.body', function (done) {
        nock(BASE_URL)
          .post('/foo', '"bar"')
          .reply(200)

        let client = swaddle(BASE_URL, {sendAsBody: true})
        client.foo.post('bar', (err, res) => {
          if (err) return done(err)
          done()
        })
      })
    })

    describe('json', function () {
      it('parses the JSON response when true', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '{"foo_bar": 1}')

        client.foo.get((err, res) => {
          if (err) return done(err)
          assert.deepEqual(res, {foo_bar: 1})
          done()
        })
      })

      it('does not parse the JSON response when false', function (done) {
        var str = '{"foo_bar": 1}'
        nock(BASE_URL)
          .get('/foo')
          .reply(200, str)

        let client = swaddle(BASE_URL, {json: false})
        client.foo.get((err, res) => {
          if (err) return done(err)
          assert.equal(res, str)
          done()
        })
      })
    })

    describe('camelCase', function () {
      let client = swaddle(BASE_URL, {camelCase: true})

      it('throws if json and returnBody are not set', function () {
        assert.throws(() => {
          swaddle(BASE_URL, {camelCase: true, json: false, returnBody: false})
        }, Error)
        assert.throws(() => {
          swaddle(BASE_URL, {camelCase: true, json: false})
        }, Error)
        assert.throws(() => {
          swaddle(BASE_URL, {camelCase: true, returnBody: false})
        }, Error)
      })

      it('appends a snake_case string to the url', function () {
        assert.equal(client.fooBar._url, 'http://api/foo_bar')
      })

      it('does not affect strings added via invocation', function () {
        assert.equal(client.fooBar('bazQux')._url, 'http://api/foo_bar/bazQux')
      })

      it('converts snake_case response keys to camelCase', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '{"foo_bar": "not_changed", "baz": {"foo_bar": true}}')

        client.foo.get((err, res) => {
          if (err) return done(err)
          assert.deepEqual(res, {
            fooBar: 'not_changed',
            baz: {fooBar: true}
          })
          done()
        })
      })

      it('converts camelCase keys in body object to snake_case', function (done) {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        client.foo.post({body: camelCaseObj}, (err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('converts camelCase keys in json object to snake_case', function (done) {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        client.foo.post({json: camelCaseObj}, (err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('does not modify the original object', function (done) {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        client.foo.post({json: camelCaseObj}, (err, res) => {
          if (err) return done(err)
          assert(snakeCaseObj.foo_bar)
          done()
        })
      })
    })

    describe('extension', function () {
      it('appends the extension to the url', function (done) {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        client.foo.get((err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('works when passing a string in the method', function (done) {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        client.get('foo', (err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('is compatible with query strings', function (done) {
        nock(BASE_URL)
          .get('/search.json')
          .query({q: 'foo'})
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        client.search.get('?q=foo', (err, res) => {
          if (err) return done(err)
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
      it('performs the request, returns the json parsed body', function () {
        let client = swaddle(BASE_URL, {fn: requestPromise})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })

      it('returns the raw body when json is false', function () {
        let client = swaddle(BASE_URL, {fn: requestPromise, json: false})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('camelCase converts keys in json object', function () {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        let client = swaddle(BASE_URL, {camelCase: true, fn: requestPromise})

        return client.foo.post({json: camelCaseObj})
      })
    })

    describe('got', function () {
      it('performs the request, returns the json parsed body', function () {
        let client = swaddle(BASE_URL, {fn: got})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })

      it('returns the raw body when json is false', function () {
        let client = swaddle(BASE_URL, {fn: got, json: false})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('returns the full response when returnBody is false', function () {
        let client = swaddle(BASE_URL, {fn: got, returnBody: false})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res.body, parsedBody)
        })
      })

      it('camelCase converts keys in body object', function () {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        let client = swaddle(BASE_URL, {camelCase: true, fn: got})

        return client.foo.post({body: camelCaseObj})
      })
    })

    describe('fetch', function () {
      it('performs the request, returns the json parsed body', function () {
        let client = swaddle(BASE_URL, {fn: fetch})
        return client.foo.get('bar').then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })

      it('returns the raw body when json is false', function () {
        let client = swaddle(BASE_URL, {fn: fetch, json: false})
        return client.foo.get('bar').then((res) => {
          assert.equal(res, body)
        })
      })

      it('returns the full response when returnBody is false', function () {
        let client = swaddle(BASE_URL, {fn: fetch, returnBody: false})
        return client.foo.get('bar').then((res) => {
          return res.json()
        }).then((res) => {
          assert.deepEqual(res, parsedBody)
        })
      })

      it('camelCase converts keys in body object', function () {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        let client = swaddle(BASE_URL, {
          json: true, returnBody: true, camelCase: true, fn: fetch
        })

        return client.foo.post({body: camelCaseObj})
      })
    })
  })
})
