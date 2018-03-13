var toString = Object.prototype.toString;

export default function is(type) {
    return function (obj) {
        return toString.call(obj) == "[object " + type + "]";
    };
}

export const isObject = is("Object");

export const isArray = Array.isArray || is("Array");

export function isString(str) {
    return typeof str == 'string' || toString.call(str) == "[object String]";
}

export function isNumber(str) {
    return typeof str == 'number' || toString.call(str) == "[object Number]";
}

export function isBoolean(str) {
    return typeof str == 'boolean' || toString.call(str) == "[object Boolean]";
}

export function isFunction(fn) {
    return typeof fn == 'function';
}

export function isPlainObject(value) {
    return value && (value.constructor === Object || value.constructor === undefined);
}

export function isEmptyObject(obj) {
    if (!obj) return false;

    for (var name in obj) {
        return false;
    }
    return true;
}

export function isNo(value) {
    return !value || (isArray(value) && !value.length) || (isObject(value) && isEmptyObject(value));
}

export function isYes(value) {
    return !isNo(value);
}

export function isThenable(thenable) {
    return thenable && typeof thenable === 'object' && typeof thenable.then === 'function';
}
