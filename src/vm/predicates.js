import { Model } from "./Model";
import { Collection } from "./Collection";
import { Observer } from "./Observer";

export function isObserver(observer) {
    return observer && observer.constructor === Observer;
}

export function isObservable(observer) {
    return observer instanceof Observer;
}

export function isModel(model) {
    return model instanceof Model;
}

export function isCollection(collection) {
    return collection instanceof Collection;
}

export function isModelOrCollection(model) {
    return isModel(model) || isCollection(model);
}