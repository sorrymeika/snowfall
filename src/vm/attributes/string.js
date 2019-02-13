import initializer from "./initializer";
import { source } from "./symbols";
import { isString } from "../../utils";
import { subscribe } from "../Reaction";

export function string(target, name) {
    initializer(target);

    return {
        enumerable: true,
        get() {
            subscribe(this[source], name);
            return this[source].get(name);
        },
        set(val) {
            if (null != val && !isString(val)) {
                throw new Error('property value must be string!');
            }
            this[source].set(name, val);
        }
    };
}