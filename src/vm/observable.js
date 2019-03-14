import { Observer, readonlyObserver } from "./Observer";
import { isObservable } from "./predicates";
import { isPlainObject, isFunction, isString } from "../utils";
import { Model } from "./Model";
import { Collection } from "./Collection";
import State from "./State";
import Emitter from "./Emitter";
import { reactTo } from "./Reaction";

const propertyStore = Symbol('propertyStore');

/**
 * 可观察对象
 * @param {any} initalValue
 * @param {Function|string} [execute]
 * @example
 * const observer =observable(0|{}|[]|'')
 * const observer =observable((fn)=>{
 *   document.body.addEventListener('click', fn);
 *   return () => {
 *     document.body.removeEventListener('click', fn);
 *   }
 * })
 */
const observable = (initalValue, execute) => {
    // 装饰器模式
    if (isString(execute)) {
        Object.defineProperty(initalValue, propertyStore, {
            configurable: true,
            get() {
                const model = new Model();
                model.state.facade = this;
                Object.defineProperty(this, propertyStore, {
                    get() {
                        return model;
                    }
                });
                return model;
            }
        });

        return {
            enumerable: true,
            get() {
                reactTo(this[propertyStore], name);
                const result = this.state.observableProps[name] || this.state.data[name];

                return isObservable(result)
                    ? result.state.facade || result.state.data
                    : result;
            },
            set(val) {
                this[propertyStore].set(name, val);
            }
        };
    }

    if (isFunction(initalValue)) {
        const [observer, set] = readonlyObserver(new State());
        const dispose = initalValue(set);
        observer.on('destroy', dispose);
        return observer;
    }
    if (isFunction(execute)) {
        const [observer, set] = readonlyObserver(isObservable(initalValue) ? initalValue : observable(initalValue));
        execute(observer, set);
        return observer;
    }
    if (isObservable(initalValue)) {
        return initalValue.compute((data) => data);
    }
    if (isPlainObject(initalValue)) {
        return new Model(initalValue);
    } else if (Array.isArray(initalValue)) {
        return new Collection(initalValue);
    } else {
        return new Observer(initalValue);
    }
};

observable.interval = (msec) => () => observable(new Emitter(0), (countObserver, set) => {
    const id = setInterval(() => {
        set(countObserver + 1);
    }, msec);
    countObserver.on('destroy', () => {
        clearInterval(id);
    });
});

observable.delay = observable.timer = (msec) => () => observable(new Emitter(), (timerObserver, set) => {
    let id;
    const clearTimer = () => {
        clearTimeout(id);
    };
    id = setTimeout(() => {
        timerObserver
            .off('destroy', clearTimer);
        set(id);
        id = null;
    }, msec);
    timerObserver.on('destroy', clearTimer);
});

observable.fromPromise = (promise) => () => observable(new Emitter(), (observer, set) => {
    promise.then((res) => {
        set(res);
    });
});

export default observable;