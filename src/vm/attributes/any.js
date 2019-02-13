import initializer from "./initializer";
import { source } from "./symbols";
import { subscribe } from "../Reaction";

export function object(target, name, decorator) {
    initializer(target);

    return {
        enumerable: true,
        get() {
            subscribe(this[source], name);
            return this[source].get(name);
        },
        set(val) {
            this[source].set(name, val);
        }
    };
}