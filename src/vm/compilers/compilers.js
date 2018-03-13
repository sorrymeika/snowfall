import createAttributeCompilerFactory from './createAttributeCompilerFactory';
import createNodeCompilerFactory from './createNodeCompilerFactory';
import createCompilerFactory from './createCompilerFactory';
import { EventCompiler, EventAttributeCompiler } from './events';
import { RepeatNodeCompiler } from './repeat';
import { ComponentCompiler } from './component';
import { IfCompiler } from './IfCompiler';
import { RefAttributeCompiler } from './ref';

var compilers;

export function getCompilers() {
    if (!compilers) {
        compilers = {
            createCompiler: createCompilerFactory([EventCompiler]),
            createNodeCompiler: createNodeCompilerFactory([ComponentCompiler, RepeatNodeCompiler, IfCompiler]),
            createAttributeCompiler: createAttributeCompilerFactory([EventAttributeCompiler, RefAttributeCompiler]),
        };
    }
    return compilers;
};
