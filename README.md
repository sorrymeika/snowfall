

## api文档

### vm

* snowfall是一个前端MVVM框架，主要由 `Observer`、`ViewModel`、`Model`、`Collection`组成
* snowfall有自己的view层，但在React项目中，我们也可以用`model`层来替换`redux`


### 模版引擎

* 这是一个简单的 `template` 
* 使用 `{expression}` 和 `sn-属性` 来绑定数据

```html
<header class="header {titleClass}">这是标题{title}{title?'aaa':encodeURIComponent(title)}</header>
<div class="main">
    <h1>{title}</h1>
    <ul>
        <li>时间:{util.formateDate(date,'yyyy-MM-dd')}</li>
        <li>user:{user.userName}</li>
        <li>friend:{friend.friendName}</li>
        <li sn-repeat="msg in messages">msg:{msg.content}</li>
        <li sn-repeat="item in collection">item:{item.name}</li>
    </ul>
    <sn-template id="item"><li>{name}</li></sn-template>
    <ul>
        <li sn-repeat="item in list">{item.name}</li>
        <sn-item props="{{ name: item.name }}" sn-repeat="item in list"></sn-item>
    </ul>
</div>
```

# sn-属性

* `sn-[events]` dom事件

```js

model.onButtonClick = function(userName) {
    alert(userName);
}

// 设置 `model` 的事件代理
model.delegate = {
    onButtonClick: function(user) {
        alert(user.userName);
    }
}
```

```html
<div>
    <button sn-tap="this.onButtonClick(user.userName)">Click 0</button>
    <button sn-tap="delegate.onButtonClick(user)">Click 1</button>
</div>
```


* `sn-repeat` 循环

```js
var model = new ViewModel(this.$el, {
    title: '标题',
    list: [{
        name: 1,
        children: [{
            name: '子'
        }]
    }, {
        name: 2
    }]
});
```

```html
<div class="item" sn-repeat="item,i in list|filter:like(item.name,'2')|orderBy:name asc,id desc,{orderByWhat} {ascOrDesc}">
    <p>这是标题{title}，加上{item.name}</p>
    <ul>
        <li sn-repeat="child in item.children|orderBy:this.orderByFunction">{i}/{child.name+child.age}</li>
    </ul>
</div>
```

* `[sn-if]` `[sn-else-if]` `[sn-else]` 条件控制

```html
<div class="item" sn-if="{!title}">当title不为空时插入该element</div>
<div class="item" sn-else-if="{title==3}">当title不为空时插入该element</div>
<div class="item" sn-else>当title不为空时插入该element</div>
```

* `sn-display` 控件是否显示（有淡入淡出效果，若不需要动画效果可使用`sn-visible`或`sn-if`）

```html
<div class="item" sn-display="{title}">当title不为空时显示</div>
```

* `sn-html` 设置innerHTML

```html
<div class="item" sn-html="{title}"></div>
```


* `sn-component` 引入其他组建

```js

var model = new ViewModel({

    components: {
        tab: require('widget/tab')
    },

    el: template,
    
    delegate: this,

    attributes:  {
        title: '标题',
        list: [{
            name: 1,
            children: [{
                name: '子'
            }]
        }, {
            name: 2
        }]
    }
});

```

```html

<div class="tab" sn-component="tab" sn-props="{{items:['生活服务','通信服务']}}"></div>
或
<sn-tab class="tab" props="{{items:['生活服务','通信服务']}}"></sn-tab>
```

#### `vm.Observer` 类

* 可观察对象，类的数据变化可被监听
* `ViewModel`, `Model`, `Collection`, `List`, `Dictionary`, `DictionaryList`, `Emitter`, `State` 都是 `Observer` 的子类，分别有不同的作用

```js
import { vm } from 'mall-core';
const { Observer, ViewModel, Model, Collection, List, Emitter, State } = vm;

var viewModel = new ViewModel({
    el: `<div>
        <sn-template id="item"><li>{name}</li></sn-template>
        <h1>{title}</h1>
        <ul>
            <li sn-repeat="item in list">{item.name}</li>
            <sn-item props="{{ name: item.name }}" sn-repeat="item in list"></sn-item>
        </ul>
    </div>`,
    attributes: {
        title: '标题',
        list: [{
            name: '列表'
        }]
    }
});

var model = new Model({
    id: 1,
    name: '名称'
});

var collection = new Collection([{
    id: 2,
    name: '名称2'
}]);

collection.add(model);
collection.add([{ id: 3, name: '名称3' }]);

viewModel.set({
    data: model,
    list: collection
})
```
#### `vm.Model|vm.Dictionary` 类

* `Observer` 的属性变化不能被监听，`Model|Dictionary` 的属性变化可被监听
* `Model` 是深拷贝，且是 `immutable` 的，`Dictionary` 浅拷贝对象，`Observer` 不拷贝对象可接收值类型

#### `vm.List|vm.Collection|vm.DictionaryList` 类

* `List` 的子项是 `Observer`，`Collection` 的子项是 `Model`，`DictionaryList` 的子项是 `Dictionary`
* `List` 性能优于 `Dictionary` 优于 `Collection`

```js
var collection = new Collection([{
    id: 2,
    name: '名称2'
}]);

collection.add(model);
collection.add([{ id: 3, name: '名称3' }]);

// 原数据中ID存在相同的则更新，否则添加
collection.update([{ id: 2, name: '新名称2' },{ id: 3, name: '新名称3' }], 'id');

// 根据ID更新
collection.updateBy('id', { id: 3, name: '新名称' });

// 更换数组
collection.updateTo([{ id: 3, name: '新名称' }], 'id');

```

#### `(Observer|...).prototype.get` 方法
#### `Model.prototype.attributes|Collection.prototype.array` 属性(只读)

```js
var data = new Model({
    id: 1,
    name: 'immutable data'
})
// 同等于 data.get()
var oldAttributes = data.attributes;

// 数据无变化
data.set({
    id: 1
});
console.log(oldAttributes == data.attributes);
// true

data.set({
    name: '数据变化了'
});
console.log(oldAttributes == data.attributes);
// false

console.log(data.get('id'))
// 1
```

#### `(Observer|...).prototype.set` 方法

* 设置 `Model`、`Collection`

```js
// 通过 `set` 方法来改变数据
// 此时关联了 `user` 的 `home` 的数据也会改变 
// 若原先的 `userName` 已是'asdf'，则不会触发view更新
user.set({
    userName: 'asdf'
});

home.set({
    title: 1,
    user: {
        age: 10
    }
});

// 通过 `collection.set` 方法覆盖数据
// 更新数据使用 `collection.update|updateBy` 等方法性能会更好
collection.set([{
    id: 1,
    name: 'A'
}]);

```

#### `(Observer|...).prototype.observe` 方法

* 监听 Model变化

```js
// 监听所有数据变动
model.observe(function(e) {

});

// Model|Dictionary 可监听 `user` 属性的数据变动
model.observe('user', function(e) {

});

// Model 监听 `user.userName` 属性变动
model.observe('user.userName', function(e) {
});
```

#### `(Observer|...).prototype.unobserve` 方法

* 移除监听

#### `(Observer|...).prototype.compute` 方法

* 计算

```js
// 计算
var computed = model.compute(({ user, id, homePageId }) => {
    return user + id + homePageId;
});
computed.observe((value) => {
});
computed.get();
```

#### `Model.prototype.collection(key)` 方法

* 获取属性名为key的collection，不存在即创建

```js
model.collection('productList').add([{ id: 1 }]);
```

#### `Model.prototype.model(key)` 方法

* 获取属性名为key的model，不存在即创建

```js
home.model('settings').attributes;
```

#### `(Collection|Model).prototype._` 方法

* Model/Collection 查询

```js

/**
  * 搜索子Model/Collection，
  * 支持多种搜索条件
  * 
  * 搜索子Model:
  * model._('user') 或 model._('user.address')
  * 
  * 根据查询条件查找子Collection下的Model:
  * model._('collection[id=222][0].options[text~="aa"&value="1"][0]')
  * model._('collection[id=222][0].options[text~="aa"&value="1",attr^='somevalue'|attr=1][0]')
  * 
  * 且条件:
  * model._("collection[attr='somevalue'&att2=2][1].aaa[333]")
  * 
  * 或条件:
  * model._("collection[attr^='somevalue'|attr=1]")
  * 
  * 不存在时添加，不可用模糊搜索:
  * model._("collection[attr='somevalue',attr2=1][+]")
  * 
  * @param {string} search 搜索条件
  * @param {any} [def] collection[attr='val'][+]时的默认值
  */
home._('collection[name~="aa"|id=1,type!=2]').toJSON();


/**
 * 查询Collection的子Model/Collection
 * 
 * 第n个:
 * collection._(1)
 * 
 * 查询所有符合的:
 * collection._("[attr='val']")
 * 数据类型也相同:[attr=='val']
 * 以val开头:[attr^='val']
 * 以val结尾:[attr$='val']
 * 包含val，区分大小写:[attr*='val']
 * 包含val，不区分大小写:[attr~='val']
 * 或:[attr='val'|attr=1,attr='val'|attr=1]
 * 且:[attr='val'&attr=1,attr='val'|attr=1]
 * 
 * 查询并返回第n个:
 * collection._("[attr='val'][n]")
 * 
 * 一个都不存在则添加:
 * collection._("[attr='val'][+]")
 * 
 * 结果小于n个时则添加:
 * collection._("[attr='val'][+n]")
 * 
 * 删除全部搜索到的，并返回被删除的:
 * collection._("[attr='val'][-]")
 * 
 * 删除搜索结果中第n个，并返回被删除的:
 * collection._("[attr='val'][-n]")
 * 
 * @param {string} search 查询条件
 * @param {object} [def] 数据不存在时默认添加的数据
 * 
 * @return {array|Model|Collection}
 */
collection._('[name="aa"]').toJSON();
```

#### `Collection.prototype.add` 方法

```js
// 通过 `collection.add` 方法添加数据
collection.add({ id: 2, name: 'B' })
collection.add([{ id: 3, name: 'C' }, { id: 4, name: 'D' }])
```

#### `Collection.prototype.update` 方法

```js
// 通过 `collection.update` 方法更新数据
collection.update([{ id: 3, name: 'C1' }, { id: 4, name: 'D1' }], 'id');
collection.update([{ id: 3, name: 'C1' }, { id: 4, name: 'D1' }], function(a, b) {
    return a.id === b.id;
});
```

#### `Collection.prototype.updateTo` 方法

* 更新成传入的数组

```js
var arr = [{ id: 3, name: 'C1' }, { id: 4, name: 'D1' }];

// 通过 `collection.updateTo` 方法更新数据
collection.updateTo(arr, 'id');
```


#### `Collection.prototype.updateBy` 方法

* 根据 comparator 更新 collection

```js
var data = [{ id: 3, name: 'C1' }, { id: 4, name: 'D1' }];

/**
 * 根据 comparator 更新Model
 * collection.updateBy('id', { id: 123 name: '更新掉name' })
 * collection.updateBy('id', [{ id: 123 name: '更新掉name' }])
 *
 * @param {String} comparator 属性名/比较方法
 * @param {Object} data
 * @param {boolean} renewItem 是否覆盖匹配项
 *
 * @return {Collection} self
 */
collection.updateBy(id, data, true|false);
```

#### `Collection.prototype.unshift` 方法

* 首部插入数据

```js
collection.unshift({ id: 1 });
```

#### `Collection.prototype.splice` 方法

* 移除或插入数据

```js
collection.splice(0,1,[{ id: 1 }]);
```

#### `Collection.prototype.size` 方法 | `Collection.prototype.length` 属性

* Collection 长度


#### `Collection.prototype.map` 方法

* 同 `Array.prototype.map`

#### `Collection.prototype.find` 方法

* 查找某条子Model

```js
collection.find('id', 1);
```

#### `Collection.prototype.filter` 方法

* 同 `Array.prototype.filter`


#### `Collection.prototype.remove` 方法

* 从 collection 中移除

```js
collection.remove('id', 1);

collection.remove(model);

collection.remove(function(item) {
    return true|false;
});
```


#### `Collection.prototype.clear` 方法

* 清除 collection


#### `Collection.prototype.each` 方法

* 遍历 collection


#### `Collection.prototype.toArray` | `Collection.prototype.toJSON` 方法

* 将 collection 转为数组

#### `(Observer|Model|Collection).prototype.destroy`

* 销毁 Model | Collection


### `observable`

* 可观察对象

#### `observable()`

```js
// 自动根据数据类型生成 observable object
// plainObject对应Model, array对应Collection, 其他对应Observer
const observer = observable(0|{}|[]|'');

// 设置数据
observer.set(1);

// 数据无变化不会触发事件
observer.observe((val) => {
    console.log(val);
});

// 移除监听
observer.unobserve((val) => {
    console.log(val);
});

// 传入function生成 observable object，它是只读的，不能set
const observer = observable((fn)=>{
  document.body.addEventListener('click', fn);
    return () => {
      document.body.removeEventListener('click', fn);
    }
});
```

### `vm.State` 类

```js
const state = new State();

// 异步设置触发事件，并且会触发3次
state.set(1);
state.set(2);
state.set(3);

console.log(state.get());
// undefined
```

### `vm.Emitter` 类

```js
const emitter = new Emitter();

// 同步触发事件，并且会触发3次
emitter.set(1);
emitter.set(2);
emitter.set(3);

console.log(emitter.get());
// 3
```

### `vm.attributes`

```js
class User {
    @attributes.number
    userId = 0;

    @attributes.string
    userName;

    @attributes.object
    auth;

    constructor(data) {
        User.init(this, data);
    }
}

const user = new User();
user.userId = 1;
user.userName = '张三';

// 监听user
User.observe(user, ()=>{
});
// 监听user.userId
User.observe(user, 'userId', ()=>{
});
// 计算user.userId
User.compute(user, 'userId', (userId)=>{
    return 'userId:' + userId;
});
// user to plainObject
User.get(user);

User.set(user, {
    userId: 1
});

User.set(user, (userModel) => {
    userModel.set({
        userId: 10
    })
});

for (var key in user) {
    console.log(key);
}
// userId
// userName
```


<br>

-------

<br>

###  `util`

* 工具类

```js
import { util } from 'snowfall';
```
#### `util.is(PlainObject|EmptyObject|Boolean|Number|String|Object|Array|Yes|No|Thenable)`

#### `util.clone`

#### `util.deepClone`

#### `util.extend`

#### `util.style`

* 插入样式表

#### `util.encodeHTML` 方法

* html 转码

#### `util.pick` 方法

* 同 _.pick

#### `util.cookie` 方法

* 获取、设置document.cookie

#### `util.store` 方法

* 获取、设置localStorage

#### `util.equals` 方法

* 判断两个 Object、Array 结构和值是否相同（引用不同）

#### `util.groupBy` 方法

* 数组分组

#### `util.sum` 方法

* 数组求和

#### `util.array` 方法

* 数组操作链

```js
// 链式处理，并返回数组中某个item
util.array([{ id: 1 }, { id: 2 }])
    .filter('id', 1)
    .concat([{ id: 3 }])
    .map((item) => item)
    .exclude('id', 2)
    .find('id', 3);

// 链式处理，并返回 Array
util.array([{ id: 1 }, { id: 2 }])
    ._('[id=1,name=2]')
    .filter((item) => item.id == 1)
    .toArray();
```

#### `util.query` 方法

* 数组搜索，类似 `Collection.prototype._`

#### `util.formatDate` 方法

* 日期转字符串

```js

util.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss_ffff');

// 2012-02-03 星期一
util.formatDate(new Date(), 'yyyy-MM-dd W');

// 刚刚、n分钟前、n小时前、昨天 HH:mm、yyyy-MM-dd HH:mm
util.formatDate(Date.now(), 'short');

// HH:mm、昨天 HH:mm、yyyy-MM-dd HH:mm
util.formatDate(Date.now(), 'minutes');

```

#### `util.timeLeft` 方法
```js

// 1天 00:10:00
util.timeLeft(10000000);

// 00:10:00
util.timeLeft(10000);
```
