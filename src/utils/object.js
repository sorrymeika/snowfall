import { isArray } from './is';

var hasOwnProperty = Object.prototype.hasOwnProperty;
var ArrayProto = Array.prototype;
var slice = ArrayProto.slice;
var concat = ArrayProto.concat;

function classExtend(proto) {
    var parent = this,
        child = hasOwnProperty.call(proto, 'constructor') ? proto.constructor : function () {
            return parent.apply(this, arguments);
        };

    var Surrogate = function () {
        this.constructor = child;
    };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate();

    for (var key in proto)
        child.prototype[key] = proto[key];

    for (var keyOfSuper in parent)
        child[keyOfSuper] = parent[keyOfSuper];

    child.prototype.__super__ = parent.prototype;

    return child;
}

export function createClass(proto) {
    var func = hasOwnProperty.call(proto, 'constructor') ? proto.constructor : function () {
    };
    func.prototype = proto;
    func.prototype.constructor = func;
    func.extend = classExtend;
    return func;
}

/**
 * 判断两个 Object/Array 是否相等
 * 
 * @param {any} a
 * @param {any} b
 * @param {boolean} [identical] 是否全等`===`
 */
export function equals(a, b, identical) {
    if (identical ? a === b : a == b) return true;

    var typeA = toString.call(a);
    var typeB = toString.call(b);
    var i;

    if (typeA !== typeB) return false;

    switch (typeA) {
        case '[object Object]':
            var keysA = Object.keys(a);
            if (keysA.length != Object.keys(b).length) {
                return false;
            }

            var key;
            for (i = keysA.length; i >= 0; i--) {
                key = keysA[i];

                if (!equals(a[key], b[key], identical)) return false;
            }
            break;
        case '[object Array]':
            if (a.length !== b.length) {
                return false;
            }
            for (i = a.length; i >= 0; i--) {
                if (!equals(a[i], b[i], identical)) return false;
            }
            break;
        case '[object Date]':
            return +a === +b;
        case '[object RegExp]':
            return ('' + a) === ('' + b);
        default:
            if (identical ? a !== b : a != b) return false;
    }

    return true;
}

export function same(a, b) {
    return equals(a, b, true);
}

/**
 * 判断一个`Object`和另外一个`Object`是否`keys`重合且值相等
 * 
 * @param {Object|Array} parent 
 * @param {Object|any} obj 
 */
export function contains(parent, obj) {
    var type = toString.call(parent);

    switch (type) {
        case '[object Object]':
            for (var key in obj) {
                if (obj[key] !== parent[key]) return false;
            }
            break;
        case '[object Array]':
            if (!isArray(obj)) return parent.indexOf(obj) != -1;

            for (var i = obj.length; i >= 0; i--) {
                if (parent.indexOf(obj[i]) == -1) return false;
            }
            break;
        default:
            return obj == parent;
    }
    return true;
}

export function value(data, names) {
    if (typeof names === 'string')
        names = names.split('.');

    for (var i = 0, len = names.length; i < len; i++) {
        if (data == null || data == undefined) return null;
        data = data[names[i]];
    }

    return data;
}


/**
 * pick Object
 */
export function pick(obj, iteratee) {
    var result = {},
        key;
    if (obj == null) return result;
    if (typeof iteratee === 'function') {
        for (key in obj) {
            var value = obj[key];
            if (iteratee(value, key, obj)) result[key] = value;
        }
    } else {
        var keys = concat.apply([], slice.call(arguments, 1));
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if (key in obj) result[key] = obj[key];
        }
    }
    return result;
}
