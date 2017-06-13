
import { DATACHANGED_EVENT, LINKSCHANGE_EVENT } from './consts';

var Model;
var Collection;
var ViewModel;

export function __init__(_Model, _Collection, _ViewModel) {
    Model = _Model;
    Collection = _Collection;
    ViewModel = _ViewModel;
}

export function isModel(model) {
    return model instanceof Model;
}

export function isCollection(collection) {
    return collection instanceof Collection;
}

export function isModelOrCollection(model) {
    return isModel(model) || isCollection(model);
}

export function createModel(parent, attr, val) {
    return new Model(parent, attr, val);
}

export function createCollection(parent, attr, val) {
    return new Collection(parent, attr, val);
}

export function createViewModel(parent, attr, val) {
    return new ViewModel(parent, attr, val);
}

export function updateViewNextTick(model) {
    if (model.changed) return model;
    model.changed = true;

    if (isCollection(model.parent)) {
        updateViewNextTick(model.parent);
    }

    var root = model.root;
    root.one(DATACHANGED_EVENT, function () {
        model.changed = false;
        model.key && root.trigger(new Event(DATACHANGED_EVENT + ":" + model.key, {
            target: model
        }));

        while (model) {
            if (model._linkedParents && model._linkedParents.length) {
                root.trigger(LINKSCHANGE_EVENT + ":" + model.cid);
            }
            model = model.parent;
        }
    }).renderNextTick();

    return model;
}

function updateReferenceByKey(parent, model, key, value) {
    if (isCollection(parent)) {
        var index = parent.indexOf(model);
        if (index != -1 && parent.array[index] !== value) {
            if (!parent._isSetting) {
                parent.array = parent.array.slice();
                updateReference(parent);
            }
            parent.array[index] = value;
        }
    } else if (parent.attributes[key] !== value) {
        if (!parent._isSetting) {
            parent.attributes = Object.assign({}, parent.attributes);
            updateReference(parent);
        }
        parent.attributes[key] = value;
    }
}

export function updateReference(model) {
    var value = isCollection(model) ? model.array : model.attributes;

    if (model._linkedParents) {
        model._linkedParents.forEach((item) => {
            updateReferenceByKey(item.model, model, item.childModelKey, value);
        })
    }
    if (model.parent) {
        updateReferenceByKey(model.parent, model, model._key, value);
    }
}

export function linkModels(model, child, key) {
    var root = model.root;
    var childRoot = child.root;
    var link = {
        childModelKey: key,
        childModel: child,
        childRoot: childRoot,
        model: model,
        cb: function () {
            root.renderNextTick();
        }
    };
    var unlink = function () {
        unlinkModels(model, child);
        root.off('destroy', unlink);
        childRoot.off('destroy', unlink);
    }

    root.on('destroy', unlink);
    childRoot.on('destroy', unlink)
        .on(LINKSCHANGE_EVENT + ":" + child.cid, link.cb);

    (child._linkedParents || (child._linkedParents = [])).push(link);
    (root._linkedModels || (root._linkedModels = [])).push(link);
}

export function unlinkModels(model, child) {
    var root = model.root;
    var link;
    var linkedModels = root._linkedModels;
    var linkedParents = child._linkedParents;

    if (linkedModels && linkedParents) {
        for (var i = linkedModels.length - 1; i >= 0; i--) {
            link = linkedModels[i];
            if (link.model == model && link.childModel == child) {
                linkedModels.splice(i, 1);
                linkedParents.splice(linkedParents.indexOf(link), 1);
                child.root.off(LINKSCHANGE_EVENT + ":" + child.cid, link.cb);
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
            tmp = model._model[key] = createModel(model, key, {});
            model.attributes[key] = tmp.attributes;
            model = tmp;
        } else {
            model = model._model[key];
        }
    }
    return model.set(renew, lastKey, val);
}