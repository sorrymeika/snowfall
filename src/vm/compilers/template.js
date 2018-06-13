import { isArray, isNo } from '../../utils/is';
import { $, TEXT_NODE, ELEMENT_NODE, eachElement, insertElementAfter, fade } from '../../utils/dom';

import { getCompilers } from './compilers';
import FunctionCompiler from './FunctionCompiler';

function isExpression(val) {
    return val.indexOf("{") !== -1 && val.lastIndexOf("}") !== -1;
}

export class TemplateCompiler {
    constructor(viewModel) {
        this.viewModel = viewModel;
        this.functionCompiler = new FunctionCompiler(viewModel);

        var compilers = getCompilers();
        this.compiler = compilers.createCompiler(this);
        this.nodeCompiler = compilers.createNodeCompiler(this);
        this.attributesCompiler = compilers.createAttributeCompiler(this);
    }

    compile($element) {
        var viewModel = this.viewModel;

        eachElement($element, (node) => {
            if (node.snViewModel && node.snViewModel != viewModel) return false;
            return this.compileNode(node);
        });

        this.compiler.reduce($element);
        this.functionCompiler.compile();

        return $element;
    }

    compileNode(node) {
        var fid;
        var componentName;
        var nodeType = node.nodeType;

        if (nodeType == TEXT_NODE) {
            fid = this.functionCompiler.push(node.nodeValue);
            if (fid) {
                node.snAttributes = ['nodeValue', fid];
                node.nodeValue = '';
            }
            return;
        } else if (nodeType == ELEMENT_NODE) {
            var result = this.nodeCompiler.reduce(node);
            this.compileAttributes(node, !!componentName);
            return result;
        }
    }

    compileAttributes(el) {
        var attr;
        var val;
        var attributes = el.attributes;
        var attributesCompiler = this.attributesCompiler;

        for (var i = attributes.length - 1; i >= 0; i--) {
            val = attributes[i].value;
            if (val) {
                attr = attributes[i].name;
                if (attr.slice(0, 3) === "sn-") {
                    switch (attr) {
                        case 'sn-src':
                        case 'sn-html':
                        case 'sn-display':
                        case 'sn-style':
                        case 'sn-css':
                        case 'sn-image':
                            attributesCompiler.compile(el, attr, val, isExpression(val));
                            break;
                        default:
                            attributesCompiler.reduce(el, attr, val);
                            break;
                    }
                } else {
                    if (attr === 'ref' && !isExpression(val)) {
                        val = "{'" + val + "'}";
                    }
                    attributesCompiler.compile(el, attr, val);
                }
            }
        }
    }

    updateNode(node) {
        return this.nodeCompiler.update(node);
    }

    updateAttributes(nodeData) {
        var el = nodeData.node;
        var snAttributes = el.snAttributes;
        if (!snAttributes) return;

        var snValues = (el.snValues || (el.snValues = []));
        var attributesCompiler = this.attributesCompiler;

        for (var i = 0, n = snAttributes.length; i < n; i += 2) {
            var attrName = snAttributes[i];
            var val = this.executeFunction(snAttributes[i + 1], nodeData.data);

            if (attributesCompiler.beforeUpdate(nodeData, attrName, val) === false) {
                continue;
            }

            if (snValues[i / 2] === val) continue;
            snValues[i / 2] = val;

            switch (attrName) {
                case 'nodeValue':
                    updateTextNode(el, val);
                    break;
                case 'value':
                    var nodeName = el.nodeName;
                    if (nodeName === 'INPUT' || nodeName === 'SELECT' || nodeName === 'TEXTAREA') {
                        if (el.value != val || (el.value === '' && val === 0)) {
                            el.value = val;
                        }
                    } else
                        el.setAttribute(attrName, val);
                    break;
                case 'html':
                case 'sn-html':
                    el.innerHTML = val;
                    break;
                case 'sn-visible':
                case 'display':
                    el.style.display = isNo(val) ? 'none' : val == 'block' || val == 'inline' || val == 'inline-block' ? val : '';
                    break;
                case 'sn-display':
                    fade(el, val);
                    break;
                case 'classname':
                case 'class':
                    el.className = val;
                    break;
                case 'sn-css':
                    el.style.cssText += val;
                    break;
                case 'sn-style':
                case 'style':
                    el.style.cssText = val;
                    break;
                case 'checked':
                case 'selected':
                case 'disabled':
                    (el[attrName] = !!val) ? el.setAttribute(attrName, attrName) : el.removeAttribute(attrName);
                    break;
                case 'sn-image':
                case 'src':
                    if (val) {
                        el.src = val;
                    } else {
                        el.removeAttribute('src');
                    }
                    break;
                case 'sn-src':
                    if (val) {
                        if (el.src) {
                            el.src = val;
                        } else {
                            $(el)
                                .one('load error', function (e) {
                                    $(this).animate({
                                        opacity: 1
                                    }, 200);
                                    if (e.type === 'error') el.removeAttribute('src');
                                })
                                .css({
                                    opacity: .3
                                })
                                .attr({
                                    src: val
                                });
                        }
                    } else {
                        el.removeAttribute('src');
                    }
                    break;
                default:
                    val === null ? el.removeAttribute(attrName) : el.setAttribute(attrName, val);
                    break;
            }

            attributesCompiler.update(el, attrName, val);
        }
    }

    compileToFunction(expression, withBraces) {
        return this.functionCompiler.push(expression, withBraces);
    }

    executeFunction(fid, data) {
        return this.functionCompiler.executeFunction(fid, data);
    }

    getFunctionArg(node, data) {
        return this.functionCompiler.getFunctionArg(node, data);
    }
}

function updateTextNode(el, val) {
    var removableTails = el.snTails;
    if (isArray(val) || (typeof val === 'object' && val.nodeType && (val = [val]))) {
        var node = el;
        var newTails = [];

        val.forEach(function (item) {
            var nextSibling = node.nextSibling;
            if (nextSibling !== item) {
                if (
                    item.nodeType || (
                        (!nextSibling ||
                            nextSibling.nodeType !== TEXT_NODE ||
                            nextSibling.nodeValue !== "" + item) &&
                        (item = document.createTextNode(item))
                    )
                ) {
                    insertElementAfter(node, item);
                } else {
                    item = nextSibling;
                }
            }
            if (removableTails) {
                var index = removableTails.indexOf(item);
                if (index !== -1) {
                    removableTails.splice(index, 1);
                }
            }
            node = item;
            newTails.push(item);
        });

        el.nodeValue = '';
        el.snTails = newTails;
    } else {
        el.nodeValue = val;
        el.snTails = null;
    }
    if (removableTails) {
        removableTails.forEach(function (tail) {
            if (tail.parentNode) tail.parentNode.removeChild(tail);
        });
    }
}