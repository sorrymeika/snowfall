import { TRANSITION_END } from '../utils/dom'
import { RE_STRING, codeRegExp } from '../utils/regex'

export const EVENTS = {
    tap: 'tap',
    longtap: 'longTap',
    'long-tap': 'longTap',
    transitionend: TRANSITION_END,
    'transition-end': TRANSITION_END,
    touchstart: 'touchstart',
    touchend: 'touchend',
    touchmove: 'touchmove',
    click: 'click',
    load: 'load',
    error: 'error',
    change: 'change',
    input: 'input',
    focus: 'focus',
    blur: 'blur',
    submit: 'submit',
    scroll: 'scroll',
    scrollstop: 'scrollStop'
};

var RE_GLOBAL_METHOD = /^((Math|JSON|Date|util|\$)\.|(encodeURIComponent|decodeURIComponent|parseInt|parseFloat)$)/;
var RE_METHOD = codeRegExp("\\b((?:this\\.){0,1}[\\.\\w$]+)((...))", 'g', 4);
var RE_SET = codeRegExp("([\\w$]+(?:\\.[\\w$]+)*)\\s*=\\s*((?:(...)|" + RE_STRING + "|[\\w$][!=]==?|[^;=])+?)(?=;|,|\\)|$)", 'g', 4);

var events = {};

function getEventProxy(viewModel) {
    return events[viewModel.eventId] || (events[viewModel.eventId] = (e) => {
        if (e.type == TRANSITION_END && e.target != e.currentTarget) {
            return;
        }
        var target = e.currentTarget;
        var eventCode = target.getAttribute('sn-' + viewModel.cid + e.type);

        if (eventCode == 'false') {
            return false;
        } else if (+eventCode) {
            var args = viewModel.compiler.getFunctionArg(viewModel, target, target.snData);
            args.e = e;
            return viewModel.compiler.executeFunction(viewModel, eventCode, args);
        }
    });
}

function isBubbleEvent(eventName) {
    switch (eventName) {
        case 'scroll':
        case 'scrollStop':
            return false;
        default:
            return true;
    }
}

export function compileEvent(viewModel, el, attr, val) {
    //处理事件绑定
    var evt = EVENTS[attr.slice(3)];
    if (evt) {
        el.removeAttribute(attr);
        compileElementEvent(viewModel, el, evt, val);
    }
}

function compileElementEvent(viewModel, el, evt, val) {
    var attr = "sn-" + viewModel.cid + evt;
    if (val == 'false') {
        el.setAttribute(attr, val);
    } else {
        var content = val.replace(RE_METHOD, function (match, $1, $2) {
            return RE_GLOBAL_METHOD.test($1)
                ? match
                : ($1 + $2.slice(0, -1) + ($2.length == 2 ? '' : ',') + 'e)');
        }).replace(RE_SET, 'this.dataOfElement(e.currentTarget,\'$1\',$2)');

        var fid = compileToFunction(viewModel, content, false);
        fid && el.setAttribute(attr, fid);
    }

    switch (evt) {
        case 'scroll':
        case 'scrollStop':
            (el.snEvents || (el.snEvents = [])).push(evt);
            $(el).on(evt, viewModel._handleEvent);
            break;
    }
}

export function bindEvents(viewModel, $element) {
    var eventName;
    var eventAttr;
    var eventFn = getEventProxy(viewModel);
    for (var key in EVENTS) {
        eventName = EVENTS[key];

        if (isBubbleEvent(eventName)) {
            eventAttr = '[sn-' + viewModel.cid + eventName + ']';
            $element.on(eventName, eventAttr, eventFn)
                .filter(eventAttr).on(eventName, eventFn);
        }
    }
}

export function unbindEvents(viewModel, $element) {
    if ($element) {
        $element.off('input change blur', '[' + viewModel.eventId + ']')
            .each(function () {
                delete this.snViewModel;
            });

        var eventName;
        var eventAttr;
        var eventFn = getEventProxy(viewModel);

        for (var key in EVENTS) {
            eventName = EVENTS[key];
            eventAttr = '[sn-' + viewModel.cid + eventName + ']';

            if (isBubbleEvent(eventName)) {
                $element.off(eventName, eventAttr, eventFn);
            } else {
                $element.find(eventAttr)
                    .off(eventName, eventFn);
            }

            $element.filter(eventAttr)
                .off(eventName, eventFn)
        }
    }
}

export function removeEvents(viewModel) {
    unbindEvents(viewModel, viewModel.$el);
    delete events[viewModel.eventId];
}