import { eventMixin } from '../core/event';
import { get } from '../utils/object';
import { identify } from '../utils/guid';
import { enqueueUpdate, nextTick, enqueueInit } from './methods/enqueueUpdate';
import { updateRefs } from './methods/updateRefs';
import { disconnect } from './methods/connect';

function parseEventName(attrs) {
    return attrs
        ? attrs
            .split(/\s+/)
            .filter(name => !!name)
            .map(name => ':' + name.replace(/\./g, '/'))
            .join(' datachanged')
        : '';
}

interface IObservable {
    get: () => any,
    observe: (cb: (value: any) => any) => boolean,
    unobserve: (cb: (value: any) => any) => any,
    destroy: () => never,
    state: {
        complete: boolean
    }
}

class ChangeObserver implements IObservable {
    constructor(observer, name) {
        this.state = { complete: observer.complete };
        this.observer = observer;
        this.name = name;
        this.callbacks = [];
    }

    get() {
        return this.observer.get(this.name);
    }

    observe(cb) {
        this.observer.observe(this.name, cb);
        this.callbacks.push(cb);
    }

    unobserve(cb) {
        this.observer.unobserve(this.name, cb);

        const callbacks = this.callbacks;
        for (var i = callbacks.length - 1; i >= 0; i--) {
            if (callbacks[i] === cb) {
                callbacks.splice(i, 1);
            }
        }
    }

    valueOf() {
        return this.get();
    }

    destroy() {
        const callbacks = this.callbacks;
        for (var i = callbacks.length - 1; i >= 0; i--) {
            this.observer.unobserve(this.name, callbacks[i]);
        }
        this.observer = null;
        this.callbacks = null;
    }
}

/**
 * 可观察对象，new之后不会触发observe，每次set若数据变更会触发observe
 */
export class Observer implements IObservable {

    constructor(data) {
        this.state = {
            initialized: false,
            id: identify(),
            mapper: {},
            changed: false,
            dirty: false,
            complete: false,
            data: undefined
        };
        this.render = this.render.bind(this);
        enqueueInit(this);
        if (data !== undefined) {
            this.set(data);
        }
        this.state.initialized = true;
    }

    get(keys) {
        return keys != null ? get(this.state.data, keys) : this.state.data;
    }

    /**
     * 无论设置数据和老数据是否相同，都强制触发数据变更事件
     * @param {any} data 数据
     */
    forceSet(data) {
        this.set(data);
        enqueueUpdate(this);
        return this;
    }

    set(data) {
        if (this.state.data !== data) {
            this.state.data = data;
            enqueueUpdate(this);
            updateRefs(this);
        }
        return this;
    }

    /**
     * 监听子 Model / Collection 变化
     */
    observe(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = '';
        } else if (!fn) {
            return !key
                ? this
                : new ChangeObserver(this, key);
        } else {
            key = parseEventName(key);
        }

        const cb = () => fn.call(this, this.get());
        cb._cb = fn;
        return this.on('datachanged' + key, cb);
    }

    unobserve(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = '';
        } else {
            key = parseEventName(key);
        }

        return this.off('datachanged' + key, fn);
    }

    compute(compute) {
        const observer = this;
        const [result, setObserver] = readonlyObserver(new Observer(compute(observer.get())));
        const set = function (val) {
            setObserver(compute(val));
        };
        observer.observe(set);
        result.on('destroy', () => observer.unobserve(set));
        return result;
    }

    contains(observer) {
        if (observer === this) return false;
        for (var parents = observer.state.parents; parents; parents = parent.state.parents) {
            if (parents.indexOf(this) !== -1) return true;
        }
        return false;
    }

    nextTick(cb) {
        nextTick(cb);
        return this;
    }

    valueOf() {
        return this.get();
    }

    toString() {
        return this.get() + '';
    }

    render() {
    }

    destroy() {
        const parents = this.state.parents;
        if (parents) {
            var i = -1;
            var length = parents.length;
            while (++i < length) {
                disconnect(parents[i], this);
            }
        }

        this.trigger('destroy')
            .off();
    }
}

eventMixin(Observer);

export function readonlyObserver(observer) {
    const set = observer.set.bind(observer);
    const forceSet = (data) => {
        set(data);
        enqueueUpdate(observer);
    };

    Object.defineProperty(observer, 'set', {
        writable: false,
        value: function (val) {
            throw new Error('can not set readonly observer!');
        },
        enumerable: false
    });
    return [observer, set, forceSet];
}
