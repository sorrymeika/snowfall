import { eventMixin } from '../core/event';
import { get } from '../utils/object';
import { identify } from '../utils/guid';
import { enqueueUpdate, nextTick, enqueueInit } from './methods/enqueueUpdate';
import { updateRefs } from './methods/updateRefs';
import { disconnect } from './methods/connect';
import compute from './operators/compute';

const resolvedPromise = Promise.resolve();

export interface IObservable {
    get: () => any,
    observe: (cb: (value: any) => any) => boolean,
    unobserve: (cb: (value: any) => any) => any,
    destroy: () => never,
    compute: (fn: (value: any) => any) => IObservable,
    state: {
        updated: boolean
    }
}

function next(observer, set, data) {
    return new Promise((done) => {
        observer.state.next = (observer.state.next || resolvedPromise).then(() => {
            return new Promise((resolve) => {
                nextTick(() => {
                    set.call(observer, data);
                    const newData = observer.get();
                    enqueueUpdate(observer);
                    resolve();
                    nextTick(() => done(newData));
                });
            });
        });
    });
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
            updated: false,
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
    next(data) {
        return next(this, this.set, data);
    }

    set(data) {
        if (this.state.changed = (this.state.data !== data)) {
            this.state.data = data;
            enqueueUpdate(this);
            updateRefs(this);
        }
        return this;
    }

    /**
     * 监听子 Model / Collection 变化
     */
    observe(fn) {
        const cb = () => fn.call(this, this.get());
        cb._cb = fn;
        return this.on('datachanged', cb);
    }

    unobserve(fn) {
        return this.off('datachanged', fn);
    }

    compute(cacl) {
        return compute(this.get(), (cb) => {
            this.observe(cb);
            return () => this.unobserve(cb);
        }, cacl);
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
    const set = observer.set;
    Object.defineProperty(observer, 'set', {
        writable: false,
        value: function (val) {
            throw new Error('can not set readonly observer!');
        },
        enumerable: false
    });
    return [observer, set, next.bind(null, observer, set)];
}