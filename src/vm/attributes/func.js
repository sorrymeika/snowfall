import initializer from "./initializer";
import { source } from "./symbols";
import { subscribe } from "../Reaction";

export function func(target, name, descriptor) {
    initializer(target);

    const OBSERVER_FUNC_INITED = Symbol('ObserverFuncInited');

    return {
        enumerable: true,
        get() {
            const observer = target[source];
            if (!this[OBSERVER_FUNC_INITED]) {
                this[OBSERVER_FUNC_INITED] = true;
                observer.set(name, descriptor.value);
            }
            subscribe(observer, name);
            return observer.get(name);
        },
        set(val) {
            if (typeof val !== 'function') {
                throw new Error('property value must be function!');
            }
            const observer = target[source];
            if (!this[OBSERVER_FUNC_INITED]) {
                this[OBSERVER_FUNC_INITED] = true;
            }
            observer.set(name, val);
        }
    };
};