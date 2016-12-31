var Command = function(cmd, args) {
  this.cmd = cmd
  this.args = args
}

var X = function X() {
  var self = this;

  this.queue = []
  this.id = 1
  this.data = {}
  this.evalResult = null;
  this.debugEnabled = true;
  this.waitPageInterval = 250;
  this.waitInterval = 60;


  this.page = require('webpage').create()
  this.page.onConsoleMessage = function(msg) {
    self.log("Console:", msg)
  }
  this.page.onUrlChanged = function(url) {
    this.log('------URL Change:', url);
  }
  this.page.onNavigationRequested = function(url, type, willNavigate, main) {
    this.log('------Nav requested:', url);
  }

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

X.prototype.log = function log() {
  if (this.debugEnabled)
    console.log.apply(console, Array.prototype.slice.call(arguments));
}


X.prototype.go = function go() {
  this.next()
}

X.prototype.next = function next() {
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
  this.log("Loading:", url)
  this.page.onLoadFinished = function(status) {
    this.log("Loaded", status + ":", url)
    this.next()
    this.page.onLoadFinished = null;
  }.bind(this)
  this.page.open(url)
}

X.prototype._delay = function _delay(millis) {
  this.log("Waiting",millis,"ms")
  var self = this;
  setTimeout(function() {
    self.log("Waiting done")
    self.next()
  }, millis)
}

X.prototype._find = function _find(selector, toString) {
  toString = toString || function toString(node) {
    return node.textContent
  }

  if (typeof selector === 'string') {
    this.evalResult = this.page.evaluate(function(selector, toString) {
      return toString(document.querySelector(selector))
    }, selector, toString)
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
  file = file || 'render.png'
  this.log("rendering to",file)
  this.page.render(file)
  this.next()
}

X.prototype._set = function _set(selector, value, prop) {
  prop = prop || 'value'
  this.page.evaluate(function(sel, val, prop) {
    document.querySelector(sel).setAttribute(prop, val)
  }, selector, value, prop)
  this.next()
}

X.prototype._click = function _click(selector) {
  var clicked = this.page.evaluate(function(sel) {
    var target = document.querySelector(sel)
    if (target) target.click()
    return !!target
  }, selector)
  if (!clicked) this.log("Warning: no target found for", selector)
  else {
    this.log('clicked', selector)
  }
  this.next()
}

/**
Wait for a function to complete
This function is NOT run in the webpage, see waitPage()
*/
X.prototype._wait = function _wait(func) {
  var self = this;
  this.waitId = setInterval(function() {
    if (!!func()) {
      clearInterval(self.waitId)
      self.next()
    }
  }, this.waitInterval)
}

/**
Wait for an event on the page
*/
X.prototype._waitPage = function _waitPage() {
  var self = this;
  var args = Array.prototype.slice.call(arguments)
  this.waitId = setInterval(function() {
    if (self.page.evaluate.apply(self.page, args)) {
      clearInterval(self.waitId)
      self.next()
    }
  }, this.waitPageInterval)
}

X.prototype._waitFor = function _waitFor(selector) {
  this.log("waiting for", selector)
  this._waitPage(function(sel, dbg) {
    if (dbg) console.log("waiting for", sel, !!document.querySelector(sel))
    return !!document.querySelector(sel)
  }, selector, this.debugEnabled)
}


/**
Get the phantom page to do some custom processing on it
*/
X.prototype._do = function _do(func) {
  func(this.page)
  this.next()
}



X.prototype._then = function _then(func) {
  var args = Array.prototype.slice.call(arguments).splice(1);
  func.apply(null, args)
  this.next()
}


module.exports = new X()
