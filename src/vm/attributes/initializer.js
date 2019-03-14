import { Model } from "../Model";
import { source } from "./symbols";
import { isObservable } from "../predicates";
import { isString } from "../../utils";

const INITED = Symbol('inited');

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
    if (obj[INITED]) throw new Error('obj was initialized!');
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

export default function initializer(obj) {
    if (!obj[source]) {
        hoistStaticMethods(obj.constructor);

        Object.defineProperty(obj, source, {
            configurable: true,
            get() {
                const model = new Model();
                model.state.facade = this;
                this[INITED] = true;

                Object.defineProperty(this, source, {
                    get() {
                        return model;
                    }
                });
                return model;
            }
        });
    }
}
