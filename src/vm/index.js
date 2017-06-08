import Model from './model';
import Collection from './collection';
import ViewModel from './viewModel';
import { __init__ } from './adapter';

__init__(Model, Collection, ViewModel);

export { ViewModel, Model, Collection }