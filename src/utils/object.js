import { isArray } from './is'

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
            if (a.length != b.length) {
                return true;
            }
            for (i = a.length; i >= 0; i--) {
                if (!equals(a[i], b[i], identical)) return false;
            }
            break;
        case '[object Date]':
            return +a == +b;
        case '[object RegExp]':
            return ('' + a) === ('' + b);
        default:
            if (identical ? a !== b : a != b) return false;
    }

    return true;
}


export function identifyWith(a, b) {
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
            if (!isArray(obj)) return parent.indexOf(obj[i]) != -1;

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