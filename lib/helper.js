let camelize = require('underscore.string/camelize')
let underscored = require('underscore.string/underscored')

class Helper {
  /**
   * Recursively converts all object keys to camelCase. The target object
   * is modified rather than returning a new object.
   *
   * @param   {object} obj
   * @returns {object}
   */
  static convertToCamelCase (obj) {
    return Helper._convertCase(obj, camelize)
  }

  /**
   * Recursively converts all object keys to snake_case. The target object
   * is modified rather than returning a new object.
   *
   * @param   {object} obj
   * @returns {object}
   */
  static convertToSnakeCase (obj) {
    return Helper._convertCase(obj, underscored)
  }

  /**
   * Helper function that recursively invokes the supplied function to
   * rename all object keys.
   *
   * @param   {object} obj
   * @returns {object}
   */
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
