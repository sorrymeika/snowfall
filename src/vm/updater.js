import { DATACHANGED_EVENT, LINKSCHANGE_EVENT } from './consts';
import {
    isCollection
} from './adapter';

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
    }).render();

    return model;
}