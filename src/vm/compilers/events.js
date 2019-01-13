import { $, TRANSITION_END } from '../../utils/dom';
import { RE_STRING, codeRegExp } from '../../utils/regex';

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

function getDOMEventSign(viewModel, eventType) {
    return 'sn' + viewModel.state.id + eventType;
}

function getEventProxy(viewModel) {
    return events[viewModel.eventId] || (events[viewModel.eventId] = (e) => {
        if (e.type == TRANSITION_END && e.target != e.currentTarget) {
            return;
        }
        var target = e.currentTarget;
        var eventCode = target.getAttribute(getDOMEventSign(viewModel, e.type));

        if (eventCode == 'false') {
            return false;
        } else if (+eventCode) {
            var args = viewModel.compiler.getFunctionArg(target, target.snData);
            args.e = e;
            return viewModel.compiler.executeFunction(eventCode, args);
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

export function bindEvents(viewModel, $element) {
    $element.on('input change blur', '[' + viewModel.eventId + ']', function (e) {
        var target = e.currentTarget;

        switch (e.type) {
            case 'change':
            case 'blur':
                switch (target.nodeName) {
                    case 'TEXTAREA':
                        return;
                    case 'INPUT':
                        switch (target.type) {
                            case 'hidden':
                            case 'radio':
                            case 'checkbox':
                            case 'file':
                                break;
                            default:
                                return;
                        }
                        break;
                    default:
                }
                break;
            default:
        }

        viewModel.dataOfElement(target, target.getAttribute(viewModel.eventId), target.value);
    });

    var eventName;
    var eventAttr;
    var eventFn = getEventProxy(viewModel);
    for (var key in EVENTS) {
        eventName = EVENTS[key];

        if (isBubbleEvent(eventName)) {
            eventAttr = '[' + getDOMEventSign(viewModel, eventName) + ']';
            $element
                .on(eventName, eventAttr, eventFn)
                .filter(eventAttr)
                .on(eventName, eventFn);
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
            eventAttr = '[' + getDOMEventSign(viewModel, eventName) + ']';

            if (isBubbleEvent(eventName)) {
                $element.off(eventName, eventAttr, eventFn);
            } else {
                $element.find(eventAttr)
                    .off(eventName, eventFn);
            }

            $element.filter(eventAttr)
                .off(eventName, eventFn);
        }
    }
}

function removeEvents(viewModel) {
    unbindEvents(viewModel, viewModel.$el);
    delete events[viewModel.eventId];
}

function compileEvent(eventCompiler, el, evt, val) {
    var template = eventCompiler.template;
    var attr = "sn" + template.viewModel.state.id + evt;
    if (val == 'false') {
        el.setAttribute(attr, val);
    } else {
        var content = val
            .replace(RE_METHOD, function (match, $1, $2) {
                return RE_GLOBAL_METHOD.test($1)
                    ? match
                    : ($1 + $2.slice(0, -1) + ($2.length == 2 ? '' : ',') + 'e)');
            })
            .replace(RE_SET, 'this.dataOfElement(e.currentTarget,\'$1\',$2)');
        var fid = template.compileToFunction(content, false);
        fid && el.setAttribute(attr, fid);
    }

    switch (evt) {
        case 'scroll':
        case 'scrollStop':
            (el.snEvents || (el.snEvents = [])).push(evt);
            $(el).on(evt, getEventProxy(template.viewModel));
            break;
        default:
    }
}

export class EventCompiler {
    constructor(template) {
        this.viewModel = template.viewModel;
    }

    compile($element) {
        bindEvents(this.viewModel, $element);
    }
}

export class EventNodeCompiler {
}

export class EventAttributeCompiler {
    constructor(template) {
        this.template = template;
        this.eventId = template.viewModel.eventId;
        template.viewModel.on("destroy", () => removeEvents(template.viewModel));
    }

    compile(el, attr, val) {
        if (attr == 'sn-model') {
            el.removeAttribute(attr);
            el.setAttribute(this.eventId, val);
            return true;
        }

        var evt = EVENTS[attr.slice(3)];
        if (evt) {
            el.removeAttribute(attr);
            compileEvent(this, el, evt, val);
            return true;
        }
    }

    update(el, attr, val) {
        if (attr == 'sn-src' && val) {
            var viewModel = this.template.viewModel;
            if (el.getAttribute(getDOMEventSign(viewModel, 'load')) || el.getAttribute(getDOMEventSign(viewModel, 'error'))) {
                $(el).one('load error', getEventProxy(viewModel));
            }
        }
    }
}

