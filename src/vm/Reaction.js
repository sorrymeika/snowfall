let currentReaction;

export function subscribe(model, path) {
    if (currentReaction) {
        currentReaction.put(model, path);
    }
}

const resolvedPromise = Promise.resolve();

/**
 * @example
 * const reaction = new Reaction(() => {
 * console.log(123);
 * });
 * reaction.track(()=>{
 *   user.name = 1;
 * })
 * reaction.observe(()=>alert(1))
 * reaction.destroy();
 */
export class Reaction {
    constructor(func) {
        const funcs = [func];
        let emitted = false;
        this.emit = () => {
            if (!emitted) {
                emitted = true;
                resolvedPromise.then(() => {
                    emitted = false;
                    for (let i = 0; i < funcs.length; i++) {
                        funcs[i]();
                    }
                });
            }
        };
        this._disposers = {};
        this._funcs = funcs;
    }

    track(func) {
        this._marks = {};

        currentReaction = this;
        func();
        currentReaction = null;

        const disposers = this._disposers;
        const marks = this._marks;
        const keys = Object.keys(disposers);
        for (let i = 0; i < keys.length; i++) {
            if (!marks[keys[i]]) {
                delete disposers[keys[i]];
            }
        }
    }

    put(model, path) {
        const id = model.state.id + ':' + path;
        if (!this._disposers[id]) {
            this._disposers[id] = () => model.unobserve(path, this.emit);
            model.observe(path, this.emit);
        }
        this._marks[id] = true;
    }

    observe(fn) {
        this._funcs.push(fn);
    }

    destroy() {
        const keys = Object.keys(this._disposers);
        for (let i = 0; i < keys.length; i++) {
            this._disposers[keys[i]]();
        }
        this._disposers = null;
    }
}
