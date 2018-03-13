import { updateViewNextTick } from "./adapter";

const DESTROY = 'destroy';

function ModelLink(model, childModel, childModelKey) {
    var root = model.root;
    var childRoot = childModel.root;

    this.childModelKey = childModelKey;
    this.childModel = childModel;
    this.childRoot = childModel.root;
    this.model = model;

    root.on(DESTROY, this.destroy, this);
    childRoot
        .on("linkchange:" + this.childModel.cid, this.cb, this)
        .on(DESTROY, this.destroy, this);
}

ModelLink.prototype.cb = function (e) {
    updateViewNextTick(this.model);
};

ModelLink.prototype.destroy = function () {
    unlinkModels(this.model, this.childModel);
    this.close();
};

ModelLink.prototype.close = function () {
    this.model.root.off(DESTROY, this.destroy);
    this.childRoot
        .off(DESTROY, this.destroy)
        .off("linkchange:" + this.childModel.cid, this.cb);
};

export function linkModels(model, child, key) {
    var link = new ModelLink(model, child, key);

    (child._linkedParents || (child._linkedParents = [])).push(link);
    (model.root._linkedModels || (model.root._linkedModels = [])).push(link);
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
                link.close();
                break;
            }
        }
    }
}
