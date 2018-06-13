import { enqueueUpdate } from "./methods/enqueueUpdate";

const DESTROY = 'destroy';

function ObserverLink(model, childModel, childModelKey) {
    var root = model.root;
    var childRoot = childModel.root;

    this.childModelKey = childModelKey;
    this.childModel = childModel;
    this.childRoot = childModel.root;
    this.model = model;

    this.destroy = this.destroy.bind(this);
    this.cb = this.cb.bind(this);

    root.on(DESTROY, this.destroy);
    childRoot
        .on("linkchange:" + this.childModel.cid, this.cb)
        .on(DESTROY, this.destroy);
}

ObserverLink.prototype.cb = function () {
    enqueueUpdate(this.model);
};

ObserverLink.prototype.destroy = function () {
    unlinkObservers(this.model, this.childModel);
    this.close();
};

ObserverLink.prototype.close = function () {
    this.model.root.off(DESTROY, this.destroy);
    this.childRoot
        .off(DESTROY, this.destroy)
        .off("linkchange:" + this.childModel.cid, this.cb);
};

export function linkObservers(model, child, key) {
    var link = new ObserverLink(model, child, key);

    (child._linkedParents || (child._linkedParents = [])).push(link);
    (model.root._linkedModels || (model.root._linkedModels = [])).push(link);
}

export function unlinkObservers(model, child) {
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
                link.close();
                break;
            }
        }
    }
}
