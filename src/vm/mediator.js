
import Event from '../core/event';

const factories = {};

export function initFactories(Model, Collection) {
    factories.Model = Model;
    factories.Collection = Collection;
}

export function createModelFactory() {
    return factories.Model;
}

export function createCollectionFactory() {
    return factories.Collection;
}

export function isModel(model) {
    return model instanceof factories.Model;
}

export function isCollection(collection) {
    return collection instanceof factories.Collection;
}

export function isModelOrCollection(model) {
    return isModel(model) || isCollection(model);
}

export function updateViewNextTick(model) {
    if (model.changed) return model;
    model.changed = true;

    if (isCollection(model.parent)) {
        updateViewNextTick(model.parent);
    }
    var root = model.root;
    var link = model;
    var links = [];

    while (link) {
        if (link._linkedParents && link._linkedParents.length && !link._linkChanged) {
            link._linkChanged = true;
            links.push(link);
            root.trigger("linkchange:" + link.cid);
        }
        link = link.parent;
    }

    root.one('datachanged', function () {
        links.forEach((ln) => {
            ln._linkChanged = false;
        });
        model.changed = false;
        model.key && root.trigger(new Event("datachanged:" + model.key, {
            target: model
        }));
    }).renderNextTick();

    return model;
}

function updateReferenceByKey(parent, model, key, value) {
    if (isCollection(parent)) {
        var index = parent.indexOf(model);
        if (index != -1 && parent.$array[index] !== value) {
            if (!parent._isSetting) {
                parent.$array = parent.$array.slice();
                updateReference(parent);
            }
            parent.$array[index] = value;
        }
    } else if (parent.$attributes[key] !== value) {
        if (!parent._isSetting) {
            parent.$attributes = Object.assign({}, parent.$attributes);
            updateReference(parent);
        }
        parent.$attributes[key] = value;
    }
}

export function updateReference(model) {
    var value = isCollection(model) ? model.$array : model.$attributes;

    if (model._linkedParents) {
        model._linkedParents.forEach((item) => {
            updateReferenceByKey(item.model, model, item.childModelKey, value);
        });
    }
    if (model.parent) {
        updateReferenceByKey(model.parent, model, model._key, value);
    }
}

export function findModelByKey(model, key) {
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

export function updateModelByKeys(model, renew, keys, val) {
    var lastKey = keys.pop();
    var tmp;
    var key;

    for (var i = 0, len = keys.length; i < len; i++) {
        key = keys[i];

        if (!isModel(model.$model[key])) {
            tmp = model.$model[key] = new factories.Model(model, key, {});
            model.$attributes[key] = tmp.$attributes;
            model = tmp;
        } else {
            model = model.$model[key];
        }
    }
    return model.set(renew, lastKey, val);
}

export function removeAttribute(el, attributeName) {
    var snAttributes = el.snAttributes;
    if (snAttributes) {
        for (var i = 0, n = snAttributes.length; i < n; i += 2) {
            if (snAttributes[i] == attributeName) {
                el.snValues[i / 2] = undefined;
                break;
            }
        }
    }
    el.removeAttribute(attributeName);
}

export function findViewModel(el) {
    for (; el; el = el.parentNode) {
        if (el.snViewModel) {
            return el.snViewModel;
        }
    }
}