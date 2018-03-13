import { mixin as mixinEvent, Event } from '../core/event';
import rAF from '../core/rAF';

var nextTask = (fn) => setTimeout(fn, 0);
var eventLoopId;
var eventId = 1;
var nextEvents = [];

rAF(() => {
    nextTask = rAF;
});

function evalNextTick() {
    var events = nextEvents;
    eventLoopId = null;
    nextEvents = [];

    for (var i = 0; i < events.length; i++) {
        events[i]();
    }
}

function nextTick(cb) {
    nextEvents.push(cb);
    if (!eventLoopId) {
        nextTask(evalNextTick);
        eventLoopId = ++eventId;
    }
    return eventLoopId;
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
            this._nextTick = this._rendering ? 1 : (this.eventLoopId = nextTick(this.render));
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