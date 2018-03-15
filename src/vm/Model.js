import { isBoolean, isArray, isPlainObject, isThenable } from '../utils/is';
import { extend, deepClone } from '../utils/clone';
import { identify } from '../utils/guid';

import { Event } from '../core/event';
import {
    isModel,
    isCollection,
    isModelOrCollection,
    updateReference,
    updateModelByKeys,
    updateViewNextTick,
    createCollectionFactory
} from './mediator';
import { linkModels, unlinkModels } from './linker';

import { mixinDataSet } from './DataSet';

const toString = Object.prototype.toString;
const RE_QUERY = /(?:^|\.)([_a-zA-Z0-9]+)(\[(?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^\]])+\](?:\[[\+\-]?\d*\])?)?/g;

function createArray(model, name, array) {
    const ArrayFactory = model.constructor.createArrayFactory(name, array);
    return new ArrayFactory(model, name, array);
}

export default class Model {
    static createArrayFactory = createCollectionFactory;

    constructor(parent, key, attributes) {
        if (arguments.length <= 1) {
            this.root = this;
            attributes = parent === undefined ? extend({}, this.attributes, this.constructor.defaultAttributes) : parent;
        } else {
            if (isModel(parent)) {
                this.key = parent.key ? parent.key + '.' + key : key;
                this._key = key;
            } else if (isCollection(parent)) {
                this.key = parent.key + '^child';
                this._key = parent._key + '^child';
            } else {
                throw new Error('Model\'s parent mast be Collection or Model');
            }
            this.parent = parent;
            this.root = parent.root;
        }

        this.cid = identify();

        this.$attributes = null;
        this.$model = {};

        this.render = this.render.bind(this);
        this.changed = false;

        this.set(attributes);
    }

    get attributes() {
        return this.$attributes;
    }

    set attributes(val) {
        this.set(true, val);
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
                result = result.$model[attr] || result.$attributes[attr];

                if (query && isCollection(result)) {
                    return result._(query + search.substr(m.index + m[0].length), def);
                }
            }
            else if (!result)
                return def === undefined ? null : def;
            else
                result = result[attr];
        }
        return !result && def !== undefined ? def : result;
    }

    get(key) {
        if (!this.$attributes) return undefined;
        if (typeof key === 'undefined') return this.$attributes;

        if (typeof key == 'string' && key.indexOf('.') != -1) {
            key = key.split('.');
        }

        var data;
        if (isArray(key)) {
            data = this.$attributes;

            for (var i = key[0] == 'this' ? 1 : 0, len = key.length; i < len; i++) {
                if (!(data = data[key[i]]))
                    return null;
            }
        } else if (key == 'this') {
            return this.$attributes;
        } else {
            data = this.$attributes[key];
        }

        return data;
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
        var model,
            attrs,
            keys,
            renewChild = false,
            root = this.root,
            argsLength = arguments.length,
            keyIsVal;

        if (!isBoolean(renew) || argsLength === 1) {
            val = key;
            key = renew;
            renew = false;
            keyIsVal = argsLength === 1;
        } else {
            keyIsVal = argsLength === 2;
        }

        var keyType = toString.call(key);
        var keyIsObject = keyType === '[object Object]';

        if (keyIsVal && !keyIsObject) {
            if (this._isChange = (this.$attributes !== key)) {
                this.$model = {};
                this.$attributes = key;
                updateReference(updateViewNextTick(this));
            }
            return this;
        } else if (keyIsObject) {
            attrs = key;
        } else {
            keys = keyType === '[object Array]' ? key : key.split('.');

            if (keys.length > 1) {
                model = updateModelByKeys(this, renew, keys, val);

                return (this._isChange = model._isChange)
                    ? updateViewNextTick(this)
                    : this;
            } else {
                renewChild = renew;
                renew = false;
                (attrs = {})[key] = val;
            }
        }
        var isChange = false;
        var oldAttributes = this.$attributes;
        var attributes;

        if (this.$attributes === null || !isPlainObject(this.$attributes)) {
            attributes = {};
            isChange = true;
        } else {
            attributes = Object.assign({}, this.$attributes);
        }

        this.$attributes = attributes;
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
        var modelMap = this.$model;

        for (var attr in attrs) {
            origin = modelMap[attr] || attributes[attr];
            value = attrs[attr];
            if (origin !== value) {
                if (isModelOrCollection(value)) {
                    modelMap[attr] = value;
                    attributes[attr] = isCollection(value) ? value.$array : value.$attributes;

                    if (isModelOrCollection(origin)) {
                        unlinkModels(this, origin);
                    }
                    linkModels(this, value, this.key ? this.key + '.' + attr : attr);

                    isChange = true;
                } else if (isModel(origin)) {
                    origin.set(renew || renewChild, value);
                    attributes[attr] = origin.$attributes;

                    if (origin._isChange) isChange = true;
                } else if (isCollection(origin)) {
                    if (!isArray(value)) {
                        if (value == null) {
                            value = [];
                        } else {
                            throw new Error('[Array to ' + (typeof value) + ' error]不可改变' + attr + '的数据类型');
                        }
                    }

                    origin.set(value);
                    attributes[attr] = origin.$array;

                    if (origin._isChange) isChange = true;
                } else if (isThenable(value)) {
                    value.then(((attr, res) => {
                        this.set(renew, attr, res);
                    }).bind(this, attr));
                } else if (isPlainObject(value)) {
                    value = new Model(this, attr, value);
                    modelMap[attr] = value;
                    attributes[attr] = value.$attributes;
                    isChange = true;
                } else if (isArray(value)) {
                    value = createArray(this, attr, value);
                    modelMap[attr] = value;
                    attributes[attr] = value.$array;
                    isChange = true;
                } else {
                    changes.push(this.key ? this.key + "." + attr : attr, value, attributes[attr]);
                    attributes[attr] = value;
                    isChange = true;
                }
            }
        }

        if (isChange) {
            updateReference(updateViewNextTick(this));

            for (var i = 0, length = changes.length; i < length; i += 3) {
                root.trigger(new Event("change:" + changes[i], {
                    target: this
                }), changes[i + 1], changes[i + 2]);
            }
        } else {
            this.$attributes = oldAttributes;
        }
        this._isSetting = false;
        this._isChange = isChange;

        if (process.env.NODE_ENV === 'development') {
            Object.freeze(this.$attributes);
        }

        return this;
    }

    contains(model) {
        if (model === this) return false;
        for (var parent = model.parent; parent; parent = parent.parent) {
            if (parent === this) return true;
        }
        return false;
    }

    restore() {
        if (isPlainObject(this.$attributes)) {
            var data = {};
            for (var key in this.$attributes) {
                data[key] = null;
            }
            this.set(data);
        } else {
            this.set(null);
        }
    }

    collection(key) {
        !key && (key = 'collection');

        var result = this._(key);
        if (result == null) {
            this.set(key, []);
            return this.$model[key];
        }
        return result;
    }

    model(key) {
        if (!this.$model[key]) this.set(key, {});
        return this.$model[key];
    }

    observable(key) {
        if (this.$model[key]) return this.$model[key];

        var value = this.$attributes[key];
        return this.model(key).set(value);
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

    getJSON(key) {
        return deepClone(this.get(key));
    }

    toJSON() {
        return extend(true, {}, this.$attributes);
    }
}

mixinDataSet(Model);