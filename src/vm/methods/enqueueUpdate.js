import { getMemberName } from "./connect";

var taskId;
var taskCount = 1;
var callbacks = [];
var currentRenderId = 0;
var rendering = false;
var renderers = [];
var rendererStore = {};

const resolvedPromise = Promise.resolve();
const doAsap = () => resolvedPromise.then(flushCallbacks);

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
let initializerIds = [];
let doingInit = false;
let dirts;
// 标记脏数据 flags&&flags[model.state.id] === true;
let flags;
let flushing = false;
let changed;
let nexts;

export function enqueueInit(observer) {
    initializers[observer.state.id] = observer;
    initializerIds.push(observer.state.id);
    if (doingInit) return;
    doingInit = true;

    const renderId = currentRenderId;
    asap(() => {
        for (let i = 0; i < initializerIds.length; i++) {
            const item = initializers[initializerIds[i]];
            if (item) {
                addRenderer(item);
                bubbleInit(item);
            }
        }
        initializers = {};
        initializerIds = [];
        if (renderId === currentRenderId && renderers.length) {
            render();
        }
        doingInit = false;
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

export function enqueueUpdate(dirt) {
    const { state } = dirt;

    if (state.initialized && !state.dirty) {
        const { id } = state;
        if (initializers[id]) {
            delete initializers[id];
        }
        state.dirty = true;

        if (!dirts) {
            dirts = [];
            flags = {};
            if (!flushing) {
                currentRenderId++;
                asap(flushDirts);
            }
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

    render();
}

function emitChange(target) {
    if (!changed[target.state.id]) {
        changed[target.state.id] = true;
        target.state.updated = true;
        addRenderer(target);
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

function addRenderer(item) {
    if (!rendererStore[item.state.id]) {
        rendererStore[item.state.id] = true;
        renderers.push(item);
    }
}

function render() {
    rendering = true;
    const renderId = currentRenderId;
    resolvedPromise.then(() => {
        if (renderId === currentRenderId) {
            // console.time('render');

            for (let i = 0; i < renderers.length; i++) {
                const target = renderers[i];
                if (!target.state.rendered) {
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
                target.state.rendered = false;
                target.trigger('render');
            }

            // console.timeEnd('render');

            renderers = [];
            rendererStore = {};
            rendering = false;
            if (nexts) {
                flushNexts();
            }
        }
    });
}

function flushNexts() {
    let j = -1;
    const fns = nexts;

    // 清空next tick functions
    nexts = null;

    while (++j < fns.length) {
        fns[j]();
    }
}

export function nextTick(cb) {
    if (dirts || flushing || doingInit || rendering) {
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
