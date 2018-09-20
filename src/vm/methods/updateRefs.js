import { isCollection } from "../predicates";
import { getMemberName } from "./connect";

export function updateRefs(model) {
    var parents = model.parents;
    if (parents) {
        var value = model.$data;
        var i = -1;
        var length = parents.length;
        while (++i < length) {
            bubbleUpdate(parents[i], model, getMemberName(parents[i], model), value);
        }
    }
}

function bubbleUpdate(parent, model, key, value) {
    if (isCollection(parent)) {
        if (parent.$array[key] !== value) {
            if (!parent._setting) {
                if (!parent._inEach || (!parent._arrayIsNew && (parent._arrayIsNew = true))) {
                    parent.$array = parent.$array.slice();
                    updateRefs(parent);
                }
            }
            parent.$array[key] = value;
        }
    } else if (parent.$data[key] !== value) {
        if (!parent._setting) {
            parent.$data = { ...parent.$data };
            updateRefs(parent);
        }
        parent.$data[key] = value;
    }
}