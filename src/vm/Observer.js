import { eventMixin } from '../core/event';
import { enqueueUpdate, nextTick } from './methods/enqueueUpdate';
import { updateRefs } from './methods/updateRefs';
import { get } from '../utils/object';
import { identify } from '../utils/guid';
import { disconnect } from './methods/connect';

interface IObservable {
    get: () => any,
    observe: (cb: (e: any) => any) => any
}

class ChangeObserver implements IObservable {
    constructor(model, name) {
        this.model = model;
        this.name = name;
        this.observers = [];
    }

    get() {
        return this.model.get(this.name);
    }

    observe(cb) {
        this.model.observe(this.name, cb);
        this.observers.push(cb);
    }

    unobserve(cb) {
        this.model.unobserve(this.name, cb);

        const observers = this.observers;
        for (var i = observers.length - 1; i >= 0; i--) {
            if (observers[i] === cb) {
                observers.splice(i, 1);
            }
        }
    }

    destroy() {
        const observers = this.observers;
        for (var i = observers.length - 1; i >= 0; i--) {
            this.model.unobserve(this.name, observers[i]);
        }
        this.model = null;
        this.observers = null;
    }
}

export class Observer implements IObservable {
    constructor(data) {
        this.$id = identify();
        this.$mapper = {};
        this.render = this.render.bind(this);
        if (data !== undefined) {
            this.set(data);
        }
        this.initialized = true;
    }

    get(keys) {
        return keys == null ? get(this.$data, keys) : this.$data;
    }

    set(data) {
        if (this.$data !== data) {
            this.$data = data;
            enqueueUpdate(this);
            updateRefs(this);
        }
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

        return this.on('datachanged' + key, fn);
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

    contains(model) {
        if (model === this) return false;
        for (var parents = model.parents; parents; parents = parent.parents) {
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
        const parents = this.parents;
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

function parseEventName(attrs) {
    return attrs
        ? attrs
            .split(/\s+/)
            .filter(name => !!name)
            .map(name => ':' + name.replace(/\./g, '/'))
            .join(' datachanged')
        : '';
}

eventMixin(Observer);
