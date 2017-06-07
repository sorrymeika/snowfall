import Model from './model';
import Collection from './collection';
import ViewModel from './viewModel';
import { __init__ } from './adapter';

__init__(Model, Collection);

export { ViewModel, ViewModel as Model, Collection }