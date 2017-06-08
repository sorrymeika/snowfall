import { ELEMENT_NODE } from '../../utils/dom'
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
}