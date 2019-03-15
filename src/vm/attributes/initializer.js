import { Model } from "../Model";
import { source } from "./symbols";
import { isObservable } from "../predicates";
import { isString } from "../../utils";

const propertyStore = new WeakMap();
const initedClasses = new WeakMap();
const instanceStore = new WeakMap();

function validObj(obj, constructor) {
    if (process.env.NODE_ENV === "development") {
        if (!obj instanceof constructor) {
            throw new Error('obj must instanceof' + constructor);
        }
        if (!isObservable(obj[source])) {
            throw new Error('unavailable object!');
        }
    }
    return obj[source];
}

function init(obj, data) {
    if (data == null) return;
    if (instanceStore.has(obj)) throw new Error('obj was initialized!');
    const model = validObj(obj, this);
    model.state.initialized = false;
    model.set(data);
    model.state.initialized = true;
}

function observe(obj, arg1, arg2) {
    validObj(obj, this).observe(arg1, arg2);
    return () => unobserve(obj, arg1, arg2);
}

function unobserve(obj, arg1, arg2) {
    validObj(obj, this).unobserve(arg1, arg2);
}

function compute(obj, arg1, arg2) {
    return validObj(obj, this).compute(arg1, arg2);
}

function get(obj, key) {
    return validObj(obj, this).get(key);
}

function set(obj, arg1, arg2) {
    let source = validObj(obj, this);
    let fn;
    if (isString(arg1)) {
        source = source._(arg1);
        fn = arg2;
    } else {
        fn = arg1;
    }
    if (typeof fn === 'function') {
        fn(source);
    } else {
        source.set(fn);
    }
}

export function hoistStaticMethods(obj) {
    obj.init = init;
    obj.observe = observe;
    obj.unobserve = unobserve;
    obj.compute = compute;
    obj.get = get;
    obj.set = set;
}

export default function initializer(obj, name, descriptor) {
    if (!initedClasses.has(obj)) {
        initedClasses.set(obj, true);

        hoistStaticMethods(obj.constructor);

        Object.defineProperty(obj, source, {
            configurable: true,
            get() {
                const proto = this.constructor.prototype;
                if (proto === this) {
                    return true;
                }

                let initProperties;
                if (propertyStore.has(proto)) {
                    const props = propertyStore.get(proto);
                    const instance = Object.create(this, props.reduce((result, { name, desc }) => {
                        result[name] = {
                            get() {
                                return desc.initializer
                                    ? desc.initializer.call(instance)
                                    : desc.value;
                            }
                        };
                        return result;
                    }, {}));
                    initProperties = props.reduce((result, { name }) => {
                        result[name] = instance[name];
                        return result;
                    }, {});
                } else {
                    initProperties = {};
                }

                const model = new Model(initProperties);
                model.state.facade = this;

                instanceStore.set(this, true);

                Object.defineProperty(this, source, {
                    get() {
                        return model;
                    }
                });
                return model;
            }
        });
    }

    if (descriptor.initializer || descriptor.value !== undefined) {
        let initProperties = propertyStore.get(obj);
        if (!initProperties) {
            propertyStore.set(obj, initProperties = []);
        }
        initProperties.push({
            name: name,
            desc: descriptor
        });
    }
}
