import { isArray } from '../utils/is'
import { identify } from '../utils/guid'
import * as arrayUtils from '../utils/array'
import { extend } from '../utils/clone'
import {
    isModel,
    updateReference,
    updateViewNextTick,
    createModel,
    linkModels,
    unlinkModels
} from './adapter'

var RE_COLL_QUERY = /\[((?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^\]])+)\](?:\[([\+\-]?)(\d+)?\])?(?:\.(.*))?/;

var COLLECTION_UPDATE_ONLY_MATCHED = 2;
var COLLECTION_UPDATE_MATCHED_AND_REMOVE_UNMATCHED = 3;

function beginUpdate(collection) {
    if (!collection._isSetting) {
        collection._isSetting = 1;
        collection._hasChange = false;
        collection.__arrayBackup = collection.array;
        collection.array = collection.array.slice();
    } else {
        collection._isSetting++;
    }
}

function endUpdate(collection) {
    if (collection._isSetting && --collection._isSetting == 0) {
        if (collection._hasChange) {
            updateReference(updateViewNextTick(collection));
        } else if (collection.__arrayBackup) {
            collection.array = collection.__arrayBackup;
        }
        collection._isSetting = false;
        collection.__arrayBackup = null;
    }
    return collection;
}

export default class Collection {
    constructor(parent, attributeName, array) {
        if (isArray(parent)) {
            array = parent;
            parent = null;
        }

        if (!parent) parent = new createModel();

        if (!attributeName) attributeName = "$list";

        this.cid = identify();

        this.parent = parent;
        this.key = parent.key ? (parent.key + "." + attributeName) : attributeName;
        this._key = attributeName;

        this.root = parent.root;
        this.changed = false;

        parent.attributes[attributeName] = this.array = [];

        if (array) this.add(array);
    }

    length = 0

    /**
     * 查询Collection的子Model/Collection
     * 
     * 第n个:
     * collection._(1)
     * 
     * 查询所有符合的:
     * collection._("[attr='val']")
     * 数据类型也相同:[attr=='val']
     * 以val开头:[attr^='val']
     * 以val结尾:[attr$='val']
     * 包含val，区分大小写:[attr*='val']
     * 包含val，不区分大小写:[attr~='val']
     * 或:[attr='val'|attr=1,attr='val'|attr=1]
     * 且:[attr='val'&attr=1,attr='val'|attr=1]
     * 
     * 查询并返回第n个:
     * collection._("[attr='val'][n]")
     * 
     * 一个都不存在则添加:
     * collection._("[attr='val'][+]")
     * 
     * 结果小于n个时则添加:
     * collection._("[attr='val'][+n]")
     * 
     * 删除全部搜索到的，并返回被删除的:
     * collection._("[attr='val'][-]")
     * 
     * 删除搜索结果中第n个，并返回被删除的:
     * collection._("[attr='val'][-n]")
     * 
     * @param {string} search 查询条件
     * @param {object} [def] 数据不存在时默认添加的数据
     * 
     * @return {array|Model|Collection}
     */
    _(search, def) {
        if (typeof search == 'number' || /^\d+$/.test(search))
            return this[search];
        else if (/^\[(\d+)\]$/.test(search))
            return this[RegExp.$1];

        var match = search.match(RE_COLL_QUERY);
        var query = match[1];
        var next = match[4];
        var model;

        if (/^\d+$/.test(query))
            return (model = this[query]) ? (next ? model : model._(next)) : null;

        var operation = match[2];
        var index = match[3] ? parseInt(match[3]) : operation == '+' ? 0 : undefined;

        var test = arrayUtils.query(query);
        var array = this.array;
        var results;
        var i = 0;
        var n = array.length;
        var j;

        // 移除操作
        if (operation == '-') {
            j = 0;
            results = [];
            var from = index === undefined ? 0 : index;
            var to = index === undefined ? n : index;

            for (; i < n; i++) {
                if (test(array[i])) {
                    if (j >= from && j <= to) {
                        model = this.splice(i, 1)[0];
                        results.push(next ? model._(next) : model);
                    }

                    j++;
                }
            }
            return results;
        } else if (index === undefined) {
            // 根据条件查询
            results = [];
            for (; i < n; i++) {
                if (test(array[i])) {
                    results.push(next ? this[i]._(next) : this[i]);
                }
            }
            return results;
        } else {
            // 根据条件查询，并返回第n个结果
            j = 0;
            for (; i < n; i++) {
                if (test(array[i])) {
                    if (j === index) {
                        return next ? this[i]._(next) : this[i];
                    }
                    j++;
                }
            }
            if (operation == '+') {
                if (!def) throw new Error("`+` operation must include default value");
                return this.add(def);
            }
            return null;
        }
    }

    getOrCreate(obj) {
        var index = arrayUtils.indexOf(this.array, obj);
        return index !== -1 ? this[index] : this.add(obj);
    }

    get = function (i) {
        if (i == undefined) return this.array;

        return this[i].get();
    }

    set = function (array) {
        if (!array || array.length == 0) {
            this.clear();
        } else {
            var modelsLen = this.length;

            beginUpdate(this);

            if (array.length < modelsLen) {
                this.splice(array.length, modelsLen - array.length);
            }

            var i = 0;
            var item;
            var hasChange = false;

            this.each(function (model) {
                item = array[i];

                if (isModel(item)) {
                    if (item != model) {
                        hasChange = true;
                        unlinkModels(this, model);
                        linkModels(this, item, this.key + '^child');

                        this[i] = item;
                        this.array[i] = item.attributes;
                    }
                } else {
                    model.set(true, item);
                    if (model._hasChange) {
                        hasChange = true;
                    }
                }

                i++;
            });

            if (hasChange) this._hasChange = true;

            this.add(i == 0 ? array : array.slice(i, array.length));

            endUpdate(this);
        }
        return this;
    }

    add(array) {
        beginUpdate(this);

        var model;
        var dataIsArray = isArray(array);

        if (!dataIsArray) {
            array = [array];
        }
        var dataLen = array.length;
        var results = [];

        if (dataLen) {
            for (var i = 0; i < dataLen; i++) {
                var dataItem = array[i];

                if (isModel(dataItem)) {
                    linkModels(this, dataItem, this.key + '^child');
                    model = dataItem;
                } else {
                    model = new createModel(this, this.length, dataItem);
                }

                this[this.length++] = model;
                this.array.push(model.attributes);

                results.push(model);
            }
            this._hasChange = true;
        }

        endUpdate(this);

        return dataIsArray ? results : results[0];
    }

    /**
     * 根据 Model 的 attributeName 更新Model
     * collection.updateBy('id', 123, { name: '更新掉name' })
     * 
     * @param {String} attributeName 属性名
     * @param {any} val 属性值
     * @param {Object} data
     * 
     * @return {Collection} self
     */
    updateBy(attributeName, val, data) {
        beginUpdate(this);
        var array = this.array;
        for (var i = 0; i < array.length; i++) {
            if (array[i][attributeName] === val) {
                this[i].set(data);
                if (this[i]._hasChange) {
                    this._hasChange = true;
                }
            }
        }
        return endUpdate(this);
    }

    /**
     * 更新 collection 中的 model
     * 
     * @param {Array} arr 需要更新的数组
     * @param {String|Function} primaryKey 唯一健 或 (a, b)=>boolean
     * @param {number} [updateType] 更新类型
     * COLLECTION_UPDATE_DEFAULT - collection中存在既覆盖，不存在既添加
     * COLLECTION_UPDATE_MATCHED_AND_REMOVE_UNMATCHED - 根据arr更新，不在arr中的项将被删除
     * COLLECTION_UPDATE_ONLY_MATCHED - 只更新collection中存在的
     * 
     * @return {Collection} self
     */
    update(arr, primaryKey, updateType) {
        if (!arr) return this;

        var fn;
        var length = this.length;

        if (!length) {
            (updateType !== COLLECTION_UPDATE_ONLY_MATCHED) && this.add(arr);
            return this;
        }

        beginUpdate(this);

        if (typeof primaryKey === 'string') {
            fn = function (a, b) {
                return a[primaryKey] == b[primaryKey];
            }
        } else fn = primaryKey;

        var item;
        var arrItem;
        var exists;

        if (!isArray(arr)) arr = [arr];
        else arr = [].concat(arr);

        var n = arr.length;
        var result;

        for (var i = length - 1; i >= 0; i--) {
            item = this.array[i];
            exists = false;

            for (var j = 0; j < n; j++) {
                arrItem = arr[j];

                if (arrItem !== undefined) {
                    if ((result = fn.call(this, item, arrItem))) {
                        this[i].set(typeof result == 'object' ? result : arrItem);
                        if (this[i]._hasChange) {
                            this._hasChange = true;
                        }
                        arr[j] = undefined;
                        exists = true;
                        break;
                    }
                }
            }

            if (updateType === COLLECTION_UPDATE_MATCHED_AND_REMOVE_UNMATCHED && !exists) {
                this.splice(i, 1);
            }
        }

        if (updateType !== COLLECTION_UPDATE_ONLY_MATCHED) {
            var appends = [];
            for (i = 0; i < n; i++) {
                if (arr[i] !== undefined) {
                    appends.push(arr[i]);
                }
            }

            if (appends.length) {
                this.add(appends);
            }
        }

        return endUpdate(this);
    }

    // 已有项将被增量覆盖，不在arr中的项将被删除
    updateTo(arr, primaryKey) {
        return this.update(arr, primaryKey, COLLECTION_UPDATE_MATCHED_AND_REMOVE_UNMATCHED);
    }

    // 只更新collection中匹配到的
    updateMatched(arr, primaryKey) {
        return this.update(arr, primaryKey, COLLECTION_UPDATE_ONLY_MATCHED);
    }

    unshift(data) {
        return this.insert(0, data);
    }

    insert(index, data) {
        beginUpdate(this);

        var model;
        var count;

        if (!isArray(data)) {
            data = [data];
        }

        for (var i = 0, dataLen = data.length; i < dataLen; i++) {
            var dataItem = data[i];

            if (isModel(dataItem)) {
                model = dataItem;
                linkModels(this, model, this.key + '^child');
            } else {
                count = index + i;
                model = new createModel(this, count, dataItem);
            }

            Array.prototype.splice.call(this, count, 0, model)
            this.array.splice(count, 0, model.attributes);
        }
        this._hasChange = true;

        return endUpdate(this);
    }

    splice(start, count, data) {
        beginUpdate(this);

        if (!count) count = 1;

        var root = this.root;
        var spliced = Array.prototype.splice.call(this, start, count);
        this.array.splice(start, count);
        this._hasChange = true;

        if (root._linkedModels) {
            var self = this;
            spliced.forEach(function (model) {
                model._linkedParents && unlinkModels(self, model);
            });
        }

        endUpdate(data
            ? this.insert(start, data)
            : this);

        return spliced;
    }

    /**
     * 移除Model
     * 
     * @param {String|Model|Function} key 删除条件，(arrayItem)=>boolean
     * @param {any} val
     */
    remove(key, val) {
        beginUpdate(this);

        var array = this.array;
        var fn = typeof key === 'function'
            ? key
            : isModel(key)
                ? function (item, i) {
                    return this[i] === key;
                }
                : function (item) {
                    return item[key] == val;
                };

        for (var i = this.length - 1; i >= 0; i--) {
            if (fn.call(this, array[i], i)) {
                Array.prototype.splice.call(this, i, 1);
                array.splice(i, 1);
                this._hasChange = true;
            }
        }

        return endUpdate(this);
    }

    clear() {
        if (this.length == 0 && this.array.length == 0) return this;
        for (var i = 0; i < this.length; i++) {
            delete this[i];
        }
        this.array = [];
        this.length = 0;
        this._isSetting = 1;
        this._hasChange = true;

        return endUpdate(this);
    }

    each(start, end, fn) {
        if (typeof start == 'function') fn = start, start = 0, end = this.length;
        else if (typeof end == 'function') fn = end, end = this.length;

        for (; start < end; start++) {
            if (fn.call(this, this[start], start) === false) break;
        }
        return this;
    }

    find(key, val) {
        var i = 0;
        var n = this.array.length;

        if (typeof key === 'function') {
            for (; i < n; i++) {
                if (key.call(this, this.array[i], i)) return this[i];
            }
        } else {
            for (; i < n; i++) {
                if (this.array[i][key] == val) return this[i];
            }
        }
        return null;
    }

    size() {
        return this.array.length;
    }

    map(fn) {
        return arrayUtils.map(this.array, fn);
    }

    indexOf(key, val) {
        return isModel(key) ? Array.prototype.indexOf.call(this, key) :
            arrayUtils.indexOf(this.array, key, val);
    }

    lastIndexOf(key, val) {
        return isModel(key) ? Array.prototype.lastIndexOf.call(this, key) :
            arrayUtils.lastIndexOf(this.array, key, val);
    }

    last() {
        return this.length === 0 ? null : this[this.length - 1];
    }

    filter(key, val) {
        return arrayUtils.filter(this.array, key, val);
    }

    toJSON() {
        return extend(true, [], this.array);
    }
}

Collection.prototype.toArray = Collection.prototype.toJSON;