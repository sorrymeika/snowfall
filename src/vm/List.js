import { Collection } from "./Collection";
import { Observer } from "./Observer";

export default class List extends Collection {
    static createItem(data, index, parent) {
        return new Observer(data, index, parent);
    }
}