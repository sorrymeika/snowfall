import { mixin as mixinEvent, Event } from '../core/event';

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

const DataSet = {
    /**
     * 监听子 Model / Collection 变化
     */
    observe(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = this.key || '';
        } else {
            key = ':' + (this.key ? this.key + '.' + key : key);
        }

        var self = this;
        var cb = function (e) {
            if (e.target === self || self.contains(e.target)) {
                return fn.call(self, e);
            }
        };
        cb._cb = fn;

        return this.root.on('datachanged' + key, cb);
    },

    unobserve(key, fn) {
        if (typeof key === 'function') {
            fn = key;
            key = this.key || '';
        } else {
            key = ':' + (this.key ? this.key + '.' + key : key);
        }

        return this.root.off('datachanged' + key, fn);
    },

    nextTick(cb) {
        this._nextTick ? this.one('datachanged', cb) : cb.call(this);
        return this;
    },

    renderNextTick() {
        if (!this._nextTick) {
            this._nextTick = this._rendering ? 1 : (this.taskId = nextTick(this.render));
        }
    },

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
    },

    destroy() {
        this.trigger('destroy')
            .off();
    }
};

mixinEvent(DataSet);

export function mixinDataSet(Model) {
    Object.assign(Model.prototype, DataSet);
}