import { isBoolean, isArray, isPlainObject, isThenable, isString } from '../utils/is';
import { extend, deepClone } from '../utils/clone';
import { identify } from '../utils/guid';

import { Event } from '../core/event';
import { linkObservers, unlinkObservers } from './linker';

import { Observer } from './Observer';
import { Collection } from './Collection';

import { isModel, isCollection, isObservable } from './predicates';

import { enqueueUpdate } from './methods/enqueueUpdate';
import { blindSet } from './methods/blindSet';
import { updateRefs } from './methods/updateRefs';

const toString = Object.prototype.toString;
const RE_QUERY = /(?:^|\.)([_a-zA-Z0-9]+)(\[(?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[^\]])+\](?:\[[\+\-]?\d*\])?)?/g;

function attributeFactory(parent, name, value) {
    return parent.constructor.attributeFactory(parent, name, value);
}

export class Model extends Observer {
    static attributeFactory(parent, name, value) {
        if (isPlainObject(value)) {
            return new Model(parent, name, value);
        } else if (isArray(value)) {
            return new Collection(parent, name, value);
        } else {
            return value;
        }
    }

    constructor(parent, key, attributes) {
        super();

        if (arguments.length <= 1) {
            var defaultAttributes = this.constructor.defaultAttributes;

            this.root = this;
            attributes = parent === undefined
                ? extend({}, this.attributes, defaultAttributes)
                : isPlainObject(defaultAttributes)
                    ? Object.assign({}, defaultAttributes, parent)
                    : parent;
        } else {
            if (isModel(parent)) {
                this.key = parent.key ? parent.key + '.' + key : key;
                this._key = key;
            } else if (isCollection(parent)) {
                this.key = parent.key + '^child';
                this._key = parent._key + '^child';
                this.parentIsCollection = true;
            } else {
                throw new Error('Model\'s parent mast be Collection or Model');
            }
            this.parent = parent;
            this.root = parent.root;
        }

        this.cid = identify();

        this.$data = null;
        this.$model = {};

        this.changed = false;

        this.set(attributes);
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

    get(key) {
        if (!this.$data) return undefined;
        if (typeof key === 'undefined') return this.$data;

        if (typeof key == 'string') {
            var keys = key.split(/\s+/)
                .filter(name => !!name);
            if (keys.length >= 2) {
                return keys.map((name) => this.get(name));
            }
            if (key.indexOf('.') != -1) {
                key = key.split('.');
            }
        }

        var data;
        if (isArray(key)) {
            data = this.$data;

            for (var i = key[0] == 'this' ? 1 : 0, len = key.length; i < len; i++) {
                if (!(data = data[key[i]]))
                    return null;
            }
        } else if (key == 'this') {
            return this.$data;
        } else {
            data = this.$data[key];
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
        var $model = this.$model;

        for (var attr in attrs) {
            origin = $model[attr] || attributes[attr];
            value = attrs[attr];
            if (origin !== value) {
                if (isObservable(value)) {
                    $model[attr] = value;
                    attributes[attr] = value.$data;

                    if (isObservable(origin)) {
                        unlinkObservers(this, origin);
                    }
                    linkObservers(this, value, this.key ? this.key + '.' + attr : attr);

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
                    value = attributeFactory(this, attr, value);
                    if (isObservable(value)) {
                        $model[attr] = value;
                        attributes[attr] = value.$data;
                    } else {
                        changes.push(this.key ? this.key + "." + attr : attr, value, attributes[attr]);
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
                    root.trigger(new Event("change:" + changes[i], {
                        target: this
                    }), changes[i + 1], changes[i + 2]);
                }
            }
        } else {
            this.$data = oldAttributes;
        }
        this._isSetting = false;
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

    compute(listeners, calc) {
        var observer = new Observer();
        var args = [];
        var getArgs = () => args.map((arg) => {
            return arg.context.get(arg.attribute);
        });
        var compute = () => observer.set(calc(...getArgs()));
        listeners.forEach((listener) => {
            if (isString(listener)) {
                args.push({
                    context: this,
                    attribute: listener
                });
                this.change(listener, compute);
            } else {
                args.push(listener);
                listener(compute);
            }
        });
        compute();
        return observer;
    }

    /**
     * 监听当前 Model 的属性值变化
     */
    change(attribute, fn) {
        if (!fn) {
            return Object.assign((cb) => this.change(attribute, cb), {
                context: this,
                attribute
            });
        }
        this._hasOnChangeListener = true;
        this.root.on(parseChanges(attribute), (e, oldValue, newValue) => {
            if (e.target === this) {
                return fn.call(this, e, oldValue, newValue);
            }
        });
    }

    getJSON(key) {
        return deepClone(this.get(key));
    }

    toJSON() {
        return extend(true, {}, this.$data);
    }
}

function parseChanges(attrs) {
    return "change" + attrs
        .split(/\s+/)
        .filter(name => !!name)
        .map(name => ':' + name)
        .join(' change');
}
