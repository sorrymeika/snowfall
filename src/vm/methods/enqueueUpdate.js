import { getMemberName } from "./connect";

var taskId;
var taskCount = 1;
var callbacks = [];
var currentRenderId = 0;
var rendering = false;
var renderers = [];
var rendererStore = {};

const defer = Promise.prototype.then.bind(Promise.resolve());
const doAsap = () => defer(flushCallbacks);

const getCurrentTime = typeof performance !== 'undefined'
    ? () => performance.now()
    : () => Date.now();

const requestAnimationFrameWithTimeout = process.env.NODE_ENV === 'test' ? defer : function (callback) {
    let rafId,
        timerId;
    rafId = requestAnimationFrame(() => {
        clearTimeout(timerId);
        callback();
    });

    timerId = setTimeout(() => {
        cancelAnimationFrame(rafId);
        callback();
    }, 100);
};

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

export function enqueueInit(observer) {
    initializers[observer.state.id] = observer;
    initializerIds.push(observer.state.id);
    if (doingInit) return;
    doingInit = true;
    rendering = true;

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
                rendering = true;
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
    const renderId = currentRenderId;

    defer(() => {
        if (renderId === currentRenderId) {
            const views = renderers;

            renderers = [];
            rendererStore = {};

            for (let i = 0; i < views.length; i++) {
                views[i].trigger('update');
            }

            renderViews(views);
        }
    });
}

function newFiber() {
    return {
        index: 0,
        views: [],
        viewIds: {},
        renderedIds: {},
        renderedViews: [],
        current: null
    };
}

let nextCallbacks;
let fiber = newFiber();
let isFlushingViews = false;
let flushingStartTime = 0;
let renderStartTime;

function renderViews(newViews) {
    const { views, viewIds } = fiber;
    for (let i = 0; i < newViews.length; i++) {
        const newView = newViews[i];

        if (!viewIds[newView.state.id]) {
            views.push(newView);
            viewIds[newView.state.id] = true;
        }
    }

    if (isFlushingViews) {
        return;
    }
    isFlushingViews = true;
    renderStartTime = getCurrentTime();

    scheduleFlushViews();
}

function scheduleFlushViews() {
    flushingStartTime = getCurrentTime();
    requestAnimationFrame(flushViews);
}

export function shouldContinueFlushingViews() {
    return getCurrentTime() - flushingStartTime < 33;
}

function flushViews() {
    if (!shouldContinueFlushingViews()) {
        scheduleFlushViews();
        return;
    }

    const { index, views, viewIds, renderedViews, renderedIds } = fiber;

    for (let i = index; i < views.length; i++) {
        const target = views[i];
        const id = target.state.id;

        viewIds[id] = false;

        if (!target.state.rendered) {
            target.render(fiber);
            if (fiber.current) {
                target.state.rendered = false;
                scheduleFlushViews();
                return;
            }
            if (!renderedIds[id]) {
                renderedViews.push(target);
                renderedIds[id] = true;
            }
        }
        target.state.rendered = false;

        fiber.index = i + 1;
        fiber.current = null;

        if (!shouldContinueFlushingViews()) {
            scheduleFlushViews();
            return;
        }
    }

    const callbacks = nextCallbacks;

    rendering = false;
    nextCallbacks = null;
    isFlushingViews = false;
    fiber = newFiber();

    for (let i = 0; i < renderedViews.length; i++) {
        renderedViews[i].trigger('render');
    }

    if (callbacks) {
        flushFunctions(callbacks);
    }

    if (getCurrentTime() - renderStartTime > 50) {
        console.log('vm renderred', getCurrentTime() - renderStartTime);
    }
}

function flushFunctions(fns) {
    let j = -1;
    while (++j < fns.length) {
        fns[j]();
    }
}

export function nextTick(cb) {
    if (rendering) {
        nextCallbacks
            ? nextCallbacks.push(cb)
            : (nextCallbacks = [cb]);
    } else if (nextCallbacks) {
        console.error('why nextCallbacks is not empty!!!');
        nextCallbacks.push(cb);
    } else {
        cb();
        return false;
    }
    return true;
}
