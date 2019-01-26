import { TEXT_NODE } from "../../utils/dom";

class NodeData {
    constructor(template, node) {
        this.template = template;
        this.node = node;
        this.nodeType = node.nodeType;
        this._ref = node;
    }

    setRef(_ref) {
        this._ref = _ref;
    }

    get ref() {
        return this._ref;
    }

    get data() {
        return this._data
            ? this._data
            : this.template.getFunctionArg(this.node, this.node.snData);
    }
}

export default class NodeHandler {
    constructor(template, compilers) {
        this.template = template;
        this.compilers = compilers;
    }

    reduce(el) {
        var res;
        var compilers = this.compilers;
        var nodeType = el.nodeType;
        for (var i = 0; i < compilers.length; i++) {
            res = compilers[i].compile(el, nodeType);
            if (res) {
                return res;
            }
        }
    }

    update(node) {
        var nodeData = new NodeData(this.template, node);
        var res;
        var compilers = this.compilers;

        for (var i = 0; i < compilers.length; i++) {
            res = compilers[i].update(nodeData);
            if (res && res.isBreak) {
                break;
            }
        }

        if ((!res || res.canUpdateAttributes) || nodeData.nodeType === TEXT_NODE) {
            this.template.updateAttributes(nodeData);
        }
        return res;
    }
}