import initializer from "./initializer";
import { source } from "./symbols";
import { isNumber } from "../../utils";
import { subscribe } from "../Reaction";

export function number(target, name, decorator) {
    initializer(target);

    return {
        enumerable: true,
        get() {
            subscribe(this[source], name);
            return this[source].get(name);
        },
        set(val) {
            if (null != val && !isNumber(val)) {
                throw new Error('property value must be number!');
            }
            this[source].set(name, val);
        }
    };
}