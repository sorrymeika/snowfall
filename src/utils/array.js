import { isArray } from './is'
import { contains, equals } from './object'

var RE_QUERY_ATTR = /([\w]+)(\^|\*|=|!|\$|~)?\=(\d+|null|undefined|true|false|'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|(?:.*?(?=[,\|&])))([,\|&])?/g;

/**
 * 将 query 编译成 查询方法
 * 
 * @param {String} query 要编译的string
 * query = "attr^='somevalue'|c1=1,att2=2"
 * 
 * @return {Function} (Object)=>boolean
 */
function compileQuery(query) {
    var group = [];
    var groups = [group];

    query.replace(RE_QUERY_ATTR, function (match, attr, op, val, lg) {
        //console.log(match, attr, op, val, lg);

        if (val.charAt(0) == '\'' && val.slice(-1) == '\'') {
            val = val.slice(1, -1).replace(/\\\'/g, '\'');
        } else {
            val = val === 'undefined' ? undefined : JSON.parse(val);
        }

        group.push({
            attr: attr,
            op: op,
            val: val,
            lg: lg
        });

        if (lg == ',') {
            groups.push(group = []);
        }
    });

    return groups[0].length > 0 ? function (obj) {
        return matchObject(groups, obj);
    } : function () { return true; };
}


/**
 * 判断某 Object 是否匹配`compileQuery`方法编译后的查询条件组
 * 
 * @param {Array} queryGroups 查询条件组 
 * @param {Object} obj 
 * 
 * @returns {boolean}
 */
function matchObject(queryGroups, obj) {
    var result = true;
    var val;
    var group;
    var item;

    if (queryGroups) {
        if (!obj) return false;

        for (var i = 0, length = queryGroups.length; i < length; i++) {
            group = queryGroups[i];
            result = true;

            for (var j = 0, n = group.length; j < n; j++) {
                item = group[j];
                val = obj[item.attr];

                switch (item.op) {
                    case '=':
                        result = val === item.val;
                        break;
                    case '!':
                        result = val != item.val;
                        break;
                    case '^':
                        result = val && (val.slice(0, item.val.length) == item.val);
                        break;
                    case '$':
                        result = val && (val.slice(-item.val.length) == item.val);
                        break;
                    case '*':
                        result = val && val.indexOf(item.val) != -1;
                        break;
                    case '~':
                        result = item.val !== null && item.val !== undefined
                            ? val && val.toLowerCase().indexOf(('' + item.val).toLowerCase()) != -1 : true;
                        break;
                    default:
                        result = val == item.val;
                        break;
                }

                if (!result) {
                    if (item.lg == '&') {
                        break;
                    }
                } else {
                    if (item.lg == '|') {
                        break;
                    }
                }
            }

            if (!result)
                break;
        }
    }
    return result;
}

/**
 * 筛选数组
 * 
 * @param {String} query 查询字符串
 * @param {Array} array 被查询的数组
 * 
 * @example
 * console.log(util.query("[attr!=undefined]", [{ attr: 1 }]))
 * 
 * 判断Object是否匹配
 * var match = util.query("attr^='somevalue'|c1=1,att2!=2");
 * match({
 *     attr: 'somevalue11'
 * });
 */
export function query(query, array) {
    if (!array) {
        return compileQuery(query);

    } else if (typeof query !== 'string') {
        var tmp = array;
        array = query;
        query = tmp;
    }

    var match = compileQuery(query);
    var results = [];

    for (var i = 0, n = array.length; i < n; i++) {
        if (match(array[i])) results.push(array[i]);
    }

    return results;
}

/**
 * map到一个新数组
 * 
 * @param {Array} arr 
 * @param {String|Function|Array} key 
 */
export function map(arr, key) {
    var result = [];
    var i = 0, len = arr.length;

    if (typeof key === 'string') {
        for (; i < len; i++) {
            result.push(arr[i][key]);
        }
    } else if (isArray(key)) {
        var item;
        var k;
        for (; i < len; i++) {
            item = {};
            for (var j = key.length - 1; j >= 0; j--) {
                k = key[j];
                if (k in arr[i]) item[k] = arr[i][k];
            }
            result.push(item);
        }
    } else {
        for (; i < len; i++) {
            result.push(key(arr[i], i));
        }
    }

    return result;
}

/**
 * 筛选数组中匹配的
 * 
 * @param {Array} arr 
 * @param {String|Function|Object} key 
 * @param {any} val 
 */
export function filter(arr, key, val) {
    var keyType = typeof key;
    var result = [];
    var i = 0;
    var length = arr.length;

    if (keyType === 'string' && arguments.length == 3) {
        for (; i < length; i++) {
            if (arr[i][key] == val)
                result.push(arr[i]);
        }
    } else if (keyType === 'function') {
        for (; i < length; i++) {
            if (key(arr[i], i))
                result.push(arr[i]);
        }
    } else {
        for (; i < length; i++) {
            if (contains(arr[i], key))
                result.push(arr[i]);
        }
    }

    return result;
}

/**
 * 查找第一个匹配的
 * 
 * @param {Array} array 
 * @param {String|Function} key 
 * @param {any} [val]
 */
export function first(array, key, val) {
    var i = 0, len = array.length;

    if (typeof key === 'string' && arguments.length == 3) {
        for (; i < len; i++) {
            if (array[i][key] == val) return array[i];
        }
    } else if (typeof key === 'function') {
        for (; i < len; i++) {
            if (key(array[i], i)) return array[i];
        }
    } else {
        for (; i < len; i++) {
            if (contains(array[i], key)) return array[i];
        }
    }

    return null;
}


/**
 * 移除数组中匹配的
 * 
 * @param {Array} arr 
 * @param {String|Function} key 
 * @param {any} [val] 
 */
export function remove(arr, key, val) {
    var keyType = typeof key;
    var result = [];
    var length = arr.length;
    var i = length - 1;

    if (keyType === 'string' && arguments.length == 3) {
        for (; i >= 0; i--) {
            if (arr[i][key] == val) arr.splice(i, 1);
        }
    } else if (keyType === 'function') {
        for (; i >= 0; i--) {
            if (key(arr[i], i)) arr.splice(i, 1);
        }
    } else {
        for (; i >= 0; i--) {
            if (contains(arr[i], key)) arr.splice(i, 1);
        }
    }

    return result;
}

/**
 * 排除匹配的
 * 
 * @param {Array} arr 
 * @param {String|Function|Object} key 
 * @param {any} [val] 
 */
export function exclude(arr, key, val) {
    var length = arr.length;
    var keyType = typeof key;
    var result = [];
    var i = 0;

    if (keyType === 'string' && arguments.length == 3) {
        for (; i < length; i++) {
            if (arr[i][key] != val) result.push(arr[i]);
        }
    } else if (keyType === 'function') {
        for (; i < length; i++) {
            if (!key(arr[i], i)) result.push(arr[i]);
        }
    } else {
        for (; i < length; i++) {
            if (!contains(arr[i], key)) result.push(arr[i]);
        }
    }

    return result;
}


export function indexOf(arr, key, val) {
    var length = arr.length;
    var keyType = typeof key;
    var i = 0;

    if (keyType === 'string' && arguments.length == 3) {
        for (; i < length; i++) {
            if (arr[i][key] == val) return i;
        }
    } else if (keyType === 'function') {
        for (; i < length; i++) {
            if (key(arr[i], i)) return i;
        }
    } else {
        for (; i < length; i++) {
            if (contains(arr[i], key)) return i;
        }
    }

    return -1;
}

export function lastIndexOf(arr, key, val) {
    var keyType = typeof key;
    var i = arr.length - 1;

    if (keyType === 'string' && arguments.length == 3) {
        for (; i >= 0; i--) {
            if (arr[i][key] == val) return i;
        }
    } else if (keyType === 'function') {
        for (; i >= 0; i--) {
            if (key(arr[i], i)) return i;
        }
    } else {
        for (; i >= 0; i--) {
            if (contains(arr[i], key)) return i;
        }
    }

    return -1;
}


/**
 * 将数组分组
 * 
 * @example
 * groupBy('day,sum(amount)', [{ day: 333, amout: 22 }, { day: 333, amout: 22 }])
 * // [{ key: { day: 333 }, sum: { amount: 44 }, group: [...] }]
 * 
 * @param {String} query 分组条件
 * @param {Array} data 
 * @return {Array}
 */
export function groupBy(query, data) {
    var results = [];
    var keys = [];
    var operations = [];

    query.split(/\s*,\s*/).forEach(function (item) {
        var m = /(sum|avg)\(([^\)]+)\)/.exec(item);
        if (m) {
            operations.push({
                operation: m[1],
                key: m[2]
            })
        } else {
            keys.push(item);
        }
    });

    data.forEach(function (item) {
        var key = {};
        var group = false;

        for (var j = 0, k = keys.length; j < k; j++) {
            key[keys[j]] = item[keys[j]];
        }

        var i = 0;
        var n = results.length
        for (; i < n; i++) {
            if (equals(results[i].key, key)) {
                group = results[i];
                break;
            }
        }

        if (!group) {
            group = {
                key: key,
                count: 0,
                group: []
            }
            results.push(group);
        }

        for (i = 0, n = operations.length; i < n; i++) {
            var name = operations[i].key;

            switch (operations[i].operation) {
                case 'sum':
                    if (!group.sum) {
                        group.sum = {};
                    }
                    if (group.sum[name] === undefined) {
                        group.sum[name] = 0;
                    }
                    group.sum[name] += item[name];
                    break;
                case 'avg':
                    if (!group.avg) {
                        group.avg = {};
                    }
                    if (group.avg[name] === undefined) {
                        group.avg[name] = 0;
                    }
                    group.avg[name] = (group.avg[name] * group.count + item[name]) / (group.count + 1);
                    break;
            }
        }

        group.count++;
        group.group.push(item);

    });
    return results;
}

export function sum(arr, key) {
    var result = 0;
    var i = 0, n = arr.length;

    if (typeof key === 'string') {
        for (; i < n; i++) {
            result += arr[i][key];
        }
    } else {
        for (; i < n; i++) {
            result += key(arr[i], i);
        }
    }

    return result;
}
