import { Observer, readonlyObserver } from "./Observer";
import { isObservable } from "./predicates";
import { isPlainObject, isFunction } from "../utils";
import { Model } from "./Model";
import { Collection } from "./Collection";

/**
 * 可观察对象
 * @param {any} initalValue
 * @param {Function} [execute]
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
    if (isFunction(initalValue)) {
        const [observer, , next] = readonlyObserver(new Observer());
        const listener = (e) => {
            next(e);
        };
        const dispose = initalValue(listener);
        observer.on('destroy', dispose);
        return observer;
    }
    if (isFunction(execute)) {
        const [observer, set, next] = readonlyObserver(observable(initalValue));
        execute(observer, set, next);
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

observable.interval = (msec) => () => observable(0, (countObserver, set) => {
    const id = setInterval(() => {
        set(countObserver + 1);
    }, msec);
    countObserver.on('destroy', () => {
        clearInterval(id);
    });
});

observable.delay = observable.timer = (msec) => () => observable(undefined, (timerObserver, set) => {
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

observable.fromPromise = (promise) => () => observable(undefined, (observer, set, next) => {
    promise.then((res) => {
        next(res);
    });
});

export default observable;