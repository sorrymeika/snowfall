import { isModelOrCollection } from "../predicates";

export function findChildModel(model, key) {
    if (model.key == key) return model;

    var modelMap = model.$model;

    do {
        var hasChild = false;

        for (var modelKey in modelMap) {
            model = modelMap[modelKey];

            if (!isModelOrCollection(model)) return null;
            if (model.key == key) return model;

            var linkedParents = model._linkedParents;
            var len;
            if (linkedParents && (len = linkedParents.length)) {
                for (var i = 0; i < len; i++) {
                    var childModelKey = linkedParents[i].childModelKey;
                    if (key == childModelKey) return model;

                    if (key.indexOf(childModelKey + '.') == 0) {
                        hasChild = true;
                        key = key.substr(childModelKey.length + 1);
                        break;
                    }
                }
            } else if (key.indexOf(model.key + '.') == 0) {
                hasChild = true;
            }

            if (hasChild && model.$model) {
                modelMap = model.$model;
                break;
            }
        }
    } while (hasChild);

    return null;
}
