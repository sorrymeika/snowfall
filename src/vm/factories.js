
export const nameOfModel = Symbol('Model');
export const nameOfCollection = Symbol('Collection');

const factories = {};

export function initFactories(_factories) {
    Object.assign(factories, _factories)
}

export function createModelFactory() {
    return factories[nameOfModel];
}

export function createCollectionFactory() {
    return factories[nameOfCollection];
}
