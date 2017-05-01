let assert = require('assert')
let nock = require('nock')
let swaddle = require('.')

describe('swaddle', function () {
  let BASE_URL = 'http://api'
  let api = swaddle(BASE_URL)

  describe('url', function () {
    it('throws if missing the base url', function () {
      assert.throws(() => {
        swaddle()
      }, Error)
    })

    it('removes the trailing slash from the url', function () {
      let api = swaddle('foo/')
      assert.equal(api._url, 'foo')
    })
  })

  describe('property access', function () {
    it('appends to the target url', function () {
      let url = api.foo._url
      assert.equal(url, 'http://api/foo')
    })

    it('returns a new Proxy for chaining', function () {
      let a = api.foo.bar.baz
      let b = api.foo.bar.qux
      assert.equal(a._url, 'http://api/foo/bar/baz')
      assert.equal(b._url, 'http://api/foo/bar/qux')
    })
  })

  describe('invocation', function () {
    it('appends to the target url', function () {
      let url = api('foo')._url
      assert.equal(url, 'http://api/foo')
    })

    it('returns a new Proxy for chaining', function () {
      let a = api.foo('bar')
      let b = api.foo('bar').baz('qux')
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

        api.foo[method]((err, res) => {
          assert(!err)
          done()
        })
      })
    })
  })

  describe('options', function () {
    describe('fn', function () {
      it('sets the request function to use', function (done) {
        let fn = () => done()
        let api = swaddle(BASE_URL, { fn })
        api.foo.get()
      })
    })

    describe('returnBody', function () {
      it('returns the response body', function (done) {
        nock(BASE_URL)
          .get('/foo')
          .reply(200, 'foo')

        let api = swaddle(BASE_URL, { returnBody: true })
        api.foo.get((err, res) => {
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

        let api = swaddle(BASE_URL, { json: true })
        api.foo.get((err, res) => {
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

        let api = swaddle(BASE_URL, { extension: 'json' })
        api.foo.get((err, res) => {
          assert(!err)
          done()
        })
      })

      it('works when passing a string in the method', function (done) {
        nock(BASE_URL)
          .get('/foo.json')
          .reply(200)

        let api = swaddle(BASE_URL, { extension: 'json' })
        api.get('foo', (err, res) => {
          assert(!err)
          done()
        })
      })

      it('is compatible with query strings', function (done) {
        nock(BASE_URL)
          .get('/search.json')
          .query({q: 'foo'})
          .reply(200)

        let api = swaddle(BASE_URL, { extension: 'json' })
        api.search.get('?q=foo', (err, res) => {
          assert(!err)
          done()
        })
      })
    })

    describe('whitelist', function () {
      let api = swaddle(BASE_URL, {
        whitelist: ['foo', 'bar']
      })

      it('allows properties in the whitelist', function () {
        api.foo(1).bar(2)
      })

      it('throws for properties not in the whitelist', function () {
        assert.throws(() => {
          api.foo(1).baz(2)
        }, Error)
      })
    })
  })
})
