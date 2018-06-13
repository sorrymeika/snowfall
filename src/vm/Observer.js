import { mixin as eventMixin, Event } from '../core/event';
import { enqueueUpdate } from './methods/enqueueUpdate';
import { updateRefs } from './methods/updateRefs';

var nextTask;
var taskId;
var taskCount = 1;
var callbacks = [];

if (typeof MessageChannel !== 'undefined' && /^\[object MessageChannelConstructor\]$|\[native code\]/.test(MessageChannel.toString())) {
    const channel = new MessageChannel();
    const port = channel.port2;
    channel.port1.onmessage = flushCallbacks;
    nextTask = () => {
        port.postMessage(1);
    };
} else {
    nextTask = () => setTimeout(flushCallbacks, 0);
}

function flushCallbacks() {
    var cbs = callbacks;
    taskId = null;
    callbacks = [];

    for (var i = 0; i < cbs.length; i++) {
        cbs[i]();
    }
}

function nextTick(cb) {
    callbacks.push(cb);
    if (!taskId) {
        nextTask();
        taskId = ++taskCount;
    }
    return taskId;
}

export class Observer {
    constructor(data) {
        if (data !== undefined) {
            this.set(data);
        }
        this.root = this;
        this.render = this.render.bind(this);
    }

    get() {
        return this.$data;
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
            key = this.key ? ':' + this.key : '';
        } else if (!fn) {
            return Object.assign((cb) => this.observe(key, cb), {
                context: this,
                attribute: key
            });
        } else {
            key = parseEventName(this.key, key);
        }

        var self = this;
        var cb = function (e) {
            if (e.target === self || self.contains(e.target)) {
                return fn.call(self, e);
            }
        };
        cb._cb = fn;

        return this.root.on('datachanged' + key, cb);
    }

    unobserve(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = this.key ? ':' + this.key : '';
        } else {
            key = parseEventName(this.key, key);
        }

        return this.root.off('datachanged' + key, fn);
    }

    contains(model) {
        if (model === this) return false;
        for (var parent = model.parent; parent; parent = parent.parent) {
            if (parent === this) return true;
        }
        return false;
    }

    nextTick(cb) {
        this._nextTick ? this.one('datachanged', cb) : cb.call(this);
        return this;
    }

    renderNextTick() {
        if (!this._nextTick) {
            this._nextTick = this._rendering ? 1 : (this.taskId = nextTick(this.render));
        }
    }

    render() {
        this._rendering = true;

        var count = 0;
        while (this._nextTick) {
            this._nextTick = null;
            this.trigger(new Event('datachanged', {
                target: this,
                changeCount: count
            }));
            count++;
        }
        this._rendering = false;
    }

    destroy() {
        this.trigger('destroy')
            .off();
    }
}

function parseEventName(selfKey, attrs) {
    return attrs
        .split(/\s+/)
        .filter(name => !!name)
        .map(name => ':' + (selfKey ? selfKey + '.' + name : name))
        .join(' datachanged');
}

eventMixin(Observer);
