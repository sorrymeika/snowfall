import initializer from "./initializer";
import { source } from "./symbols";
import { subscribe } from "../Reaction";

export function array(target, name) {
    initializer(target);

    return {
        enumerable: true,
        get() {
            subscribe(this[source], name);
            return this[source].get(name);
        },
        set(val) {
            if (!Array.isArray(val)) {
                throw new Error('property value must be array!');
            }
            target[source].set(name, val || []);
        }
    };
}