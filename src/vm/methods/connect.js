export function connect(parent, child, name) {
    if (!child.mapper[parent.cid]) {
        !child.parents && (child.parents = []);
        child.parents.push(parent);
        setMapper(parent, child, name);
    }
}

export function disconnect(parent, child) {
    const parents = child.parents;
    if (parents) {
        let i = parents.length;
        while (--i >= 0) {
            if (parents[i] === parent) {
                let length = parents.length;
                while (++i < length) {
                    parents[i - 1] = parents[i];
                }
                parents.pop();
                break;
            }
        }
    }
    delete child.mapper[parent.cid];
}

export function setMapper(parent, child, name) {
    child.mapper[parent.cid] = name;
}

export function getMemberName(parent, child) {
    return child.mapper[parent.cid];
}
