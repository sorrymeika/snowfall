import * as util from '../../utils';
import { isModel, isCollection } from '../mediator';
import * as $filter from '../filter';
import compileExpression from './compileExpression';

var vmExpressionsId = 1;
var vmExpressionsMap = {};
var vmFunctions = {};

export default class FunctionCompiler {

    constructor(viewModel) {
        this.vmCodes = "";
        this.viewModel = viewModel;
        this.fns = {};
    }

    compile() {
        if (this.vmCodes) {
            var fns = new Function('return {' + this.vmCodes.slice(0, -1) + '}')();
            for (var expId in fns) {
                vmFunctions[expId] = this.fns[expId] = fns[expId];
            }
            this.vmCodes = "";
        }
    }

    push(expression, withBraces) {
        if (!expression) return null;
        expression = expression.replace(/^\s+|\s+$/g, '');
        if (!expression) return null;

        var expId = vmExpressionsMap[expression];
        if (expId !== undefined) {
            this.fns[expId] = vmFunctions[expId];
            return expId;
        }

        var res = compileExpression(expression, withBraces);
        if (!res) return null;

        expId = vmExpressionsId++;
        vmExpressionsMap[expression] = expId;
        this.vmCodes += expId + ':function($data){' + res.code + '},';

        return expId;
    }

    getFunctionArg(element, snData) {
        var data = Object.assign({
            srcElement: element,
            util: util,
            $filter: $filter
        }, this.viewModel.$attributes);

        if (snData) {
            for (var key in snData) {
                var val = snData[key];
                data[key] = isModel(val)
                    ? val.$attributes
                    : isCollection(val)
                        ? val.$array
                        : val;
            }
        }

        return data;
    }

    executeFunction(fid, data) {
        return this.fns[fid].call(this.viewModel, data);
    }
}

