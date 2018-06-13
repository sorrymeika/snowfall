import { isCollection } from "../predicates";
import { Event } from "../../core/event";

export function enqueueUpdate(model) {
    if (model.changed) return model;
    model.changed = true;

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

    root.one('datachanged', function (e) {
        links.forEach((ln) => {
            ln._linkChanged = false;
        });
        model.changed = false;
        if (model.key) {
            var name = isCollection(model.parent) ? model.parent.key : model.key;
            root.trigger(new Event("datachanged:" + name, {
                target: model
            }));
        }
    })
        .renderNextTick();

    return model;
}
