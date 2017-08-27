import Watcher from '../../watcher'
import { compileAndLinkProps } from '../../compiler/index'
import Dep from '../../observer/dep'
import {
  observe,
  defineReactive
} from '../../observer/index'

import {
  warn,
  query,
  hasOwn,
  isReserved,
  isPlainObject,
  bind
} from '../../util/index'

export default function (Vue) {
  /**
   * Accessor for `$data` property, since setting $data
   * requires observing the new object and updating
   * proxied properties.
   */

  // 将 $data 属性作为一个中间代理属性，读取 $data 时，返回的是 this._data。
  // 设置 $data 时，会对比 新的 $data 和 _data 的差异
  // 用 defineProperty 创建的属性，configurable 和 enumerable 描述符的值均为 false
  // 暨 该属性描述符不能被更改和删除，同时该属性也不会出现在对象的可枚举属性中
  Object.defineProperty(Vue.prototype, '$data', {
    get () {
      return this._data
    },
    set (newData) {
      if (newData !== this._data) {
        this._setData(newData)
      }
    }
  })

  /**
   * Setup the scope of an instance, which contains:
   * - observed data
   * - computed properties
   * - user methods
   * - meta properties
   */

  Vue.prototype._initState = function () {
    this._initProps()
    this._initMeta()
    this._initMethods()
    this._initData()
    this._initComputed()
  }

  /**
   * Initialize props.
   */

  Vue.prototype._initProps = function () {
    var options = this.$options
    var el = options.el
    var props = options.props
    /**
     * 校验，必须要 el 元素
     */
    if (props && !el) {
      process.env.NODE_ENV !== 'production' && warn(
        'Props will not be compiled if no `el` option is ' +
        'provided at instantiation.',
        this
      )
    }
    // make sure to convert string selectors into element now
    el = options.el = query(el)

    /**
     * node.nodeType === 1 时，该节是元素节点。
     */

    this._propsUnlinkFn = el && el.nodeType === 1 && props
      // props must be linked in proper scope if inside v-for
      ? compileAndLinkProps(this, el, props, this._scope)
      : null
  }

  /**
   * Initialize the data.
   */

  /**
  * 从这里开时初始化 data
  */

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

    // 保存 this._props 到 props 变量
    var props = this._props

    // proxy data on instance
    // 对 data 里的 key 进行迭代，检查是否已经有相同的 key 被定义在了 prop 上，如果没有，则对该 key 调用
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
    // observe data
    observe(data, this)
  }

  /**
   * Swap the instance's $data. Called in $data's setter.
   *
   * @param {Object} newData
   */

  Vue.prototype._setData = function (newData) {
    newData = newData || {}
    var oldData = this._data
    // 为 _data 设置新值
    this._data = newData
    var keys, key, i
    // unproxy keys not present in new data
    // 如果 newData 中不包含该属性，则会调用 this._unproxy 来删除 this 上的代理属性
    keys = Object.keys(oldData)
    i = keys.length
    while (i--) {
      key = keys[i]
      if (!(key in newData)) {
        this._unproxy(key)
      }
    }
    // proxy keys not already proxied,
    // and trigger change for changed values
    keys = Object.keys(newData)
    i = keys.length
    while (i--) {
      key = keys[i]
      // 如果没有该属性
      if (!hasOwn(this, key)) {
        // new property
        this._proxy(key)
      }
    }
    oldData.__ob__.removeVm(this)
    observe(newData, this)
    this._digest()
  }

  /**
   * Proxy a property, so that
   * vm.prop === vm._data.prop
   *
   * @param {String} key
   */

  // 将 _data 下的属性代理到 vue 根一级下
  // 因此我们才能直接通过 this.property 拿到 this._data.property 的值。
  // 要注意的是，这里对与 $ 和 _ 开头的属性，并没有将其代理在 this 实例下。
  Vue.prototype._proxy = function (key) {
    // 检查是否是 $ 或 _ 开头
    if (!isReserved(key)) {
      // need to store ref to self here
      // because these getter/setters might
      // be called by child scopes via
      // prototype inheritance.

      // 这里储存了 this 上下文环境，
      // 因为这里的 getter 和 setter 在其他的 vue 实例上下文中被调用
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

  /**
   * Unproxy a property.
   *
   * @param {String} key
   */

  Vue.prototype._unproxy = function (key) {
    if (!isReserved(key)) {
      delete this[key]
    }
  }

  /**
   * Force update on every watcher in scope.
   */

  Vue.prototype._digest = function () {
    for (var i = 0, l = this._watchers.length; i < l; i++) {
      this._watchers[i].update(true) // shallow updates
    }
  }

  /**
   * Setup computed properties. They are essentially
   * special getter/setters
   */

  function noop () {}

  Vue.prototype._initComputed = function () {
    var computed = this.$options.computed
    if (computed) {
      for (var key in computed) {
        var userDef = computed[key]

        /**
         * 可遍历，可设置
         */
        var def = {
          enumerable: true,
          configurable: true
        }

        if (typeof userDef === 'function') {
          def.get = makeComputedGetter(userDef, this)
          def.set = noop

        } else {
          def.get = userDef.get
            ? userDef.cache !== false
              ? makeComputedGetter(userDef.get, this)
              : bind(userDef.get, this)
            : noop
          def.set = userDef.set
            ? bind(userDef.set, this)
            : noop
        }
        Object.defineProperty(this, key, def)
      }
    }
  }

  function makeComputedGetter (getter, owner) {
    var watcher = new Watcher(owner, getter, null, {
      lazy: true
    })
    /**
     * 此为 computed 的 getter
     */
    return function computedGetter () {

      if (watcher.dirty) {  // new Watcher 时的 options.lazy
        /**
         * watcher = watcher.get();
         * watcher.dirty = false;
         */
        watcher.evaluate()
      }
      if (Dep.target) {    // 是一个全局对象，只有一个
        watcher.depend()
      }
      return watcher.value
    }
  }

  /**
   * Setup instance methods. Methods must be bound to the
   * instance since they might be passed down as a prop to
   * child components.
   */

  Vue.prototype._initMethods = function () {
    var methods = this.$options.methods
    if (methods) {
      for (var key in methods) {
        /**
         * ANA
         * bind methods
         */
        this[key] = bind(methods[key], this)
      }
    }
  }

  /**
   * Initialize meta information like $index, $key & $value.
   */

  Vue.prototype._initMeta = function () {
    var metas = this.$options._meta
    if (metas) {
      for (var key in metas) {
        defineReactive(this, key, metas[key])
      }
    }
  }
}
