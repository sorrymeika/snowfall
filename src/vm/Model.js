import { isBoolean, isArray, isPlainObject, isThenable, isString } from '../utils/is';
import { extend, deepClone } from '../utils/clone';
import { get } from '../utils/object';

import { Observer } from './Observer';
import { Collection } from './Collection';

import { isModel, isCollection, isObservable } from './predicates';

import { enqueueUpdate } from './methods/enqueueUpdate';
import { blindSet } from './methods/blindSet';
import { updateRefs } from './methods/updateRefs';
import { connect, disconnect } from './methods/connect';


const toString = Object.prototype.toString;
const RE_QUERY = /(?:^|\.)([_a-zA-Z0-9]+)(\[(?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^\]])+\](?:\[[\+\-]?\d*\])?)?/g;

export class Model extends Observer {
    static attributeFactory(value, name, parent) {
        if (isPlainObject(value)) {
            return new Model(value, name, parent);
        } else if (isArray(value)) {
            return new Collection(value, name, parent);
        } else {
            return value;
        }
    }

    constructor(attributes, key, parent) {
        super();
        this.initialized = false;

        if (parent) {
            connect(parent, this, key);
        }

        this.$data = null;
        this.$model = {};
        this.dirty = false;

        var defaultAttributes = this.constructor.defaultAttributes;

        attributes = attributes === undefined
            ? defaultAttributes
            : isPlainObject(defaultAttributes)
                ? Object.assign({}, defaultAttributes, attributes)
                : attributes;

        this.set(attributes);
        this.initialized = true;
    }

    get attributes() {
        return this.$data;
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
                result = result.$model[attr] || result.$data[attr];

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

    pick(keys) {
        return keys && keys.map((key) => this.get(key));
    }

    get(key) {
        if (!this.$data) return undefined;
        if (key == null) return this.$data;
        return get(this.$data, key);
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

        if (keyIsVal && (!keyIsObject || !isPlainObject(key))) {
            if (this._isChange = (this.$data !== key)) {
                this.$model = {};
                this.$data = keyIsObject ? Object.create(key) : key;
                enqueueUpdate(this);
                updateRefs(this);
            }
            return this;
        } else if (keyIsObject) {
            attrs = key;
        } else {
            keys = keyType === '[object Array]' ? key : key.split('.');

            if (keys.length > 1) {
                model = blindSet(this, renew, keys, val);

                return (this._isChange = model._isChange)
                    ? enqueueUpdate(this)
                    : this;
            } else {
                renewChild = renew;
                renew = false;
                (attrs = {})[key] = val;
            }
        }
        var isChange = false;
        var oldAttributes = this.$data;
        var attributes;

        if (this.$data === null || !isPlainObject(this.$data)) {
            attributes = {};
            isChange = true;
        } else {
            attributes = Object.assign({}, this.$data);
        }

        this.$data = attributes;
        this._setting = true;

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
        var $model = this.$model;

        for (var attr in attrs) {
            origin = $model[attr] || attributes[attr];
            value = attrs[attr];
            if (origin !== value) {
                if (isObservable(value)) {
                    $model[attr] = value;
                    attributes[attr] = value.$data;

                    if (isObservable(origin)) {
                        disconnect(this, origin);
                    }
                    connect(this, value, attr);

                    isChange = true;
                } else if (isModel(origin)) {
                    origin.set(renew || renewChild, value);
                    attributes[attr] = origin.$data;

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
                } else {
                    value = attributeFactory(value, attr, this);
                    if (isObservable(value)) {
                        $model[attr] = value;
                        attributes[attr] = value.$data;
                    } else {
                        changes.push(attr, value, attributes[attr]);
                        attributes[attr] = value;
                    }
                    isChange = true;
                }
            }
        }

        if (isChange) {
            enqueueUpdate(this);
            updateRefs(this);
            if (this._hasOnChangeListener) {
                for (var i = 0, length = changes.length; i < length; i += 3) {
                    this.trigger("change:" + changes[i], changes[i + 1], changes[i + 2]);
                }
            }
        } else {
            this.$data = oldAttributes;
        }
        this._setting = false;
        this._isChange = isChange;

        if (process.env.NODE_ENV === 'development') {
            Object.freeze(this.$data);
        }

        return this;
    }

    restore() {
        if (isPlainObject(this.$data)) {
            var data = {};
            for (var key in this.$data) {
                data[key] = null;
            }
            this.set(Object.assign(data, this.constructor.defaultAttributes));
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

        var value = this.$data[key];
        return this.model(key).set(value);
    }

    compute(observers, calc) {
        observers = observers.map((value) => {
            if (isString(value)) {
                return this.observe(value);
            } else {
                return value;
            }
        });

        var observer = new Observer();
        var getArgs = () => observers.map((item) => {
            return item.get();
        });
        var compute = () => observer.set(calc(getArgs()));
        observers.forEach((item) => item.observe(compute));
        compute();
        return observer;
    }

    /**
     * 监听当前 Model 的属性值变化
     */
    observe(attribute, fn) {
        if (attribute && isString(attribute) && fn) {
            this._hasOnChangeListener = true;
            const cb = (e, oldValue, newValue) => {
                if (e.target === this) {
                    return fn.call(this, e, oldValue, newValue);
                }
            };
            cb._cb = fn;
            this.on(parseChanges(attribute), cb);
        }
        return super.observe(attribute, fn);
    }

    unobserve(attribute, fn) {
        attribute && isString(attribute) && this.off(parseChanges(attribute), fn);
        return super.unobserve(attribute, fn);
    }

    getJSON(key) {
        return deepClone(this.get(key));
    }

    toJSON() {
        return extend(true, {}, this.$data);
    }

    destroy() {
        super.destroy();
        for (var key in this.$model) {
            var model = this.$model[key];
            if (model) {
                disconnect(this, model);
            }
        }
    }
}

function attributeFactory(value, name, parent) {
    return parent.constructor.attributeFactory(value, name, parent);
}

function parseChanges(attrs) {
    return "change" + attrs
        .split(/\s+/)
        .filter(name => !!name)
        .map(name => ':' + name)
        .join(' change');
}
