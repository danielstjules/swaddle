let Helper = require('../lib/helper')
let assert = require('assert')

describe('Helper', function () {
  describe('convertToCamelCase', function () {
    it('converts keys to camelCase', function () {
      let res = Helper.convertToCamelCase({
        foo: 0,
        fooBar: 1,
        baz_qux: 2
      })

      assert.deepEqual(res, {
        foo: 0,
        fooBar: 1,
        bazQux: 2
      })
    })

    it('supports nested objects', function () {
      let res = Helper.convertToCamelCase({
        foo_bar: {
          baz_qux: true
        }
      })

      assert.deepEqual(res, {
        fooBar: {
          bazQux: true
        }
      })
    })
  })

  describe('convertToSnakeCase', function () {
    it('converts keys to snake_case', function () {
      let res = Helper.convertToSnakeCase({
        foo: 0,
        foo_bar: 1,
        bazQux: 2
      })

      assert.deepEqual(res, {
        foo: 0,
        foo_bar: 1,
        baz_qux: 2
      })
    })

    it('supports nested objects', function () {
      let res = Helper.convertToSnakeCase({
        fooBar: {
          bazQux: true
        }
      })

      assert.deepEqual(res, {
        foo_bar: {
          baz_qux: true
        }
      })
    })
  })
})
