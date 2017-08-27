var arr = [1,2,3]

var a = {};

Object.defineProperty(a, 'data', {
  get: function() {
    console.log('get');
    return 2;
  },
  set: function(newValue) {
    console.log('set');
    arr = newValue;
  }
});

a.data = a.data + 1;