import { getMemberName } from "./connect";

var doAsap;
var taskId;
var taskCount = 1;
var callbacks = [];

if (typeof MessageChannel !== 'undefined' && /^\[object MessageChannelConstructor\]$|\[native code\]/.test(MessageChannel.toString())) {
    const channel = new MessageChannel();
    const port = channel.port2;
    channel.port1.onmessage = flushCallbacks;
    doAsap = () => {
        port.postMessage(1);
    };
} else {
    doAsap = () => setTimeout(flushCallbacks, 0);
}

if (process.env.NODE_ENV === 'test') {
    doAsap = () => Promise.resolve().then(flushCallbacks);
}

function flushCallbacks() {
    // console.time('flushCallbacks');
    var cbs = callbacks;
    taskId = null;
    callbacks = [];

    for (var i = 0; i < cbs.length; i++) {
        cbs[i]();
    }
    // console.timeEnd('flushCallbacks');
}

function asap(cb) {
    callbacks.push(cb);
    if (!taskId) {
        doAsap();
        taskId = ++taskCount;
    }
    return taskId;
}

let initializers = {};
let doingInit = false;
let dirts;
// 标记脏数据 flags&&flags[model.state.id] === true;
let flags;
let flushing = false;
let changed;
let nexts;

export function enqueueInit(observer) {
    initializers[observer.state.id] = observer;
    if (doingInit) return;
    doingInit = true;
    asap(() => {
        for (let key in initializers) {
            const item = initializers[key];
            if (!item.state.rendered) {
                item.state.rendered = true;
                item.render();
            }
            bubbleInit(item);
        }
        doingInit = false;
        initializers = {};
        if (nexts && !flushing && !dirts) {
            flushNexts();
        }
    });
}

function bubbleInit(target, paths) {
    const parents = target.state.parents;
    if (parents) {
        const length = parents.length;
        var i = -1;
        var parent;
        while (++i < length) {
            parent = parents[i];
            var name = getMemberName(parent, target);
            var nextPaths = paths ? name + '/' + paths : name;
            if (!initializers[parent.state.id]) {
                parent.trigger('datachanged:' + nextPaths, {
                    paths: nextPaths
                });
            }
            bubbleInit(parent, nextPaths);
        }
    }
}

function flushNexts() {
    let j = -1;
    const fns = nexts;

    // 清空next tick functions
    // nextTick(() => {
    //     model.set({ ...changed })
    //         .nextTick(() => '下一个asap中执行');
    // });
    nexts = null;

    while (++j < fns.length) {
        fns[j]();
    }
}

export function enqueueUpdate(dirt) {
    const { state } = dirt;
    state.rendered = false;

    if (state.initialized && !state.dirty) {
        const { id } = state;
        if (initializers[id]) {
            delete initializers[id];
        }
        state.dirty = true;

        if (!dirts) {
            dirts = [];
            flags = {};
            if (!flushing) asap(flushDirts);
        }

        if (!flags[id]) {
            flags[id] = true;
            dirts.push(dirt);
        }
    }
}

function flushDirts() {
    flushing = true;
    while (dirts) {
        const items = dirts;
        const length = dirts.length;

        changed = {};

        var i = -1;
        var target;

        dirts = null;
        flags = null;

        while (++i < length) {
            target = items[i];
            target.state.dirty = false;
            emitChange(target);
        }

        changed = null;
    }
    flushing = false;

    if (nexts) {
        flushNexts();
    }
}

function emitChange(target) {
    if (!changed[target.state.id]) {
        changed[target.state.id] = true;
        target.state.updated = true;
        if (!target.state.rendered) {
            target.state.rendered = true;

            if (process.env.NODE_ENV === 'development') {
                const prefStart = performance.now();
                target.render();
                if (performance.now() - prefStart > 15) {
                    console.warn('slow render:', performance.now() - prefStart, target);
                }
            } else {
                target.render();
            }
        }
        target.trigger('datachanged');
        bubbleChange(target);
    }
}

function bubbleChange(target, paths) {
    const parents = target.state.parents;
    if (parents) {
        const length = parents.length;
        var i = -1;
        var parent;
        while (++i < length) {
            parent = parents[i];
            var name = getMemberName(parent, target);
            var nextPaths = paths ? name + '/' + paths : name;
            parent.trigger('datachanged:' + nextPaths, {
                paths: nextPaths
            });
            bubbleChange(parent, nextPaths);
            !paths && emitChange(parent);
        }
    }
}

export function emitUpdate(target) {
    const { state } = target;
    if (state.initialized) {
        const { id } = state;
        if (initializers[id]) {
            delete initializers[id];
        }
    }
    changed = {};
    emitChange(target);
    changed = null;
}

export function nextTick(cb) {
    if (dirts || flushing || doingInit) {
        nexts
            ? nexts.push(cb)
            : (nexts = [cb]);
    } else if (nexts) {
        nexts.push(cb);
    } else {
        cb();
        return false;
    }
    return true;
}
