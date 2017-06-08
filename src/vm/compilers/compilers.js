import createAttributeCompilerFactory from './createAttributeCompilerFactory';
import createNodeCompilerFactory from './createNodeCompilerFactory';
import createCompilerFactory from './createCompilerFactory';
import { EventCompiler, EventAttributeCompiler } from './events'
import { RepeatNodeCompiler } from './repeat'
import { ComponentAttributeCompiler } from './component'

const compilers = {
    createCompiler: createCompilerFactory([EventCompiler]),
    createNodeCompiler: createNodeCompilerFactory([RepeatNodeCompiler]),
    createAttributeCompiler: createAttributeCompilerFactory([ComponentAttributeCompiler, EventAttributeCompiler]),
};

export default compilers;
