import { isArray, isNo } from './is'
import style from './style'

export const $ = window.$;

export const TRANSITION_END = $.fx.transitionEnd;

export const TEXT_NODE = document.TEXT_NODE || 3;
export const COMMENT_NODE = document.COMMENT_NODE || 8;
export const ELEMENT_NODE = document.ELEMENT_NODE || 1;

const ConstuctorOf$ = $.zepto ? $.zepto.Z : $.fn.constructor;

export function insertElementAfter(destElem, elem) {
    if (destElem.nextSibling != elem) {
        destElem.nextSibling
            ? destElem.parentNode.insertBefore(elem, destElem.nextSibling)
            : destElem.parentNode.appendChild(elem);
    }
}

export function closestElement(el, fn) {
    for (var parentNode = el.parentNode; parentNode; parentNode = parentNode.parentNode) {
        var res = fn(parentNode, el);
        if (res === true) {
            return parentNode;
        } else if (res === false) {
            break;
        }
    }
    return null;
}

export function cloneElement(node, each) {
    var stack = [];
    var parentCloneStack = [];
    var nodeClone = node.cloneNode(false);
    var parentNode = nodeClone;
    var nextSibling;
    var clone;

    each(node, nodeClone);

    node = node.firstChild;

    while (node) {
        clone = node.cloneNode(false);
        parentNode.appendChild(clone);
        nextSibling = node.nextSibling;

        each(node, clone);

        if (node.firstChild) {
            if (nextSibling) {
                stack.push(nextSibling);
                parentCloneStack.push(parentNode);
            }
            parentNode = clone;
            node = node.firstChild;
        } else if (nextSibling) {
            node = nextSibling;
        } else {
            parentNode = parentCloneStack.pop();
            node = stack.pop();
        }
    }

    return nodeClone;
}

export function eachElement(el, fn) {
    if (!el) return;

    if (isArray(el) || el instanceof ConstuctorOf$) {
        for (var i = 0, len = el.length; i < len; i++) {
            eachElement(el[i], fn);
        }
        return;
    }
    var stack = [];
    var firstLoop = true;

    while (el) {
        var res = fn(el);
        var nextSibling;

        if (res && res.nextSibling) {
            nextSibling = res.nextSibling;
            res = res.isSkipChildNodes === true ? false : true;
        } else if (!firstLoop) {
            nextSibling = el.nextSibling;
        }

        if (firstLoop) firstLoop = false;

        if (res !== false && el.firstChild) {
            if (nextSibling) {
                stack.push(nextSibling);
            }
            el = el.firstChild;
        } else if (nextSibling) {
            el = nextSibling;
        } else {
            el = stack.pop();
        }
    }
}

export function nextNotTextNodeSibling(el) {
    var nextSibling;
    while ((nextSibling = el.nextSibling)) {
        if (nextSibling.nodeType != TEXT_NODE) {
            return nextSibling;
        }
    }
    return null;
}

style('sn-display', '.sn-display { opacity: 1; -webkit-transition: opacity 300ms ease-out 0ms; transition: opacity 300ms ease-out 0ms; }\
.sn-display-show { opacity: 1; }\
.sn-display-hide { opacity: 0; }');

export function fade(el, val) {
    var $el = $(el);
    var isInitDisplay = true;
    if (!$el.hasClass('sn-display')) {
        isInitDisplay = false;
        $el.addClass('sn-display')[0].clientHeight;
    }
    var display = isNo(val) ? 'none' : val == 'block' || val == 'inline' || val == 'inline-block' ? val : '';
    if (display == 'none') {
        if (!$el.hasClass('sn-display-hide')) {
            var onHide = function () {
                if ($el.hasClass('sn-display-hide'))
                    $el.hide();
            }
            $el.addClass('sn-display-hide')
                .one(TRANSITION_END, onHide);
            setTimeout(onHide, 300);
        }
    } else if (!isInitDisplay || $el.hasClass('sn-display-hide')) {
        $el.css({
            display: display
        });
        el.clientHeight;
        $el.removeClass('sn-display-hide');
    }
}