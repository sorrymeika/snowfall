import { createModelFactory, createCollectionFactory } from './factories'
import { LINKSCHANGE_EVENT } from './consts';

const Model = createModelFactory();
const Collection = createCollectionFactory();

export function isModel(model) {
    return model instanceof Model;
}

export function isCollection(collection) {
    return collection instanceof Collection;
}

export function isModelOrCollection(model) {
    return isModel(model) || isCollection(model);
}

export function createCollection(parent, attr, val) {
    return new Collection(parent, attr, val);
}

export function updateReference(model) {
    var value = isCollection(model) ? model.array : model.attributes;
    var parents = model._linkedParents
        ? model._linkedParents.map(function (item) {
            return item.model;
        })
        : [];

    if (model.parent) parents.push(model.parent);

    for (var i = 0; i < parents.length; i++) {
        var parent = parents[i];

        if (isCollection(parent)) {
            var index = parent.indexOf(model);
            if (index != -1 && parent.array[index] !== value) {
                if (!parent._isSetting) {
                    parent.array = parent.array.slice();
                    updateReference(parent);
                }
                parent.array[index] = value;
            }
        } else if (parent.attributes[model._key] !== value) {
            if (!parent._isSetting) {
                parent.attributes = Object.assign({}, parent.attributes);
                updateReference(parent);
            }
            parent.attributes[model._key] = value;
        }
    }
}

export function linkModels(model, value, key) {
    var root = model.root;
    var link = {
        childModelKey: key,
        childModel: value,
        childRoot: value.root,
        model: model,
        cb: function () {
            root.render();
        }
    };

    value.root.on(LINKSCHANGE_EVENT + ":" + value.cid, link.cb);

    (value._linkedParents || (value._linkedParents = [])).push(link);
    (root._linkedModels || (root._linkedModels = [])).push(link);
}

export function unlinkModels(model, value) {
    var root = model.root;
    var link;
    var linkedModels = root._linkedModels;
    var linkedParents = value._linkedParents;

    if (linkedModels && linkedParents) {
        for (var i = linkedModels.length - 1; i >= 0; i--) {
            link = linkedModels[i];
            if (link.model == model && link.childModel == value) {
                linkedModels.splice(i, 1);
                linkedParents.splice(linkedParents.indexOf(link));
                value.root.off(LINKSCHANGE_EVENT + ":" + value.cid, link.cb);
                break;
            }
        }
    }
}

export function findModelByKey(model, key) {
    if (model.key == key) return model;

    var modelMap = model._model;

    do {
        var hasChild = false;

        for (var modelKey in modelMap) {
            model = modelMap[modelKey];

            if (!isModelOrCollection(model)) return null;

            if (model.key == key) {
                return model;
            } else {
                var linkedParents = model._linkedParents;
                var len;
                if (linkedParents && (len = linkedParents.length)) {
                    for (var i = 0; i < len; i++) {
                        var childModelKey = linkedParents[i].childModelKey;
                        if (key == childModelKey) {
                            return model;
                        } else if (key.indexOf(childModelKey + '.') == 0) {
                            hasChild = true;
                            key = key.substr(childModelKey.length + 1);
                            break;
                        }
                    }
                } else if (key.indexOf(model.key + '.') == 0) {
                    hasChild = true;
                }
            }

            if (hasChild && model._model) {
                modelMap = model._model;
                break;
            }
        }
    } while (hasChild);

    return null;
}

export function updateModelByKeys(model, renew, keys, val) {
    var lastKey = keys.pop();
    var tmp;
    var key;

    for (var i = 0, len = keys.length; i < len; i++) {
        key = keys[i];

        if (!isModel(model._model[key])) {
            tmp = model._model[key] = new Model(model, key, {});
            model.attributes[key] = tmp.attributes;
            model = tmp;
        } else {
            model = model._model[key];
        }
    }
    return model.set(renew, lastKey, val);
}