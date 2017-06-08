import { $, ELEMENT_NODE, COMMENT_NODE, cloneElement, closestElement, insertElementAfter } from '../utils/dom';
import compileExpression from './compileExpression'
import { findModelByKey, createCollection } from '../adapter'
import { value as valueOfObject } from '../../utils/object'

const SN_REPEAT = 'sn-repeat';

export function isRepeatableNode(node) {
    return node.nodeType === ELEMENT_NODE && node.getAttribute(SN_REPEAT);
}

var ORDER_BY_THIS_FUNCTION = 1;
var ORDER_BY_DELEGATE_FUNCTION = 2;
var ORDER_BY_ATTRIBUTES_FUNCTION = 3;

var RE_REPEAT = /([\w$]+)(?:\s*,(\s*[\w$]+)){0,1}\s+in\s+([\w$]+(?:\.[\w$\(,\)]+){0,})(?:\s*\|\s*filter\s*:\s*(.+?)){0,1}(?:\s*\|\s*orderBy:(.+)){0,1}(\s|$)/;

function initCollectionKey(template, compiler, collectionKey) {
    if (collectionKey.slice(-1) == ')') {
        compiler.isFn = true;
        compiler.fid = template.compileToFunction(compiler.vm, collectionKey, false);

        collectionKey = collectionKey.replace(/\./g, '/');
    } else {
        var attrs = collectionKey.split('.');
        var parentAlias = attrs[0];
        var parent = compiler.parent;

        while (parent) {
            if (parent.alias == parentAlias) {
                attrs[0] = parent.collectionKey + '^child';
                collectionKey = attrs.join('.');
                compiler.offsetParent = parent;
                break;
            }
            parent = parent.parent;
        }
    }

    compiler.collectionKey = collectionKey;
}


function updateRepeatView(template, el) {
    var viewModel = template.viewModel;
    var repeatCompiler = el.snRepeatCompiler;
    var collection = el.snCollection;
    var model;
    var offsetParent = repeatCompiler.offsetParent;
    var parentSNData = {};

    if (repeatCompiler.parent) {
        closestElement(el, function (parentNode) {
            if (parentNode.snRepeatCompiler == repeatCompiler.parent && parentNode.snData) {
                Object.assign(parentSNData, parentNode.snData);
                return true;
            }
        });
    }

    var collectionData;

    if (repeatCompiler.isFn) {
        collectionData = template.executeFunction(repeatCompiler.fid, template.getFunctionArg(el, parentSNData));
    }

    if (!collection) {
        if (!offsetParent) {
            model = viewModel;
        } else {
            closestElement(el, function (parentNode) {
                if (parentNode.snRepeatCompiler == offsetParent) {
                    model = parentNode.snModel;
                    return true;
                }
            })
        }

        if (repeatCompiler.isFn) {
            collection = new createCollection(viewModel, repeatCompiler.collectionKey, collectionData);
        } else {
            collection = model && findModelByKey(model, repeatCompiler.collectionKey);
        }

        if (!collection) return;

        el.snCollection = collection;
    } else if (repeatCompiler.isFn) {
        collection.set(collectionData);
    }

    var elements = el.snElements || (el.snElements = []);
    var list = [];
    var cursorElem = el;
    var elementsLength = elements.length;
    var elemContain = {};

    collection.each(function (model) {
        var elem;
        var elemIndex = -1;
        var snData;

        for (var j = 0; j < elementsLength; j++) {
            if (elements[j].snModel == model) {
                elemContain[j] = true;
                elem = elements[j];
                elemIndex = j;
                break;
            }
        }

        if (!elem) {
            snData = Object.assign({}, parentSNData);
            snData[repeatCompiler.alias] = model;
        } else {
            snData = elem.snData;
        }

        var pass = !repeatCompiler.filter || repeatCompiler.filter.call(viewModel, template.getFunctionArg(elem, snData));
        if (pass) {
            if (!elem) {
                elem = cloneRepeatElement(viewModel, repeatCompiler.source, snData);

                elem.snRepeatCompiler = repeatCompiler;
                elem.snModel = model;

                elements.push(elem);
            }

            list.push({
                el: elem,
                model: model
            });
        } else if (elemIndex != -1) {
            elemContain[elemIndex] = false;
        }
    });

    var orderBy = repeatCompiler.orderBy;
    if (orderBy) {
        var sortFn;
        switch (repeatCompiler.orderByType) {
            case ORDER_BY_THIS_FUNCTION:
                sortFn = valueOfObject(viewModel, orderBy);
                break;
            case ORDER_BY_DELEGATE_FUNCTION:
                sortFn = valueOfObject(viewModel.delegate, orderBy);
                break;
            case ORDER_BY_ATTRIBUTES_FUNCTION:
                sortFn = valueOfObject(viewModel.attributes, orderBy);
                break;
            default:
                // orderBy=['a',true,someFunctionId,false]
                orderBy = orderBy.map(function (item) {
                    if (typeof item === 'number') {
                        return template.executeFunction(item, template.getFunctionArg(el, parentSNData));
                    }
                    return item;
                });

                sortFn = function (am, bm) {
                    var ret = 0;
                    var isDesc;
                    var sort;
                    var a, b;

                    for (var i = 0; i < orderBy.length; i += 2) {
                        sort = orderBy[i];
                        isDesc = orderBy[i + 1] == false;

                        a = am[sort];
                        b = bm[sort];

                        // 中文排序需使用 localeCompare
                        // ret = isDesc ? (a > b ? -1 : a < b ? 1 : 0) : (a > b ? 1 : a < b ? -1 : 0);
                        ret = ((a === undefined || a === null) ? '' : (a + '')).localeCompare(b);
                        isDesc && (ret = !ret);

                        if (ret != 0) return ret;
                    }

                    return ret;
                };
        }
        sortFn && list.sort(function (a, b) {
            return sortFn(a.model.attributes, b.model.attributes);
        });
    }

    list.forEach(function (item, index) {
        var elem = item.el;

        insertElementAfter(cursorElem, elem);
        cursorElem = elem;

        repeatCompiler.loopIndexAlias && (elem.snData[repeatCompiler.loopIndexAlias] = index);
    });

    // 移除过滤掉的element
    for (var i = 0; i < elementsLength; i++) {
        if (!elemContain[i]) {
            var elem = elements[i];
            elem.parentNode && elem.parentNode.removeChild(elem);
        }
    }

    return cursorElem;
}

function cloneRepeatElement(viewModel, source, snData) {
    return cloneElement(source, function (node, clone) {
        clone.snData = snData;
        clone.snIsRepeat = true;

        if (node.snAttributes) clone.snAttributes = node.snAttributes;
        if (node.snEvents) {
            node.snEvents.forEach(function (evt) {
                $(clone).on(evt, viewModel._handleEvent);
            })
        }
        if (node.snRepeatCompiler) clone.snRepeatCompiler = node.snRepeatCompiler;
        if (node.snIfSource) {
            var snIfSource = cloneRepeatElement(viewModel, node.snIfSource, snData);
            clone.snIfSource = snIfSource;
            clone.snIfType = snIfSource.snIfType = node.snIfSource.snIfType;
            clone.snIfFid = snIfSource.snIfFid = node.snIfSource.snIfFid;
            snIfSource.snIf = clone;
        }
    });
}

export class RepeatNodeCompiler {
    constructor(template) {
        this.template = template;
        this.viewModel = template.viewModel;
    }

    compile(node) {
        if (isRepeatableNode(node)) {
            if (process.env.NODE_ENV === 'development') {
                if (node.getAttribute('sn-if')) {
                    throw new Error('can not use sn-if and sn-repeat at the same time!!please use filter instead!!');
                }
            }

            var parentRepeatCompiler;
            var parentNode = node;

            while ((parentNode = (parentNode.snIf || parentNode).parentNode) && !parentNode.snViewModel) {
                if (parentNode.snRepeatCompiler) {
                    parentRepeatCompiler = parentNode.snRepeatCompiler;
                    break;
                }
            }

            node.snRepeatCompiler = new RepeatCompiler(this.template, node, parentRepeatCompiler);
            return { nextSibling: node.nextSibling }
        }
    }

    update(nodeData) {
        var node = nodeData.node;
        if (node.nodeType == COMMENT_NODE && node.snRepeatCompiler) {
            updateRepeatView(this.template, node);
            return true;
        }
    }
}

export default class RepeatCompiler {

    constructor(template, el, parent) {
        this.template = template;
        this.viewModel = template.viewModel;
        this.source = el;
        this.parent = parent;

        this.compile(el.getAttribute(SN_REPEAT));

        parent && parent.appendChild(this);
    }

    appendChild(child) {
        this.children.push(child);
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

        initCollectionKey(this.template, this, collectionKey);
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
            var template = this.template;

            orderByCode.split(/\s*,\s*/).forEach((sort) => {
                var sortKey = (sort = sort.split(' '))[0];
                var sortType = sort[1];

                if (sortKey.charAt(0) == '{' && sortKey.slice(-1) == '}') {
                    sortKey = template.compileToFunction(viewModel, sortKey);
                }
                sortType = (sortType && sortType.charAt(0) == '{' && sortType.slice(-1) == '}')
                    ? template.compileToFunction(viewModel, sortType)
                    : sortType == 'desc' ? false : true;

                orderBy.push(sortKey, sortType);
            });
        }
    }
}