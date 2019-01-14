
export default function NodeUpdateResult(result) {
    result && Object.assign(this, result);
}

NodeUpdateResult.prototype = {
    canUpdateAttributes: true,
    isBreak: false,
    isSkipChildNodes: false,
    nextSibling: undefined
};