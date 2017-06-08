import { ELEMENT_NODE } from '../utils/dom';

export default function createNodeCompilerFactory(compilers) {

    class NodeData {
        constructor(template, node) {
            this.template = template;
            this.node = node;
            this.nodeType = node.nodeType;
        }

        get data() {
            return this._data
                ? this._data
                : this.template.getFunctionArg(this.node, this.node.snData)
        }
    }

    class NodeCompiler {
        constructor(template) {
            this.template = template;
            this.compilers = compilers.map((Compiler) => new Compiler(template))
        }

        reduce(el) {
            var res;
            for (var i = 0; i < compilers.length; i++) {
                if ((res = compilers[i].compile(el))) {
                    return res;
                }
            }
        }

        update(node) {
            var nodeData = new NodeData(this.template, node);
            var res;
            for (var i = 0; i < compilers.length; i++) {
                res = compilers[i].update(nodeData);
                if (res === true || (res && res.isBreak)) {
                    break;
                }
            }

            if (node.nodeType == ELEMENT_NODE) {
                if (!res || res.shouldUpdateAttributes) {
                    this.template.updateAttributes(nodeData);
                }
            }

            return res;
        }
    }

    return function createNodeCompiler(templateCompiler, el, isComponent) {
        return new NodeCompiler(templateCompiler, el, isComponent);
    }
}