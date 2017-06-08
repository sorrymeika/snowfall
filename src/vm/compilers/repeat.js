import { ELEMENT_NODE, COMMENT_NODE } from '../utils/dom';
import { compileExpression, compileToFunction } from './compiler';

const SN_REPEAT = 'sn-repeat';

export function isRepeatableNode(node) {
    return node.nodeType === ELEMENT_NODE && node.getAttribute(SN_REPEAT);
}

var ORDER_BY_THIS_FUNCTION = 1;
var ORDER_BY_DELEGATE_FUNCTION = 2;
var ORDER_BY_ATTRIBUTES_FUNCTION = 3;

var RE_REPEAT = /([\w$]+)(?:\s*,(\s*[\w$]+)){0,1}\s+in\s+([\w$]+(?:\.[\w$\(,\)]+){0,})(?:\s*\|\s*filter\s*:\s*(.+?)){0,1}(?:\s*\|\s*orderBy:(.+)){0,1}(\s|$)/;

function initCollectionKey(collection, collectionKey) {
    if (collectionKey.slice(-1) == ')') {
        collection.isFn = true;
        collection.fid = compileToFunction(collection.vm, collectionKey, false);

        collectionKey = collectionKey.replace(/\./g, '/');
    } else {
        var attrs = collectionKey.split('.');
        var parentAlias = attrs[0];
        var parent = collection.parent;

        while (parent) {
            if (parent.alias == parentAlias) {
                attrs[0] = parent.collectionKey + '^child';
                collectionKey = attrs.join('.');
                collection.offsetParent = parent;
                break;
            }
            parent = parent.parent;
        }
    }

    collection.collectionKey = collectionKey;
}

export class RepeatNodeCompiler {
    constructor(template) {
        this.template = template;
        this.viewModel = template.viewModel;
    }

    compile(node, nodeType) {
        if (nodeType != COMMENT_NODE) {
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
            }
            return { nextSibling: nextSibling }
        }
    }
}

export default class RepeatCompiler {

    constructor(viewModel, el, parent) {
        this.viewModel = viewModel;
        this.source = el;
        this.parent = parent;

        this.compile(el.getAttribute(SN_REPEAT));

        parent && parent.appendChild(this);
    }

    compile(str) {
        var match = str.match(RE_REPEAT);
        var collectionKey = match[3];
        var filter = match[4];
        var orderByCode = match[5];

        this.alias = match[1];
        this.loopIndexAlias = match[2];
        this.children = [];

        this.compileFilter(filter);
        this.compileOrderBy(orderByCode);

        var replacement = document.createComment(collectionKey);
        replacement.snRepeatCompiler = this;
        this.source.parentNode.replaceChild(replacement, this.source);
        this.replacement = replacement;

        initCollectionKey(this, collectionKey);
    }

    compileFilter(filter) {
        if (filter && (filter = compileExpression(filter, false))) {
            this.filter = new Function('$data', filter.code);
        }
    }

    /**
     * @example
     * compileOrderBy('date desc,{somedata} {somevalue}')
     * 
     * @param {String} orderByCode
     */
    compileOrderBy(orderByCode) {
        if (!orderByCode) return;

        if (/^([\w$]+)\.([\w$]+(\.[\w$]+)*)$/.test(orderByCode)) {
            switch (RegExp.$1) {
                case 'this':
                    this.orderByType = ORDER_BY_THIS_FUNCTION;
                    this.orderBy = RegExp.$2;
                    break;
                case 'delegate':
                    this.orderByType = ORDER_BY_DELEGATE_FUNCTION;
                    this.orderBy = RegExp.$2;
                    break;
                default:
                    this.orderByType = ORDER_BY_ATTRIBUTES_FUNCTION;
                    this.orderBy = orderByCode;
            }
        } else {
            var orderBy = this.orderBy = [];
            var viewModel = this.viewModel;

            orderByCode.split(/\s*,\s*/).forEach(function (sort) {
                var sortKey = (sort = sort.split(' '))[0];
                var sortType = sort[1];

                if (sortKey.charAt(0) == '{' && sortKey.slice(-1) == '}') {
                    sortKey = compileToFunction(viewModel, sortKey);
                }
                sortType = (sortType && sortType.charAt(0) == '{' && sortType.slice(-1) == '}')
                    ? compileToFunction(viewModel, sortType)
                    : sortType == 'desc' ? false : true;

                orderBy.push(sortKey, sortType);
            });
        }
    }

    appendChild(child) {
        this.children.push(child);
    }
}