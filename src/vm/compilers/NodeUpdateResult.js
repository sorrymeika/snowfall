
export default function NodeUpdateResult(result) {
    Object.assign(this, result);
}

NodeUpdateResult.prototype = {
    shouldUpdateAttributes: true,
    isBreak: false
}