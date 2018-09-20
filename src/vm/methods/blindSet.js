import { Model } from "../Model";
import { isModel } from "../predicates";

export function blindSet(model, renew, keys, val) {
    var lastKey = keys.pop();
    var tmp;
    var key;

    for (var i = 0, len = keys.length; i < len; i++) {
        key = keys[i];

        if (!isModel(model.$model[key])) {
            tmp = model.$model[key] = new Model({}, key, model);
            model.$data[key] = tmp.$data;
            model = tmp;
        } else {
            model = model.$model[key];
        }
    }
    return model.set(renew, lastKey, val);
}