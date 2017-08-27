# Vue Source Code Analyses Of The Reactive Data

## 数据响应化

### Initialize the data

`this._init() --> this._initState() --> this._initData()`

在 this._initData() 中
```js
var dataFn = this.$options.data
// 调用 dataFn 返回 data 对象
var data = this._data = dataFn ? dataFn() : {}
// 判断 data 是不是 对象
// 如果不是，则初始化 data，并且发出警告
if (!isPlainObject(data)) {
  data = {}
  process.env.NODE_ENV !== 'production' && warn(
    'data functions should return an object.',
    this
  )
}
```
从 vue 实例中调用 data 函数并返回 data 对象，如果返回的 data 不是对象，则发出警告，并创建一个空对象作为 data。

```js
// 保存 this._props 到 props 变量
var props = this._props

// 代理 data 到实例上
var keys = Object.keys(data)
var i, key
i = keys.length
while (i--) {
  key = keys[i]
  // there are two scenarios where we can proxy a data key:
  // 1. it's not already defined as a prop
  // 2. it's provided via a instantiation option AND there are no
  //    template prop present
  // 在以下两种情境下，我们能够去代理一个 data key：
  // 1. 对应的 key 没有已经被定义在 props 上
  // 2. 提供了实例化选项，并且没有现有的模版 prop 存在（没翻译好，没太懂啥意思）
  if (!props || !hasOwn(props, key)) {
    // this._proxy(key) 是将 this._data.property 属性代理到 this.property 下
    // 这样，我们就可以直接通过 this.property 拿到 this._data.property 的值了。
    this._proxy(key)
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      'Data field "' + key + '" is already defined ' +
      'as a prop. To provide default value for a prop, use the "default" ' +
      'prop option; if you want to pass prop values to an instantiation ' +
      'call, use the "propsData" option.',
      this
    )
  }
}
```
对 data 里的 key 进行迭代，检查是否已经有相同的 key 被定义在了 prop 上，如果没有，则将 this._data[key] 代理到 this[key] 上。这也是为什么在 vue 中可以直接通过 this[key] 拿到 data[key] 中的变量的原因。

this._initData 函数中最后一句
```js
// observe data
observe(data, this)
```

在 observe(data, vm) 中主要处理了以下逻辑
```js
var ob;

//...
//...

ob = new Observer(data);

//...
//...

ob.addVm(vm);

/** 
 * Observer.prototype.addVm = function (vm) {
 *  (this.vms || (this.vms = [])).push(vm)
 * }
 */
```
> Object.isExtensible(obj)，默认情况下，对象是可扩展的：即可以为他们添加新的属性。以及它们的 __proto__  属性可以被更改。Object.preventExtensions，Object.seal 或 Object.freeze 方法都可以标记一个对象为不可扩展（non-extensible）。

Observer Class
```js
function Observer (value) {
  this.value = value
  this.dep = new Dep()
  def(value, '__ob__', this)
  if (isArray(value)) {
    var augment = hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}
```

---

Vue 用 Object.defineProperty 方法建立了一个 $data 属性

> [MDN Reference: Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty) 
> 用该方法创建属性，可以精确的添加或修改对象的属性。这里用 Object.defineProperty 主要是为了定义对象的数据描述符: get、set 等

$data 属性作为中间代理，get 时返回 this._data，set 时接受一个 newDate 的参数，通过对比 newData === this._data，若不相等，则会调用 this._setData(newDate)




