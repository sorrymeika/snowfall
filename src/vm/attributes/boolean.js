import initializer from "./initializer";
import { source } from "./symbols";
import { isBoolean } from "../../utils";
import { subscribe } from "../Reaction";

export function boolean(target, name) {
    initializer(target);

    return {
        enumerable: true,
        get() {
            subscribe(this[source], name);
            return this[source].get(name);
        },
        set(val) {
            if (null != val && !isBoolean(val)) {
                throw new Error('property value must be boolean!');
            }
            this[source].set(name, val);
        }
    };
}