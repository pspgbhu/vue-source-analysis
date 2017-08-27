# Vue-Source-Code-Analysis


Vue 源码分析是一项庞大的工程，尤其是你想将它写下来时。正因为如此，一个正确的切入点总显得的那么重要，很明显，在 Vue 中 数据响应化起到了挈领提纲的作用，因此我们也将从 Vue 中 数据响应化开始，抽丝剥茧，一层层的掀开 Vue 的神秘面纱。

> 下文中的代码部分均截取自 Vue 1.0 分支 version 1.0.28 源码，其中英文注释为尤大所注，中文为笔者所注。 

## data 的诞生及代理

```js
// ...
// ...
data() {
  return {
    string: 'Vue',
    number: 2,
    arr: [1, 2, 3],
    obj: {a: 1, b: 2},
  };
}
// ...
// ...
```
上面是我们在 Vue 实例中定义的一组 data，data 的属性值大致可以分为三类，分别是基本类型值，对象和数组。先预告一下， vue 对于数组的处理与基本类型值是不一样的。

Vue 构造函数内部只有一行 `this._init(options)` ，其中，初始化了各种属性，调用了各种 init 函数。 而其中的 `this._initState` 又是调用了一堆 init ，
```js
Vue.prototype._init = function(options) {
  // ...
  // ...

  // initialize data observation and scope inheritance.
  this._initState()

  // ...
  // ...zheli
}

Vue.prototype._initState = function () {
  this._initProps()
  this._initMeta()
  this._initMethods()
  this._initData()  // 今天让我们主要看看这个
  this._initComputed()
}

```

`_initData()` 里面做的事情很简单，执行 vue 实例中的 data 函数，并返回一个 data 对象，同时将 data 中每一项代理到 this 上，这也是为什么我们可以直接通过 this[property] 拿到 data 中的值。

```js
Vue.prototype._initData = function () {
  // option 里的 data 函数，data 函数会 return data 对象
  var dataFn = this.$options.data
  // 调用 dataFn 返回 data 对象
  var data = this._data = dataFn ? dataFn() : {}
  // 判断 data 是不是 对象
  // 如果不是，则初始化 data，并且发出警告，并创建一个空对象作为 data
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object.',
      this
    )
  }

  var props = this._props

  // proxy data on instance
  // 对 data 里的 key 进行遍历，代理每一属性到 this 上。
  var keys = Object.keys(data)
  var i, key
  i = keys.length
  while (i--) {
    key = keys[i]
    // there are two scenarios where we can proxy a data key:
    // 1. it's not already defined as a prop
    // 2. it's provided via a instantiation option AND there are no
    //    template prop present
    // 基本上意思是 data 中的 key 若沒有和 props 冲突，则对该属性进行代理
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

  // observe 函数是实现响应化改造的关键
  // observe 函数是实现响应化改造的关键
  // observe 函数是实现响应化改造的关键
  // 重要的事情说三遍！！！
  observe(data, this)
}


/**
  * Proxy a property, so that
  * vm.prop === vm._data.prop
  *
  *
  * 将 _data 下的属性代理到 vue 根一级下
  * 因此我们才能直接通过 this.property 拿到 this._data.property 的值。
  * 要注意的是，这里拒绝了对 $ 和 _ 开头属性的代理，
  */
Vue.prototype._proxy = function (key) {
  // 检查是否是 $ 或 _ 开头
  if (!isReserved(key)) {
    // need to store ref to self here
    // because these getter/setters might
    // be called by child scopes via
    // prototype inheritance.

    // 这里储存了 this 上下文环境，
    // 因为这里的 getter 和 setter 可能会在子组件的作用域中被调用。
    var self = this
    // 将 this._data 对应的属性代理到 this 下，可以直接通过 this.property 拿到 this._data.property
    Object.defineProperty(self, key, {
      configurable: true,
      enumerable: true,
      get: function proxyGetter () {
        return self._data[key]
      },
      set: function proxySetter (val) {
        self._data[key] = val
      }
    })
  }
}
``` 

## data 的响应化

不要说你们没有留意到上段代码中的 `observe(data, this)` 函数（没看到的可以去检查视力了），以下内容均为响应式的关键。

observe 函数会对调用 Observer 构造函数对 data 及 data 下的对象和数组属性进行加工，使其成为响应式数据。

```js
export function observe (value, vm) {
  // 若是基本类型值，则不需要对其进行改造。
  if (!value || typeof value !== 'object') {
    return
  }
  var ob

  // 此时我们的 data 还是处于未经 Observer 构造函数加工的状态，
  // 因此会走下面的 else if 线。
  if (
    hasOwn(value, '__ob__') &&  // Observer 构造函数将会为 value 添加 __ob__ 属性 
    value.__ob__ instanceof Observer  // 并且 value 是 Observer 的实例
  ) {
    ob = value.__ob__
  } else if (
    shouldConvert &&   // 具体含义先不用管，此处为 true
    (isArray(value) || isPlainObject(value)) &&  // 是数组或者对象。
    Object.isExtensible(value) &&  // 如果对象没有被冻结
    !value._isVue // 自身不是 vue 实例
  ) {
    // Observer 将会对 data 进行响应式改造！
    ob = new Observer(value)
  }
  if (ob && vm) {
    // 将 vm 推入 this.vms 数组
    ob.addVm(vm)
  }
  return ob
}

```
observe 函数先对数据进行了检查，如果是基本类型值的话直接返回（若 value 是基本类型值的话，其所属对象一定已经被 Observer 改造过了），此时我们进来的 value 是 vue 实例的 data，因此会通过第一个检查。而后的 if 是判断 value 是否已经被 Observer 改造过？当然此时我们的 data 还没有，因此会进入 else if 中，调用 Observer 构造函数。

## Observer 构造函数

```js
/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 */

 /**
  * Observer 类，作用到每一个被观察到对象。
  * 一旦作用，观察者就会将目标对象的属性转换到 getter/setter 上
  * 以便于收集依赖和触发变更。
  */

export function Observer (value) {
  this.value = value
  this.dep = new Dep()
  // 将 __ob__ 属性定义到 value 上，并且 __ob__ 属性值为 this
  // writable: true,
  // configurable: true
  def(value, '__ob__', this)
  if (isArray(value)) {

    // 对于数组内部的改变 setter 是无法检测到的。所以这里讲改造了 data 内的数组
    // 将数组的七种变异方法全部改写，使其可以调用时可以向上发出通知。
    var augment = hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)

    // 遍历 array，并为 array 的每一项调用 observer，如果子项是对象或者是数组，则继续新建 Observer 实例进行递归处理。
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}
```
上面用一个 if 条件判断将对象和数组进行了分别处理，先来看一下是如果处理对象的。

### 对象

`this.walk(value)` 函数的非常简单，就是遍历 value 中的每一项，并对其调用 `defineReactive(this.value, key, val)`。defineReactive 函数第一个参数就是 Observer 构造函数接受的 value 参数，而后 key 和 val 参数分别为 `this.walk(value)` 遍历的 value 对象的键和值。


```js
export function defineReactive (obj, key, val) {
  // Dep 是一套发布订阅系统
  var dep = new Dep()

  // 获取一个对象属性的描述符
  var property = Object.getOwnPropertyDescriptor(obj, key)
  // 当且仅当该属性的 configurable 为 true 时，
  // 该属性描述符为 true 时，该属diaoyuong性才能够被改变，同时该属性也能从对应的对象上被删除。默认为 false。
  // 通过 def 函数定义属性的 configurable 值均为 true
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 短路计算，直接取了 property.get/set ，当然 property.get/set 有可能是 undefined
  var getter = property && property.get
  var setter = property && property.set

  // 到这里就可以发现其实是在递归的拆解 data 中的对象属性，直到该属性值类型不为对象时。
  var childOb = observe(val)

  Object.defineProperty(obj, key, {
    enumerable: true,   // 当且仅当该属性的 enumerable 为 true 时，该属性才能够出现在对象的枚举属性中。
    configurable: true,   // 当且仅当该属性的 configurable 为 true 时，该属性描述符才能够被改变，也能够被删除。
    get: function reactiveGetter () {

      // 如果上面的 getter 存在的话，直接读取 getter 的返回值。否则直接取 val
      // 也就是直接拿的属性值的 value ^_^
      var value = getter ? getter.call(obj) : val

      // 目前还不知道哪里为 Dep.target 赋值
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
        }
        if (isArray(value)) {
          for (var e, i = 0, l = value.length; i < l; i++) {
            e = value[i]
            e && e.__ob__ && e.__ob__.dep.depend()
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      var value = getter ? getter.call(obj) : val
      if (newVal === value) {
        return
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 这一步是为了防止 newVal 是一个对象，
      // 若是对象的话，需要对这个对象下建立新的 Observe 实例。
      childOb = observe(newVal)
      // 注意啦，这里通知了所有的订阅者
      dep.notify();
    }
  })
}
```
到这里就很清楚了，vue 实例下 this._data 对象的基本类型属性值会在这里添加存取描述符 get & set， this._data 下的对象值会一级级的递归拆解直到为基本类型值为止，然后再为每一个值定义 getter & setter，以检测变化


### 数组

OK，现在开始看一下是如何**检测数组变动**：

以下为 Observer 构造函数判断参数为数组时的执行逻辑
```js
    var augment = hasProto  // '__proto__' in {}
      ? protoAugment        // value.__proto = arrayMethods 
      : copyAugment         // 遍历 arrayKeys，def(value, key, arrayMethods[key])
    augment(value, arrayMethods, arrayKeys);

    // 遍历数组，并 observe 每一项。
    this.observeArray(value)
```

正常情况下，执行数组的七种变异方法（push, pop, splice, sort, reverse, shift, unshift）是无法触发为数组定义的 setter 函数的，因此使用之前的方法是不能够检测的对数组进行的改变的。这里尤大想了一个办法，重新改造了数组的七种变异方法，使数组执行这七种方法的后向上发出通知。这样子的话就不需要 getter 和 setter 去检测数组的每一项的变化了，只要数组调用了以上的七种方法，vue 就会收到通知。但是很明显的是，你只能用这七种方法来操作数组，vue 才能检测到数组的变化。

同时为了避免污染 Array 原生的方法，创建了一个新的对象，保存了改造后的数组原型，让 data 中的数组去继承改造后的数组原型。

```js
/**
## Thinking 
1. 为什么要用　__proto__ 属性，而不直接用 prototype 属性。
 * Intercept mutating methods and emit events
 */
/**
 * 重写了数组以下的几种方法，使调用下列方法时可以检测到数组的变化。
 */
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  var original = arrayProto[method]
  def(arrayMethods, method, function mutator () {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i]
    }
    var result = original.apply(this, args)
    var ob = this.__ob__
    var inserted
    // 下面这三种方法都会添加值进数组
    switch (method) {
      case 'push':
        inserted = args
        break
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 要对添加进的值进行新一轮的　observe
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
```
但是在 ES5 更早版本的 ES 中没有可靠的继承数组的方法，所以这里就尽可能的利用了 __proto__ 属性。

> 在ES5之前没有标准的方法访问 `[[prototype]]` 这个内置属性，但是大多数浏览器都支持通过__proto__来访问。

对于支持 __proto__ 属性的浏览器，直接修改其 __proto__ 属性来使其继承改造后的 Array 原型。而有些浏览器不支持　__proto__ 属性，则去一一的重写 Array 的方法。

以上就是为什么我们只能用 push, pop, splice, sort, reverse, shift, unshift 这七种方法来改变数组。


## Thinking

1. getter 和 setter 用来检测数据的改变非常合适，但是若是直接删除了这个数据呢？这样是不会触发 setter 的，那 Vue 中是如何处理的呢？

2. Observer 在原型上添加了 dep，definedReactive 在闭包中保存了 dep， 发布者已经找到呢，那订阅者是在哪里订阅的呢？

3. 根据 defineReactive 函数来看，层级较深的对象也是能够检测到其值的变化的，但是为什么在实际使用中却不能直接使用 this.a.b.c = 1 这样的赋值方式呢？

以上的问题留到后面继续解答吧，哈哈！

## Reference:
1. [Vue源码详细解析(一)--数据的响应化](https://github.com/Ma63d/vue-analysis/issues/1)
2. [深入响应式原理](https://v1.vuejs.org/guide/reactivity.html)
3. [How ECMAScript 5 still does not allow to subclass array](http://perfectionkills.com/how-ecmascript-5-still-does-not-allow-to-subclass-an-array/)