export function connect(parent, child, name) {
    if (!child.$mapper[parent.$id]) {
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
    delete child.$mapper[parent.$id];
}

export function setMapper(parent, child, name) {
    child.$mapper[parent.$id] = name;
}

export function getMemberName(parent, child) {
    return child.$mapper[parent.$id];
}
