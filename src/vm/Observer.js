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

export class Observer implements IObservable {
    constructor(data) {
        this.cid = identify();
        this.mapper = {};
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
                /* eslint no-use-before-define: "off" */
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
        for (var parent = model.parent; parent; parent = parent.parent) {
            if (parent === this) return true;
        }
        return false;
    }

    nextTick(cb) {
        nextTick(cb);
        return this;
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

export class ChangeObserver extends Observer {
    constructor(model, name) {
        super();

        this.model = model;
        this.name = name;
    }

    set() { }

    get() {
        return this.model.get(this.name);
    }

    observe(cb) {
        this.model.observe(this.name, cb);
    }

    unobserve(cb) {
        this.model.unobserve(this.name, cb);
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
