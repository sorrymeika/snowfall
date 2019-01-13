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
        const [observer, , forceSet] = readonlyObserver(new Observer());
        const listener = (e) => {
            forceSet(e);
        };
        const dispose = initalValue(listener);
        observer.on('destroy', dispose);
        return observer;
    }
    if (isFunction(execute)) {
        const [observer, set, forceSet] = readonlyObserver(observable(initalValue));
        execute(observer, set, forceSet);
        return observer;
    }
    if (isObservable(initalValue)) {
        return observable(initalValue.get());
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

observable.fromPromise = (promise) => () => observable(undefined, (observer, set, forceSet) => {
    promise.then((res) => {
        forceSet(res);
    });
});

observable.some = (observers) => {
    const [observer, setObserver] = readonlyObserver(new Observer());
    let count = 0;
    const states = observers.map((item) => {
        if (item.state.complete) {
            count++;
        }
        return item.get();
    });
    const set = (i, val) => {
        const newStates = [...states];
        newStates.index = i;
        newStates.change = val;
        setObserver(newStates);
    };
    const binders = observers.map((item, i) => {
        const binder = (val) => {
            states[i] = val;
            set(i, val);
        };
        item.observe(binder);
        return binder;
    });
    observer.on('destroy', () => {
        observers.forEach((item, i) => item.unobserve(binders[i]));
    });
    if (count != 0) {
        set(-1, null);
    }
    return observer;
};

observable.every = (observers) => {
    const [observer, setObserver] = readonlyObserver(new Observer());
    const states = [];
    const set = (i, val) => {
        const newStates = [...states];
        newStates.index = i;
        newStates.change = val;
        setObserver(newStates);
    };
    let count = 0;
    const counts = observers.map((item, i) => {
        if (item.state.complete) {
            states[i] = item.get();
            count++;
            return 0;
        } else {
            return 1;
        }
    });
    const binders = observers.map((item, i) => {
        const binder = (val) => {
            states[i] = val;
            if (count === observers.length) {
                set(i, val);
            } else {
                count += counts[i];
                counts[i] = 0;
            }
        };
        item.observe(binder);
        return binder;
    });
    observer.on('destroy', () => {
        observers.forEach((item, i) => item.unobserve(binders[i]));
    });
    if (count === observers.length) {
        set(-1, null);
    }
    return observer;
};

observable.once = (observers) => {
    const observer = observable.every(observers)
        .observe(() => {
            observer.destroy();
        });
    return observer;
};

observable.any = (observers) => {
    const [observer, setObserver] = readonlyObserver(new Observer());
    const set = (val) => {
        setObserver(val);
    };
    observers.forEach((item) => {
        item.observe(set);
    });
    observer.on('destroy', () => {
        observers.forEach((item) => item.unobserve(set));
    });
    return observer;
};

export default observable;