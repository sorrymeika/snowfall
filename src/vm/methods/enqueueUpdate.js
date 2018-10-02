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
    var cbs = callbacks;
    taskId = null;
    callbacks = [];

    for (var i = 0; i < cbs.length; i++) {
        cbs[i]();
    }
}

function asap(cb) {
    callbacks.push(cb);
    if (!taskId) {
        doAsap();
        taskId = ++taskCount;
    }
    return taskId;
}

let dirts;
let flags;
let flushing = false;
let changed;
let nexts;

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
            target.dirty = false;
            emitChange(target);
        }

        changed = null;
    }
    flushing = false;

    if (nexts) {
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
}

function emitChange(target) {
    if (!changed[target.$id]) {
        changed[target.$id] = true;
        target.render();
        target.trigger('datachanged');
        bubbleChange(target);
    }
}

function bubbleChange(target, paths) {
    const parents = target.parents;
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

export function enqueueUpdate(dirt) {
    if (dirt && !dirt.dirty) {
        dirt.dirty = true;

        if (!dirts) {
            dirts = [];
            flags = {};
            if (!flushing) asap(flushDirts);
        }

        if (!flags[dirt.$id]) {
            flags[dirt.$id] = true;
            dirts.push(dirt);
        }
    }
}

export function nextTick(cb) {
    if (dirts || flushing) {
        nexts
            ? nexts.push(cb)
            : (nexts = [cb]);
    } else if (nexts) {
        nexts.push(cb);
    } else {
        cb();
    }
}