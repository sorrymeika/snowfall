import { TEXT_NODE, ELEMENT_NODE } from '../../utils/dom'
import { camelCase } from '../utils/string'

const registedComponents = {};


export class ComponentCompiler {
    constructor(template) {
        this.template = template;
        this.viewModel = template.viewModel;
    }

    compile(node, nodeType) {
        if (nodeType == ELEMENT_NODE) {
            var propsVal;
            var componentName;

            if (node.nodeName.slice(0, 3) === 'SN-') {
                componentName = camelCase(node.nodeName.slice(3).toLowerCase());
                propsVal = node.getAttribute('props');
                node.removeAttribute('props');
            } else if ((componentName = node.getAttribute('sn-component'))) {
                propsVal = node.getAttribute('sn-props');
                node.removeAttribute('sn-component');
                node.removeAttribute('sn-props');
            }
            if (componentName) {
                node.snComponent = registedComponents[componentName] || (
                    typeof this.viewModel.components == 'function'
                        ? this.viewModel.components(componentName)
                        : this.viewModel.components[componentName]
                );
                node.snProps = this.template.compileToFunction(propsVal);
            }
        }
    }

    update(nodeData) {
        var viewModel = this.viewModel;
        var el = nodeData.node;
        var fid = el.snProps;
        var props = !fid ? null : this.template.executeFunction(fid, nodeData.data);

        if (el.snComponentInstance) {
            el.snComponentInstance.set(props);

            nodeData.setRef(el.snComponentInstance);
        } else if (el.snComponent) {
            var children = [];
            var node;
            var snComponent = el.snComponent;
            var instance;

            for (var i = 0, j = el.childNodes.length - 1; i < j; i++) {
                node = el.childNodes[i];

                if (node.nodeType !== TEXT_NODE || !/^\s*$/.test(node.textContent)) {
                    children.push(node);
                    node.snViewModel = viewModel;
                    viewModel.$el.push(node);
                }
            }
            if (typeof snComponent === 'function') {
                instance = new snComponent(props, children);
            } else {
                instance = snComponent;
                if (typeof instance.children === 'function') {
                    instance.children(children);
                }
                instance.set(props);
            }
            instance.$el.appendTo(el);

            el.snComponentInstance = instance;
            delete el.snComponent;

            nodeData.setRef(instance);
        }
    }
}