
import { isNo } from '../utils/is'
import { TEXT_NODE, ELEMENT_NODE, nextNotTextNodeSibling } from '../utils/dom'
import NodeUpdateResult from './NodeUpdateResult'

const SN_IF = 'sn-if';
const SN_ELSE_IF = 'sn-else-if';
const SN_ELSE = 'sn-else';

function initElementIf(el, type) {
    var snIf = document.createComment(type);
    snIf.snIfSource = el;
    el.snIf = snIf;
    el.snIfType = snIf.snIfType = type;
    if (el.snViewModel) snIf.snViewModel = el.snViewModel;
    if (el.parentNode) {
        el.parentNode.insertBefore(snIf, el);
        el.parentNode.removeChild(el);
    }
    el.snReplacement = snIf;
    el.removeAttribute(type);
    return { nextSibling: snIf.nextSibling }
}

function setFunctionId(template, node, val) {
    node.snIfFid = template.compileToFunction(val.charAt(0) == '{' && val.slice(-1) == '}'
        ? val.slice(1, -1)
        : val,
        false);
}

function insertBeforeIfElement(el) {
    if (!el.parentNode) {
        el.snIf.nextSibling
            ? el.snIf.parentNode.insertBefore(el, el.snIf.nextSibling)
            : el.snIf.parentNode.appendChild(el);
    }
}

function updateIfElement(viewModel, el) {
    if (!el.parentNode) {
        if (el.snViewModel) {
            var nextEl = nextNotTextNodeSibling(el.snIf);
            if (nextEl && nextEl.snViewModel == el.snViewModel) {
                return { nextSibling: nextEl };
            }
            return;
        }
        return {
            isSkipChildNodes: true,
            nextSibling: el.snIf.nextSibling
        };
    } else {
        var nextElement = el.nextSibling;
        var currentElement = el;

        while (nextElement) {
            if (nextElement.nodeType === TEXT_NODE) {
                nextElement = nextElement.nextSibling;
                continue;
            }

            if (currentElement.snViewModel != nextElement.snViewModel) {
                return;
            }

            if ((!nextElement.snIf && !nextElement.snIfSource) || nextElement.snIfType == 'sn-if') {
                break;
            }

            switch (nextElement.snIfType) {
                case 'sn-else':
                case 'sn-else-if':
                    if (nextElement.snIf) {
                        nextElement.parentNode.removeChild(nextElement);
                        currentElement = nextElement.snIf;
                    } else {
                        currentElement = nextElement;
                    }
                    break;
                default:
                    throw new Error(nextElement.snIfType, ':snIfType not available');
            }
            nextElement = currentElement.nextSibling;
        }

        return { nextSibling: currentElement.nextSibling };
    }
}

export class IfCompiler {

    constructor(template) {
        this.template = template;
        this.viewModel = template.viewModel;
    }

    compile(node, nodeType) {
        if (nodeType == ELEMENT_NODE) {
            var val;
            if ((val = node.getAttribute(SN_IF))) {
                setFunctionId(this.template, node, val);
                return initElementIf(node, SN_IF);
            } else if ((val = node.getAttribute(SN_ELSE_IF))) {
                setFunctionId(this.template, node, val);
                return initElementIf(node, SN_ELSE_IF);
            } else if (node.getAttribute(SN_ELSE) !== null) {
                return initElementIf(node, SN_ELSE);
            }
        }
    }

    update(nodeData) {
        var node = nodeData.node;

        if (node.snIfSource) {
            return {
                isSkipChildNodes: true,
                nextSibling: node.snIfSource
            };
        } else if (node.snIf) {
            switch (node.snIfType) {
                case "sn-else":
                    insertBeforeIfElement(node);
                    break;
                case "sn-if":
                case "sn-else-if":
                    if (isNo(this.template.executeFunction(node.snIfFid, nodeData.data))) {
                        if (node.parentNode) {
                            node.parentNode.removeChild(node);
                        }
                        return;
                    } else {
                        insertBeforeIfElement(node);
                    }
                    break;
            }
            return new NodeUpdateResult(updateIfElement(this.viewModel, node));
        }
    }
}