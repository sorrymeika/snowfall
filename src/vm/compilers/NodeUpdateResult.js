
export default function NodeUpdateResult(result) {
    result && Object.assign(this, result);
}

NodeUpdateResult.prototype = {
    shouldUpdateAttributes: true,
    isBreak: false,
    isSkipChildNodes: false,
    nextSibling: undefined
};