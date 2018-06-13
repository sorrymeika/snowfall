function returnFalse() {
    return false;
}

function returnTrue() {
    return true;
}

export function Event(type, props) {
    props && Object.assign(this, props);
    this.type = type;

    return this;
}

Event.prototype = {
    isDefaultPrevented: returnFalse,

    isPropagationStopped: returnFalse,

    preventDefault: function () {
        this.isDefaultPrevented = returnTrue;
    },

    stopPropagation: function () {
        this.isPropagationStopped = returnTrue;
    }
};

const EventEmitterProto = {
    on(names, callback) {
        if (!callback || !names) return;

        var events = this._events || (this._events = {});

        names.split(/\s+/).forEach((name) => {
            if (name) {
                var type = name.toLowerCase();
                var fns = events[type] || (events[type] = []);
                fns.push(callback);
            }
        });
        return this;
    },

    onceTrue(name, callback) {
        if (!callback) return this;

        var self = this;
        function once() {
            var res = callback.apply(self, arguments);
            if (res === true)
                self.off(name, once);
            return res;
        };

        return this.on(name, once);
    },

    one(name, callback) {
        if (!callback) return this;

        var self = this;
        function once() {
            self.off(name, once);
            return callback.apply(self, arguments);
        };

        return this.on(name, once);
    },

    off(names, callback) {
        if (!this._events) return this;

        if (!names) {
            this._events = null;
        } else if (!callback) {
            names.split(/\s+/).forEach((name) => {
                if (name) {
                    delete this._events[name.toLowerCase()];
                }
            });
        } else {
            names.split(/\s+/).forEach((name) => {
                if (name) {
                    var fns = this._events[name.toLowerCase()];
                    if (fns) {
                        for (var i = fns.length; i >= 0; i--) {
                            if (fns[i] === callback) {
                                fns.splice(i, 1);
                                break;
                            }
                        }
                    }
                }
            });
        }

        return this;
    },

    trigger(e, ...args) {
        if (!this._events || !e) return this;

        typeof e === 'string' && (e = new Event(e));

        var fns;
        var events = this._events;
        var name = e.type.toLowerCase();
        var dotIndex;
        var len;

        while ((dotIndex = name.lastIndexOf('.')) != -1) {
            events[name] && (fns = (fns || []).concat(events[name]));
            name = name.slice(0, dotIndex);
        }
        events[name] && (fns = (fns || []).concat(events[name]));

        if (fns && (len = fns.length)) {
            var i = -1;
            var stoped;

            if (!e.target) e.target = this;

            e.args = args;
            args.unshift(e);

            while (++i < len) {
                if ((stoped = e.isPropagationStopped()) || false === fns[i].apply(this, args)) {
                    if (!stoped) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                    break;
                }
            }
        }
        return this;
    }
};

export function EventEmitter() {
}
EventEmitter.prototype = EventEmitterProto;

export function mixin(fn, ext) {
    Object.assign(typeof fn == 'function' ? fn.prototype : fn, EventEmitterProto, ext);
    return fn;
}

export default Event;

// var event = new EventEmitter();

// var fn = () => console.log(1);
// event.on('asdf asdf2', fn);
// event.trigger('asdf.bbb');
// event.off('asdf', fn);

// event.onceTrue('asdf', () => {
//     console.log('onceTrue');
//     return true;
// });
// event.trigger('asdf.bbb');

// console.log(event);
