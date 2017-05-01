let assert = require('assert')
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
})
