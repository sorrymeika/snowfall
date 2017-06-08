
export class RefAttributeCompiler {
    beforeUpdate(nodeData, attrName, val) {
        if (attrName == 'ref' && typeof val === 'function') {
            val(nodeData.ref);
            return false
        }
    }
}