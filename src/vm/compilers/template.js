import { TEXT_NODE, ELEMENT_NODE, COMMENT_NODE, eachElement } from '../utils/dom'


import { createAttributeCompiler, createNodeCompiler, createCompiler } from '../adapter'
import RepeatCompiler, { isRepeatableNode } from './RepeatCompiler'
import FunctionCompiler from './FunctionCompiler'


export class TemplateCompiler {
    constructor(viewModel) {
        this.viewModel = viewModel;
        this.compiler = createCompiler(this);
        this.nodeCompiler = createNodeCompiler(this);
        this.functionCompiler = new FunctionCompiler(viewModel);
        this.attributesCompiler = createAttributeCompiler(this);
    }

    compile($element) {
        var viewModel = this.viewModel;

        eachElement($element, (node) => {
            if (node.snViewModel && node.snViewModel != viewModel) return false;

            return this.compileNode(viewModel, node);
        });

        this.compiler.reduce(viewModel, $element);
        this.functionCompiler.compile();

        return $element;
    }

    compileNode(node) {
        var fid;
        var componentName;
        var nodeType = node.nodeType;

        if (nodeType == TEXT_NODE) {
            fid = this.functionCompiler.push(node.textContent);
            if (fid) {
                node.snAttributes = ['textContent', fid];
                node.textContent = '';
            }
            return;
        }

        var result = this.nodeCompiler.reduce(node, nodeType);

        if (node.nodeType != COMMENT_NODE) {
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

            return { nextSibling: nextSibling }
        }

        if (nodeType == ELEMENT_NODE) {
            this.compileAttributes(node, !!componentName);
        }

        return result;
    }

    compileToFunction(expression, withBraces) {
        return this.functionCompiler.push(expression, withBraces);
    }

    compileAttributes(el, isComponent) {
        var attr;
        var val;

        for (var i = el.attributes.length - 1; i >= 0; i--) {
            attr = el.attributes[i].name;
            val = el.attributes[i].value;

            this.attributesCompiler.reduce(el, attr, val);

            if (attr == 'sn-else') {
                initIfElement(el, attr);
            } else if ((val = el.attributes[i].value)) {
                if (attr.slice(0, 3) === "sn-") {
                    switch (attr) {
                        case 'sn-if':
                        case 'sn-else-if':
                            initIfElement(el, attr);
                            el.snIfFid = this.compileToFunction(val.charAt(0) == '{' && val.slice(-1) == '}'
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
                            attributesCompiler.reduce(el, attr, val);
                            break;
                    }
                } else if (attr == "ref" && !isComponent) {
                    viewModel.refs[val] = el;
                } else {
                    attributesCompiler.compile(el, attr, val);
                }
            }
        }
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
