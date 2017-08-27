function Demo (str) {
  this._init(str);
}

initMixin(Demo);
funcMixin(Demo);


function initMixin(Demo) {
  console.log('initMixin');

  Demo.prototype._init = function (str) {
    console.log('prototype _init');
    this.str = str;
    this._func(str);
  }
}


function funcMixin(Demo) {
  console.log('funcMixin');

  Demo.prototype._func = function (str) {
    console.log('prototype _func');
    this.funcstr = str;
  }
}

var demo = new Demo('lalal');

console.log(demo);