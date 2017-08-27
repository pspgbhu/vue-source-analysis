## 初始化 data

首先先通过 vue._initData 函数将 this._data 代理到 this 上 *这个与响应式无关*

重点是函数结尾处的 observe(data, this)

observe 函数如果接受到的第一个参数 typeof 返回非 'object' 则函数 return

接着说，将 this._data 和 this 传入 observer 函数中，会将 this._data 传入 Observer 构造函数中，并返回 ob 实例，将 ob 实例推入 observer.vms 实例下的数组中。 *目前还没有用到observer实例，所以目前这里只是调用了Observer构造函数，所以下面让我们看一下这个的构造函数里做了什么*

## Observer 构造函数
