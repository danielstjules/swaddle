let camelize = require('underscore.string/camelize')
let underscored = require('underscore.string/underscored')

class Helper {
  static convertToCamelCase (obj) {
    return Helper._convertCase(obj, camelize)
  }

  static convertToSnakeCase (obj) {
    return Helper._convertCase(obj, underscored)
  }

  static _convertCase (obj, fn) {
    if (!(obj instanceof Object)) {
      return obj
    }

    Object.keys(obj).forEach((key) => {
      let updated = fn(key)
      if (updated !== key) {
        obj[updated] = obj[key]
        delete obj[key]
      }
      Helper._convertCase(obj[updated], fn)
    })

    return obj
  }
}

module.exports = Helper
