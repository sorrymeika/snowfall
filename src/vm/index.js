import Model from './Model';
import Collection from './Collection';
import ViewModel from './ViewModel';
import { initFactories, removeAttribute, findViewModel } from './adapter';

initFactories(Model, Collection);

export { ViewModel, Model, Collection, removeAttribute, findViewModel };
export { registerComponent as component } from './compilers/component';