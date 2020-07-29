'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fse = _interopDefault(require('fs-extra'));
var path = _interopDefault(require('path'));
var TWResolveConfig = _interopDefault(require('tailwindcss/resolveConfig'));

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function indentWith(value, size) {
  return ' '.repeat(size) + value;
}
/**
 * Resolves a config.
 * If passed a string, imports it first.
 * @param {String | Object} config
 * @return {Object}
 */

function resolveConfig(config) {
  if (typeof config === 'string') {
    config = require(config);
  }

  return TWResolveConfig(config);
}
function isObject(value) {
  return !Array.isArray(value) && typeof value === 'object';
}

const INDENT_BY = 2;
/**
 * General converter class. To be extended by any specific format converter.
 */

class Converter {
  /** @type {string} - the format and file extension */

  /** @type {object} - the resolved theme configuration settings */

  /** @type {object} - tailwind specific configurations */

  /** @type {string} - the symbol that starts a map */

  /** @type {string} - the symbol that ends a map */

  /** @type {boolean} - should map keys be quoted */

  /** @type {number} - should try to flatten deep maps after N level */

  /**
   * @param opts
   * @param {Object} opts.config - Tailwind config object
   * @param {Boolean} opts.flat - Is flat or not
   * @param {String} opts.prefix - If we want a variable prefix
   * @param {Boolean} [opts.quotedKeys] - Should map keys be quoted
   * @param {Number} [opts.flattenMapsAfter] - Should flatten maps after N level
   */
  constructor(opts) {
    _defineProperty(this, "format", void 0);

    _defineProperty(this, "theme", {});

    _defineProperty(this, "configs", {});

    _defineProperty(this, "mapOpener", '(\n');

    _defineProperty(this, "mapCloser", ')');

    _defineProperty(this, "quotedKeys", false);

    _defineProperty(this, "flattenMapsAfter", -1);

    const {
      theme,
      ...rest
    } = opts.config;
    this.theme = theme;
    this.configs = rest;
    this.flat = opts.flat;
    this.prefix = opts.prefix || '';
    if (opts.quotedKeys) this.quotedKeys = opts.quotedKeys;
    if (typeof opts.flattenMapsAfter !== 'undefined') this.flattenMapsAfter = opts.flattenMapsAfter;
  }
  /**
   * Returns a variable format for the style class
   * @param {string} name
   * @param {string} value
   * @private
   */


  _buildVar(name, value) {}
  /**
   * Converts the supplied data to a list of variables
   * @param prop
   * @param data
   * @private
   */


  _convertObjectToVar(prop, data) {
    return this._walkFlatRecursively(data, prop).join('');
  }

  _walkFlatRecursively(value, parentPropertyName) {
    return Object.entries(value).reduce((all, [propertyName, propertyValue]) => {
      const property = [parentPropertyName, propertyName].filter(Boolean).join('-');
      const val = isObject(propertyValue) ? this._walkFlatRecursively(propertyValue, property) : this._buildVar(this._propertyNameSanitizer(property), this._sanitizePropValue(propertyValue));
      return all.concat(val);
    }, []);
  }
  /**
   * Converts the supplied data to a list of nested map objects
   * @private
   * @param {string} property
   * @param {object} data
   * @return {string}
   */


  _convertObjectToMap(property, data) {
    return this._buildVar(this._propertyNameSanitizer(property), this._buildMap(data));
  }
  /**
   * Builds a map object with indentation
   * @param data
   * @param indent
   * @return {string}
   * @private
   */


  _buildMap(data, indent = 0) {
    // open map
    return [`${this.mapOpener}`, // loop over each element
    ...Object.entries(data).filter(([metric]) => !!metric).map(([metric, value], index) => {
      return this._buildMapData(metric, value, indent, index);
    }), // close map
    indentWith(this.mapCloser, indent)].join('');
  }
  /**
   * Builds the body data of a map
   * @param {string} metric - colors, backgroundColor, etc
   * @param {object|string} value - the metric value, usually an object
   * @param {number} indent - the number of indents to apply
   * @param {number} metricIndex - the metric index it is in
   * @return {string|*}
   * @private
   */


  _buildMapData(metric, value, indent, metricIndex) {
    if (!isObject(value)) {
      // not an object so we can directly build an entry
      return this._buildObjectEntry(metric, value, indent, metricIndex);
    }

    const nestLevel = indent / INDENT_BY; // should deeply nested maps be flattened out, or resolved deeply

    if (nestLevel <= this.flattenMapsAfter) {
      return this._buildObjectEntry(metric, this._buildMap(value, indent + INDENT_BY), indent, metricIndex);
    } // its an object so we need to flatten it out


    return this._walkRecursively(value, metric, indent, metricIndex).join('');
  }

  _walkRecursively(value, parentPropertyName, indent, metricIndex) {
    return Object.entries(value).reduce((all, [propertyName, propertyValue], index) => {
      const property = [parentPropertyName, propertyName].filter(Boolean).join('-');
      const val = isObject(propertyValue) ? this._walkRecursively(propertyValue, property, indent, metricIndex) : this._buildObjectEntry(property, propertyValue, indent, index, metricIndex);
      return all.concat(val);
    }, []);
  }
  /**
   * Creates a single map entry
   * @param {string} key - the key of the entry. Usually concatenated prefixed string
   * @param {string | array} value - the value if the entry. Should be either array or a string
   * @param {number} indent - the number of indents
   * @param {number} index - the current item index
   * @param {number} metricIndex - the current metric's index
   * @return {string}
   * @private
   */


  _buildObjectEntry(key, value, indent, index = 0, metricIndex) {
    return indentWith(`${this._objectEntryKeySanitizer(key)}: ${this._sanitizePropValue(value)},\n`, indent + INDENT_BY);
  }
  /**
   * Converts the options config to the required format.
   * @returns {string}
   */


  convert() {
    let setting;
    let buffer = '';

    for (setting in this.theme) {
      if (this.theme.hasOwnProperty(setting) && this._isSettingEnabled(setting)) {
        const data = this.theme[setting];
        const body = this.flat ? this._convertObjectToVar(setting, data) : this._convertObjectToMap(setting, data);
        buffer += '\n';
        buffer += body;
      }
    }

    return buffer;
  }
  /**
   * Checks whether a setting is enabled or not.
   * @param {string} key
   * @return {boolean}
   * @private
   */


  _isSettingEnabled(key) {
    const {
      corePlugins
    } = this.configs;
    if (!corePlugins) return true;
    return Array.isArray(corePlugins) ? corePlugins.includes(key) : corePlugins[key] !== false;
  }
  /**
   * Sanitizes a value, escaping and removing symbols
   * @param {*} value
   * @return {string|*}
   * @private
   */


  _sanitizePropValue(value) {
    if (Array.isArray(value)) return `(${value})`.replace(/\\"/g, '"');
    if ( // if its a string
    typeof value === 'string' // and has comma's in it
    && value.includes(',') // but is not a concatenated map
    && !value.startsWith(this.mapOpener)) return `(${value})`;
    return value;
  }
  /**
   * Sanitizes a property name by escaping characters
   * Adds prefix
   * @param {string} property - the property (colors, backgroundColors)
   * @return {string}
   * @private
   */


  _propertyNameSanitizer(property) {
    property = property.replace('/', '\\/');
    return [this.prefix, property].filter(v => v).join('-');
  }
  /**
   * Sanitizes object keys
   * @param {string} key
   * @return {string}
   * @private
   */


  _objectEntryKeySanitizer(key) {
    return this.quotedKeys ? `"${key}"` : key;
  }

}

class LessConverter extends Converter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "format", 'less');
  }

  _buildVar(name, value) {
    return `@${name}: ${value};\n`;
  }

  _convertObjectToMap(prop, data) {
    return this._convertObjectToVar(prop, data);
  }

  _sanitizePropValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    return value;
  }

}

class StylusConverter extends Converter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "format", 'styl');

    _defineProperty(this, "mapOpener", '{\n');

    _defineProperty(this, "mapCloser", '}');
  }

  _buildVar(name, value) {
    return `$${name} = ${value};\n`;
  }

  _objectEntryKeySanitizer(prop) {
    if (/\d/.test(prop) || this.quotedKeys) return `"${prop}"`;
    return prop;
  }

}

class SassConverter extends Converter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "format", 'sass');

    _defineProperty(this, "mapOpener", '(');

    _defineProperty(this, "mapCloser", ')');
  }

  _buildVar(name, value) {
    return `$${name}: ${value}\n`;
  }

  _buildObjectEntry(key, value, indent, index, metricIndex = 0) {
    return indentWith(`${this._objectEntryKeySanitizer(key)}: ${this._sanitizePropValue(value)},`, indent + (!index && !metricIndex ? 0 : 1));
  }

}

/**
 * @extends Converter
 */

class ScssConverter extends Converter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "format", 'scss');

    _defineProperty(this, "mapOpener", '(\n');

    _defineProperty(this, "mapCloser", ')');
  }

  _buildVar(name, value) {
    return `$${name}: ${value};\n`;
  }

}

var converters = {
  Less: LessConverter,
  Sass: SassConverter,
  Scss: ScssConverter,
  Stylus: StylusConverter
};

const allowedFormatsMap = {
  stylus: converters.Stylus,
  styl: converters.Stylus,
  sass: converters.Sass,
  scss: converters.Scss,
  less: converters.Less
};
/**
 * Converts tailwind config into desired format
 */

class ConvertTo {
  /**
   * @param options
   * @param {Object | String} options.config - Tailwind config. Could be either the tailwind config object or path to it
   * @param {String} [options.prefix] - Variable prefix
   * @param {String} [options.destination] - Output destination
   * @param {Boolean} [options.flat] - Whether the variables should be nested maps or flat level variables
   * @param {String} options.format - The desired format
   * @param {Boolean} [options.quotedKeys] - Whether SASS keys should be quoted. Both for Sass and SCSS.
   * @param {Number} [options.flattenMapsAfter] - After what nest level, do we want to flatten out nested maps.
   */
  constructor(options) {
    if (!allowedFormatsMap.hasOwnProperty(options.format)) {
      throw new Error(`${options.format} is not supported. Use ${Object.keys(allowedFormatsMap)}`);
    }

    this.options = options;
    const Converter = allowedFormatsMap[options.format];
    const config = resolveConfig(options.config);
    this.converterInstance = new Converter({ ...options,
      config
    });
  }
  /**
   * Converts the config and returns a string with in the new format
   * @returns {string}
   */


  convert() {
    let buffer = `/* Converted Tailwind Config to ${this.options.format} */`;
    buffer += this.converterInstance.convert();
    return buffer;
  }
  /**
   * Write Tailwindcss config to file
   * @returns {Promise}
   */


  writeToFile() {
    let buffer = this.convert();
    return this._writeFile(buffer, {
      destination: this.options.destination,
      format: this.converterInstance.format
    });
  }
  /**
   * Internal method to write the supplied data to a tailwind config file with the desired format
   * @param {String} data
   * @param {String} destination
   * @param {String} format
   * @private
   * @return {Promise}
   */


  _writeFile(data, {
    destination,
    format
  }) {
    // If destination ends with a slash, we append a name to the file
    if (destination.endsWith(path.sep)) destination += 'tailwind-config';
    const endPath = `${destination}.${format}`;
    const file = path.join(process.cwd(), endPath);
    return fse.outputFile(file, data).then(() => {
      return {
        destination: endPath
      };
    });
  }

}

module.exports = ConvertTo;
