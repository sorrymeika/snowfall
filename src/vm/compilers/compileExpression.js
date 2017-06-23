import { testRegExp, codeRegExp } from '../utils/regex'

const KEYWORDS = {
    'new': true,
    'this': true,
    'return': true,
    'instanceof': true,
    'typeof': true,
    '$': true,
    '$data': true,
    'Object': true,
    'Array': true,
    'JSON': true,
    'Math': true,
    'Date': true,
    'parseInt': true,
    'parseFloat': true,
    'encodeURIComponent': true,
    'decodeURIComponent': true,
    'window': true,
    'document': true
};

var RE_MATCH_EXPRESSION = codeRegExp("{...}", 'g');
var RE_EXPRESSION = /'(?:(?:\\{2})+|\\'|[^'])*'|"(?:(?:\\{2})+|\\"|[^"])*\"|\bvar\s+('(?:(?:\\{2})+|\\'|[^'])*'|[^;]+);|(?:\{|,)\s*[\w$]+\s*:\s*|([\w$]+)\(|function\s*\(.*?\)|([\w$]+(?:\.[\w$]+|\[[\w$\']+\])*)(\()?/g;
var RE_VARS = /([\w$]+)\s*(?:=(?:'(?:\\'|[^'])*'|[^;,]+))?/g;
var RE_VALUE = /^(-?\d+(\.\d+)?|true|false|undefined|null|'(?:\\'|[^'])*')$/;

/**
 * 将字符串表达式转为function code
 * 
 * @example
 * compileExpression('name and age: {user.name+user.age}')
 * compileExpression('user.name+user.age', false)
 * compileExpression('{var a=2,c=2,b;b=name+tt,t$y_p0e=type_$==1?2:1}')
 * 
 * @param {string} expression 转化为function的表达式，如：
 * @param {boolean} withBraces 语句中是否包含大括号
 */
export default function compileExpression(expression, withBraces) {
    if (withBraces === undefined) withBraces = true;
    if (withBraces && !testRegExp(RE_MATCH_EXPRESSION, expression)) return;

    var variables = [];
    var content = 'try{return ';

    if (withBraces) {
        var exp;
        var start = 0;
        var m;
        var str;
        var firstLoop = true;

        RE_MATCH_EXPRESSION.lastIndex = 0;

        while ((m = RE_MATCH_EXPRESSION.exec(expression))) {
            if (!firstLoop) content += '+';
            else firstLoop = false;

            exp = m[0].slice(1, -1);
            str = compileToString(expression.substr(start, m.index - start));
            str && (content += str + '+');
            content += '('
                + parseExpression(exp, variables)
                + ')';
            start = m.index + m[0].length;
        }
        str = compileToString(expression.substr(start));
        str && (content += '+' + str);
    } else {
        content += parseExpression(expression, variables);
    }

    content += ';}catch(e){console.error(e);return \'\';}';

    if (variables.length) {
        content = 'var ' + variables.join(',') + ';' + content
    }

    return {
        code: content,
        variables: variables
    };
}

function parseExpression(expression, variables) {
    return expression.replace(RE_EXPRESSION, function (match, vars, fn, name, lastIsFn) {
        if (vars) {
            var mVar;
            while ((mVar = RE_VARS.exec(vars))) {
                variables.push(mVar[1]);
            }
            return vars + ',';
        } else if (fn) {
            return (KEYWORDS[fn] ? fn : '$data.' + fn) + '(';
        } else if (name) {
            return lastIsFn
                ? valueExpression(name.substr(0, lastIsFn = name.lastIndexOf('.')), variables) + name.substr(lastIsFn) + "("
                : valueExpression(name, variables);
        }
        return match;
    })
}

function compileToString(str) {
    return str ? '\'' + str.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'' : str;
}

function valueExpression(str, variables) {
    if (RE_VALUE.test(str)) return str;

    var arr = str.split('.');
    var alias = arr[0];
    var code = '';
    var gb = '$data';

    if (!alias || KEYWORDS[alias] || (variables.length && variables.indexOf(alias) !== -1)) {
        return str;
    } else {
        switch (alias) {
            case 'delegate':
                return 'this.' + str;
            case 'srcElement':
            case 'util':
            case '$filter':
                return gb + '.' + str;
        }
    }

    str = gb + '.' + str;

    var result = [];
    var i;
    for (i = 0; i < arr.length; i++) {
        result[i] = (i == 0 ? gb : result[i - 1]) + '.' + arr[i];
    }
    for (i = 0; i < result.length; i++) {
        code += (i ? '&&' : '') + result[i] + '!==null&&' + result[i] + '!==undefined';
    }
    return '((' + code + ')?' + str + ':"")';
}
