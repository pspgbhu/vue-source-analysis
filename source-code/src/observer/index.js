import Dep from './dep'
import { arrayMethods } from './array'
import {
  def,
  isArray,
  isPlainObject,
  hasProto,
  hasOwn
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However in certain cases, e.g.
 * v-for scope alias and props, we don't want to force conversion
 * because the value may be a nested value under a frozen data structure.
 *
 * So whenever we want to set a reactive property without forcing
 * conversion on the new value, we wrap that call inside this function.
 */

/**
 * 默认情况下，当一个响应式属性被建立，新的 value 也会被 convert 为响应式的，除了下面这种情况：
 * v-for 去循环 alias 和 props时，我们不想要去强制 convert 。因为这个值可能是被嵌套在一个被
 * frozen 的 data 结构下。
 *
 * 无论何时，我们想要设置一个响应式属性，并且不强制 convert 为 new value，我们都可以用这个函数
 * 来包装我们的函数调用。
 */

let shouldConvert = true
export function withoutConversion (fn) {
  shouldConvert = false
  fn()
  shouldConvert = true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

 /**
  * Observer 类，作用到每一个被观察到对象。
  * 一旦作用，观察者就会将目标对象的属性转换到 getter/setter 上
  * 以便于收集依赖和触发变更。
  */

 /**
  * 在 init data 阶段第一次传入的时候，value 是 data
  *
  * 若 data 中有数组元素，且数组包含数组项或者对象项时会再次递归的实例化 Observer 类。
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
    // 将数组的七种变异方法全部改写，使其可以调用时可以通告发布变动。
    var augment = hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)

    // 迭代 array，并为 array 的每一项调用 observer，如果子项是对象或者是数组，则继续新建 Observer 实例进行递归处理。
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 *
 * @param {Object} obj
 */

/**
 * 只有 value 的类型是 Object 时才会调用此方法。
 * 迭代对象中的每一个属性，并对每一个属性值调用 convert 方法。
 */

/**
 * init data 阶段，这里会接收到类型为对象的 data 属性值，
 * 或者 类型为数组且子项类型是对象的子项。
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj)
  for (var i = 0, l = keys.length; i < l; i++) {
    this.convert(keys[i], obj[keys[i]]) // key, value
  }
}

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

/**
 * 遍历数组，并观察数组中的每一项
 * 在 observer 函数中，为 item[i] 创建新的 Observer 实例，
 */
Observer.prototype.observeArray = function (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i])
  }
}

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

 /**
  * Convert 一个属性到 getter/setter，因此在一个属性 存取/改变 时
  * 我们能够去触发事件。
  */

Observer.prototype.convert = function (key, val) {
  // this.value 是 obverser 实例
  // key 和 val 就是 this.value 对象下的 key 和 value
  defineReactive(this.value, key, val)
}

/**
 * Add an owner vm, so that when $set/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm)
}

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm)
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} src
 */

function protoAugment (target, src) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment (target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

/**
 * init data 阶段，会调用 observe(data, this)；
 * 此时 data 不是 Observer 的实例，同时也没有 __ob__ 属性。
 * 并且此时的 shouldConvert 的值是 true。
 */

export function observe (value, vm) {
  // 若是基本类型值，则不需要对其进行改造。
  if (!value || typeof value !== 'object') {
    return
  }
  var ob

  if (
    hasOwn(value, '__ob__') &&  // 如果传入的 data 有 __ob__ 属性
    value.__ob__ instanceof Observer  // 并且 value 是 Observer 的实例
  ) {
    ob = value.__ob__
  } else if (
    shouldConvert &&   // shouldConvert 为 true (参考 line 24)。
    (isArray(value) || isPlainObject(value)) &&  // 是数组或者对象。
    Object.isExtensible(value) &&  // 没有被冻结
    !value._isVue // 自身不是 vue 实例
  ) {
    ob = new Observer(value)
  }
  if (ob && vm) {
    // 将 vm 推入 this.vms 数组
    ob.addVm(vm)
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */

/**
 * 对 data 属性里是对象类型的属性值进行响应化改造。
 */

/**
 * init 阶段的时候，obj === data, key 为 data 的键名, value 为键值。
 */

export function defineReactive (obj, key, val) {
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
  // 短路计算，直接取了 property.get/set 当然，property.get/set 有可能是 undefined
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
      // observe 新的值，如果新值是对象或者数组，就又是一轮改造
      childOb = observe(newVal)
      // 注意啦，这里　notify 了
      dep.notify()
    }
  })
}
