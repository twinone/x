var Command = function(cmd, args) {
  this.cmd = cmd
  this.args = args
}

var X = function X() {
  this.page = require('webpage').create()
  this.queue = []
  this.id = 1
  this.data = {}
  this.evalResult = null;

  var self = this;

  var assign = function(k, kk) {
    this[kk] = function() {
      var args = [].slice.call(arguments);
      this.queue.push(new Command(k, args))
      return this
    }
  }.bind(this)

  for (var k in X.prototype) {
    //console.log(k + " -> " + X.prototype[k]);
    if (k.substring(0,1) != "_") continue
    const kk = k.substring(1)
    assign(k, kk)
  }
}

X.prototype.go = function go() {
  this.next()
}

X.prototype.next = function next() {
  //console.log("go, queue:")
  //console.log(JSON.stringify(this.queue))

  if (this.queue.length == 0) {
    phantom.exit()
    return;
  }

  var cmd = X.prototype[this.queue[0].cmd]
  var args = this.queue[0].args
  //console.log("Executing command", this.queue[0].cmd)
  this.queue.shift()
  cmd.apply(this, args)
}


X.prototype._open = function _open(url) {
  //console.log("arguments:", JSON.stringify(url))
  //console.log("opening:", url)
  this.page.onLoadFinished = function(status) {
    //console.log("finished loading", url, status)
    this.next()
  }.bind(this)
  this.page.open(url)
}

X.prototype._delay = function _delay(millis) {
  var self = this;
  setTimeout(function() {
    self.next()
  }, millis)
}

X.prototype._find = function _find(selector, toString) {
  toString = toString || function toString(node) {
    return node.textContent
  }

  if (typeof selector === 'string') {
    this.evalResult = this.page.evaluate(function(selector) {
      return document.querySelector(selector).textContent
    }, selector)
  } else if (selector instanceof Array) {
    this.evalResult = []
    for (var i = 0; i < selector.length; i++) {
      var res = this.page.evaluate(function(selector, toString) {
        var res = [];
        var nodes = document.querySelectorAll(selector)
        for (var i = 0; i < nodes.length; i++) {
          res.push(toString(nodes[i]))
        }
        return res
      }, selector[i], toString)
      this.evalResult = this.evalResult.concat(res)
    }
  }
  this.next()
}

X.prototype._evaluate = function _evaluate() {
  this.evalResult = this.page.evaluate.apply(this.page, arguments)
  this.next()
}

X.prototype._result = function _result(func) {
  func(this.evalResult)
  this.next()
}

X.prototype._render = function _render(file) {
  this.page.render(file)
  this.next()
}



// TODO
// waitfor, frame, render, set




module.exports = new X()
