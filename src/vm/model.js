import { isArray, isPlainObject, isThenable } from '../utils/is'
import { extend, cloneDeep } from '../utils/clone'
import { identify } from '../utils/guid'
import { updateViewNextTick } from './updater'
import {
    isModel,
    isCollection,
    isModelOrCollection,
    updateReference,
    updateModelByKeys,
    linkModels,
    unlinkModels,
    createCollection
} from './adapter'

import { DATACHANGED_EVENT } from './consts';

const RE_QUERY = /(?:^|\.)([_a-zA-Z0-9]+)(\[(?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^\]])+\](?:\[[\+\-]?\d*\])?)?/g;

export default class Model {
    constructor(parent, key, attributes) {
        if (isModel(parent)) {
            this.key = parent.key ? parent.key + '.' + key : key;
            this._key = key;
        } else if (isCollection(parent)) {
            this.key = parent.key + '^child';
            this._key = parent._key + '^child';
        } else {
            throw new Error('Model\'s parent mast be Collection or Model');
        }

        this.cid = identify();

        this.type = typeof attributes == 'object' ? 'object' : 'value';
        this.attributes = this.type == 'object' ? {} : undefined;

        this._model = {};
        this.parent = parent;
        this.root = parent.root;
        this.changed = false;

        this.set(attributes);
    }

    /**
     * 搜索子Model/Collection，
     * 支持多种搜索条件
     * 
     * 搜索子Model:
     * model._('user') 或 model._('user.address')
     * 
     * 根据查询条件查找子Collection下的Model:
     * model._('collection[id=222][0].options[text~="aa"&value="1"][0]')
     * model._('collection[id=222][0].options[text~="aa"&value="1",attr^='somevalue'|attr=1][0]')
     * 
     * 且条件:
     * model._("collection[attr='somevalue'&att2=2][1].aaa[333]")
     * 
     * 或条件:
     * model._("collection[attr^='somevalue'|attr=1]")
     * 
     * 不存在时添加，不可用模糊搜索:
     * model._("collection[attr='somevalue',attr2=1][+]")
     * 
     * @param {string} search 搜索条件
     * @param {any} [def] collection[attr='val'][+]时的默认值
     */
    _(search, def) {
        var attr;
        var query;
        var result = this;

        RE_QUERY.lastIndex = 0;
        for (var m = RE_QUERY.exec(search); m; m = RE_QUERY.exec(search)) {
            attr = m[1];
            query = m[2];

            if (isModel(result)) {
                result = attr in result._model ? result._model[attr] : result.attributes[attr];

                if (query && isCollection(result)) {
                    return result._(query + search.substr(m.index + m[0].length), def);
                }
            }
            else if (!result)
                return def === undefined ? null : def;
            else
                result = result[attr]
        }
        return !result && def !== undefined ? def : result;
    }

    get(key) {
        if (typeof key === 'undefined') return this.attributes;

        if (typeof key == 'string' && key.indexOf('.') != -1) {
            key = key.split('.');
        }

        var data;
        if (isArray(key)) {
            data = this.attributes;

            for (var i = key[0] == 'this' ? 1 : 0, len = key.length; i < len; i++) {
                if (!(data = data[key[i]]))
                    return null;
            }
        } else if (key == 'this') {
            return this.attributes;
        } else {
            data = this.attributes[key];
        }

        return data;
    }

    getJSON(key) {
        return cloneDeep(this.get(key));
    }

    toJSON() {
        return extend(true, {}, this.attributes);
    }

    /**
     * 设置Model
     * 
     * 参数: [renew, Object] | [renew, key, val] | [key, val] | [Object]
     * [renew, key, val] 替换子model数据
     * [renew, Object] 时覆盖当前model数据
     * 
     * @param {Boolean} [renew] 是否替换掉现有数据
     * @param {String|Object} key 属性名
     * @param {any} [val] 属性值
     */
    set(renew, key, val) {
        var self = this,
            model,
            attrs,
            keys,
            renewChild = false,
            root = this.root;

        if (typeof renew != "boolean") {
            val = key;
            key = renew;
            renew = false;
        }

        var isArrayKey = isArray(key);

        if (key === null) {
            this.restore();
            this.attributes = null;
            updateReference(this);
            return this;
        } else if (!isArrayKey && typeof key == 'object') {
            attrs = key;
        } else if (typeof val === 'undefined') {
            val = key;

            if (this.attributes !== val) {
                this.attributes = val;
                updateReference(updateViewNextTick(this));
            }
            return this;
        } else {
            keys = isArrayKey ? key : key.split('.');

            if (keys.length > 1) {
                model = updateModelByKeys(this, renew, keys, val);

                return model._hasChange
                    ? updateViewNextTick(this)
                    : this;
            } else {
                renewChild = renew;
                renew = false;
                (attrs = {})[key] = val;
            }
        }
        var hasChange = false;
        var oldAttributes = this.attributes;
        var attributes;

        if (this.attributes === null || !isPlainObject(this.attributes)) {
            attributes = {};
            hasChange = true;
        } else {
            attributes = Object.assign({}, this.attributes)
        }

        this.attributes = attributes;
        this._isSetting = true;

        if (renew) {
            for (var name in attributes) {
                if (attrs[name] === undefined) {
                    attrs[name] = null;
                }
            }
        }

        var changes = [];
        var origin;
        var value;
        var isInModelMap;
        var modelMap = this._model;

        for (var attr in attrs) {
            isInModelMap = attr in modelMap;
            origin = isInModelMap ? modelMap[attr] : attributes[attr];
            value = attrs[attr];

            if (origin !== value) {
                if (isModelOrCollection(value)) {
                    modelMap[attr] = value;
                    attributes[attr] = isCollection(value) ? value.array : value.attributes;

                    if (isModelOrCollection(origin)) {
                        unlinkModels(this, origin);
                    }

                    linkModels(this, value, this.key ? this.key + '.' + attr : attr);

                    hasChange = true;
                } else if (isModel(origin)) {
                    if (value === null || value === undefined) {
                        origin.restore();
                        origin.attributes = null;
                    } else {
                        origin.set(renewChild, value);
                    }
                    attributes[attr] = origin.attributes;

                    if (origin._hasChange) hasChange = true;
                } else if (isCollection(origin)) {
                    if (!isArray(value)) {
                        if (value == null) {
                            value = [];
                        } else {
                            throw new Error('[Array to ' + (typeof value) + ' error]不可改变' + attr + '的数据类型');
                        }
                    }

                    origin.set(value);
                    attributes[attr] = origin.array;

                    if (origin._hasChange) hasChange = true;
                } else if (isThenable(value)) {
                    value.then(function (res) {
                        self.set(attr, res);
                    });
                } else if (isPlainObject(value)) {
                    value = new Model(this, attr, value);
                    modelMap[attr] = value;
                    attributes[attr] = value.attributes;
                    hasChange = true;
                } else if (isArray(value)) {
                    value = createCollection(this, attr, value);
                    modelMap[attr] = value;
                    attributes[attr] = value.array;
                    hasChange = true;
                } else {
                    changes.push(this.key ? this.key + "." + attr : attr, value, attributes[attr]);
                    attributes[attr] = value;
                    isInModelMap && delete modelMap[attr];
                    hasChange = true;
                }
            }
        }

        if (hasChange) {
            updateReference(updateViewNextTick(this));

            for (var i = 0, length = changes.length; i < length; i += 3) {
                root.trigger(new Event("change:" + changes[i], {
                    target: this
                }), changes[i + 1], changes[i + 2]);
            }
        } else {
            this.attributes = oldAttributes;
        }
        this._isSetting = false;
        this._hasChange = hasChange;

        return this;
    }

    contains(model) {
        if (model === this) return false;

        for (var parent = model.parent; parent; parent = model.parent) {
            if (parent === this) return true;
        }
        return false;
    }

    /**
     * 监听当前 Model 的属性值变化
     */
    change(attributeName, fn) {
        var self = this;

        this.root.on("change:" + attributeName, function (e, oldValue, newValue) {
            if (e.target === self) {
                return fn.call(self, e, oldValue, newValue);
            }
        });
    }

    /**
     * 监听子 Model / Collection 变化
     */
    observe(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = this.key || '';
        } else {
            key = ':' + (this.key ? this.key + '.' + key : key);
        }

        var self = this;
        var cb = function (e) {
            if (e.target === self || self.contains(e.target)) {
                return fn.call(self, e);
            }
        }
        cb._cb = fn;

        return this.root.on(DATACHANGED_EVENT + key, cb);
    }

    unobserve(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = this.key || '';
        } else {
            key = ':' + (this.key ? this.key + '.' + key : key);
        }

        return this.root.off(DATACHANGED_EVENT + key, fn);
    }

    restore() {
        var data = {};
        for (var key in this.attributes) {
            data[key] = null;
        }
        this.set(data);
    }

    collection(key) {
        !key && (key = 'collection');

        var result = this._(key);
        if (result == null) {
            this.set(key, []);
            return this._model[key];
        }
        return result;
    }

    model(key) {
        if (!this._model[key]) this.set(key, {});
        return this._model[key];
    }
}