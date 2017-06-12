let assert = require('assert')
let nock = require('nock')
let requestPromise = require('request-promise')
let request = require('request')
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
      it(`${method} performs a ${method.toUpperCase()} request`, function () {
        nock(BASE_URL)
          .intercept('/foo', method.toUpperCase())
          .reply(200)

        return client.foo[method]()
      })
    })

    it('append to the URL', function () {
      nock(BASE_URL)
        .get('/users/foo')
        .reply(200)

      let client = swaddle(BASE_URL)
      return client.users.get('foo')
    })

    it('does not append trailing slash with query strings', function () {
      nock(BASE_URL)
        .get('/search')
        .query({q: 'foo'})
        .reply(200)

      let client = swaddle(BASE_URL)
      return client.search.get('?q=foo')
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
      it('returns the response body when true', function () {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '"foo"')

        let client = swaddle(BASE_URL)
        return client.foo.get().then((res) => {
          assert.equal(res, 'foo')
        })
      })

      it('returns the full response when false', function () {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '"foo"')

        let client = swaddle(BASE_URL, {returnBody: false})
        return client.foo.get().then((res) => {
          assert.equal(res.body, 'foo')
        })
      })
    })

    describe('sendAsBody', function () {
      it('nests the post data in the req.body', function () {
        let body = {foo: 'bar'}
        nock(BASE_URL)
          .post('/foo', JSON.stringify(body))
          .reply(200)

        let client = swaddle(BASE_URL, {sendAsBody: true})
        return client.foo.post(body)
      })
    })

    describe('json', function () {
      it('parses the JSON response when true', function () {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '{"foo_bar": 1}')

        return client.foo.get().then((res) => {
          assert.deepEqual(res, {foo_bar: 1})
        })
      })

      it('does not parse the JSON response when false', function () {
        var str = '{"foo_bar": 1}'
        nock(BASE_URL)
          .get('/foo')
          .reply(200, str)

        let client = swaddle(BASE_URL, {json: false})
        return client.foo.get().then((res) => {
          assert.equal(res, str)
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

      it('converts snake_case response keys to camelCase', function () {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, '{"foo_bar": "not_changed", "baz": {"foo_bar": true}}')

        return client.foo.get().then((res) => {
          assert.deepEqual(res, {
            fooBar: 'not_changed',
            baz: {fooBar: true}
          })
        })
      })

      it('converts camelCase keys in body object to snake_case', function () {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        return client.foo.post({body: camelCaseObj})
      })

      it('does not modify the original object', function () {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        return client.foo.post({body: camelCaseObj}).then((res) => {
          assert(snakeCaseObj.foo_bar)
        })
      })
    })

    describe('extension', function () {
      it('appends the extension to the url', function () {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        return client.foo.get()
      })

      it('works when passing a string in the method', function () {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        return client.get('foo')
      })

      it('is compatible with query strings', function () {
        nock(BASE_URL)
          .get('/search.json')
          .query({q: 'foo'})
          .reply(200)

        let client = swaddle(BASE_URL, {extension: 'json'})
        return client.search.get('?q=foo')
      })
    })

    describe('whitelist', function () {
      let client = swaddle(BASE_URL, {whitelist: ['foo', 'bar']})

      it('allows properties in a whitelist array', function () {
        client.foo(1)
        client.bar(1)
      })

      it('allows properties in a whitelist object', function () {
        let client = swaddle(BASE_URL, {
          whitelist: {foo: [], bar: []}
        })
        client.foo(1)
        client.bar(1)
      })

      it('allows nesting', function () {
        let client = swaddle(BASE_URL, {
          whitelist: {
            users: {
              repos: ['stargazers']
            },
            emojis: []
          }
        })

        client.users(1).repos(2).stargazers(3)
        client.emojis()
      })

      it('throws for properties not at correct level', function () {
        assert.throws(() => {
          client.foo(1).bar(2)
        }, Error)
      })

      it('throws for properties not in the whitelist', function () {
        assert.throws(() => {
          client.foo(1).baz(2)
        }, Error)
      })

      it('works with camelCase', function () {
        swaddle(BASE_URL, {
          camelCase: true,
          whitelist: ['fooBar']
        }).fooBar()
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

    describe('request', function () {
      it('performs the request, returns the json parsed body', function (done) {
        let client = swaddle(BASE_URL, {fn: request})
        client.foo.get('bar', (err, res) => {
          if (err) done(err)
          assert.deepEqual(res, parsedBody)
          done()
        })
      })

      it('returns the raw body when json is false', function (done) {
        let client = swaddle(BASE_URL, {fn: request, json: false})
        client.foo.get('bar', (err, res) => {
          if (err) done(err)
          assert.equal(res, body)
          done()
        })
      })

      it('returns the full response when returnBody is false', function (done) {
        let client = swaddle(BASE_URL, {fn: request, returnBody: false})
        return client.foo.get('bar', (err, res) => {
          if (err) done(err)
          assert.deepEqual(res.body, parsedBody)
          done()
        })
      })

      it('camelCase converts keys in body object', function (done) {
        nock(BASE_URL)
          .post('/foo', snakeCaseObj)
          .reply(200)

        let client = swaddle(BASE_URL, {camelCase: true, fn: request})

        client.foo.post({body: camelCaseObj}, (err, res) => {
          done(err)
        })
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
