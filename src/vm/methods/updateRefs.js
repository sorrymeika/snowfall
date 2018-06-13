import { isCollection } from "../predicates";

export function updateRefs(model) {
    var value = model.$data;

    if (model._linkedParents) {
        model._linkedParents.forEach((item) => {
            bubbleUpdate(item.model, model, item.childModelKey.split('.').pop(), value);
        });
    }
    if (model.parent) {
        bubbleUpdate(model.parent, model, model._key, value);
    }
}

function bubbleUpdate(parent, model, key, value) {
    if (isCollection(parent)) {
        var index = parent.indexOf(model);
        if (index != -1 && parent.$array[index] !== value) {
            if (!parent._isSetting) {
                parent.$array = parent.$array.slice();
                updateRefs(parent);
            }
            parent.$array[index] = value;
        }
    } else if (parent.$data[key] !== value) {
        if (!parent._isSetting) {
            parent.$data = Object.assign({}, parent.$data);
            updateRefs(parent);
        }
        parent.$data[key] = value;
    }
}