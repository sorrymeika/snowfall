import { TEXT_NODE, COMMENT_NODE, eachElement } from '../utils/dom'
import { camelCase } from '../utils/string'


import { createAttributesCompiler } from './adapter'
import RepeatCompiler, { isRepeatableNode } from './RepeatCompiler'
import FunctionCompiler from './FunctionCompiler'


export class TemplateCompiler {
    constructor(viewModel) {
        this.viewModel = viewModel;
        this.functionCompiler = new FunctionCompiler(viewModel);
    }

    compile($element) {
        var viewModel = this.viewModel;

        eachElement($element, function (node) {
            if (node.snViewModel && node.snViewModel != viewModel) return false;

            if (node.nodeType != COMMENT_NODE)
                compileNode(viewModel, node);

            var nextSibling;
            if (isRepeatableNode(node)) {
                if (node.snIf) throw new Error('can not use sn-if and sn-repeat at the same time!!please use filter instead!!');

                var parentRepeatCompiler;
                var parentNode = node;

                while ((parentNode = (parentNode.snIf || parentNode).parentNode) && !parentNode.snViewModel) {
                    if (parentNode.snRepeatCompiler) {
                        parentRepeatCompiler = parentNode.snRepeatCompiler;
                        break;
                    }
                }

                nextSibling = node.nextSibling;
                node.snRepeatCompiler = new RepeatCompiler(viewModel, node, parentRepeatCompiler);
            } else if (node.snIf) {
                nextSibling = node.snIf.nextSibling
            }
            return { nextSibling: nextSibling };
        });

        this.functionCompiler.compile();

        bindEvents(viewModel, $element);

        return $element;
    }

}

var registedComponents = {};

function compileNode(viewModel, el) {
    var fid;
    var componentName;

    if (el.nodeType === TEXT_NODE) {
        fid = compileToFunction(viewModel, el.textContent);
        if (fid) {
            el.snAttributes = ['textContent', fid];
            el.textContent = '';
        }
        return;
    } else {
        var propsVal;
        if (el.nodeName.slice(0, 3) === 'SN-') {
            componentName = camelCase(el.nodeName.slice(3).toLowerCase());
            propsVal = el.getAttribute('props');
            el.removeAttribute('props');
        } else if ((componentName = el.getAttribute('sn-component'))) {
            propsVal = el.getAttribute('sn-props');
            el.removeAttribute('sn-component');
            el.removeAttribute('sn-props');
        }
        if (componentName) {
            el.snComponent = registedComponents[componentName] || (
                typeof viewModel.components == 'function'
                    ? viewModel.components(componentName)
                    : viewModel.components[componentName]
            );
            el.snProps = compileToFunction(viewModel, propsVal);
        }
    }

    compileElementAttributes(viewModel, el, !!componentName);
}

function compileElementAttributes(viewModel, el, isComponent) {
    var attr;
    var val;
    var attributesCompiler = createAttributesCompiler(viewModel, el, isComponent);

    for (var i = el.attributes.length - 1; i >= 0; i--) {
        attr = el.attributes[i].name;

        if (attr == 'sn-else') {
            initIfElement(el, attr);
        } else if ((val = el.attributes[i].value)) {
            if (attr.slice(0, 3) === "sn-") {
                switch (attr) {
                    case 'sn-if':
                    case 'sn-else-if':
                        initIfElement(el, attr);
                        el.snIfFid = compileToFunction(viewModel,
                            val.charAt(0) == '{' && val.slice(-1) == '}'
                                ? val.slice(1, -1)
                                : val,
                            false);
                        break;
                    case 'sn-src':
                    case 'sn-html':
                    case 'sn-display':
                    case 'sn-style':
                    case 'sn-css':
                        compileAttribute(viewModel, el, attr, val, val.indexOf("{") != -1 && val.lastIndexOf("}") != -1);
                        break;
                    case 'sn-model':
                        el.removeAttribute(attr);
                        el.setAttribute(viewModel.snModelKey, val);
                        break;
                    default:
                        attributesCompiler.reduce(attr, val);
                        break;
                }
            } else if (attr == "ref" && !isComponent) {
                viewModel.refs[val] = el;
            } else {
                compileAttribute(viewModel, el, attr, val);
            }
        }
    }
}

function compileAttribute(viewModel, el, attr, val, withBraces) {
    var fid = compileToFunction(viewModel, val, withBraces)
    if (fid) {
        (el.snAttributes || (el.snAttributes = [])).push(attr, fid);
        el.removeAttribute(attr);
    }
}

function initIfElement(el, type) {
    var snIf = document.createComment(type);
    snIf.snIfSource = el;
    el.snIf = snIf;
    el.snIfType = snIf.snIfType = type;
    if (el.snViewModel) snIf.snViewModel = el.snViewModel;
    if (el.parentNode) {
        el.parentNode.insertBefore(snIf, el);
        el.parentNode.removeChild(el);
    }
}
