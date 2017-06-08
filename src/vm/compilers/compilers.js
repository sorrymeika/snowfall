import createAttributeCompilerFactory from './createAttributeCompilerFactory';
import createNodeCompilerFactory from './createNodeCompilerFactory';
import createCompilerFactory from './createCompilerFactory';
import { EventCompiler, EventAttributeCompiler } from './events'
import { RepeatNodeCompiler } from './repeat'
import { RefAttributeCompiler } from './ref'
import { ComponentAttributeCompiler } from './component'

const compilers = {
    createCompiler: createCompilerFactory([EventCompiler]),
    createNodeCompiler: createNodeCompilerFactory([RepeatNodeCompiler]),
    createAttributeCompiler: createAttributeCompilerFactory([ComponentAttributeCompiler, EventAttributeCompiler, RefAttributeCompiler]),
};

export default compilers;
