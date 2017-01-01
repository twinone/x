var Command = function(cmd, args) {
  this.cmd = cmd
  this.args = args
}

var X = function X() {
  var self = this;

  this.queue = []
  this.id = 1
  this.data = {}
  this.result = null;
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

X.prototype._debug = function _debug(dbg) {
  this.debugEnabled = dbg
  this.next()
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
    this.result = this.page.evaluate(function(selector, toString) {
      return toString(document.querySelector(selector))
    }, selector, toString)
  } else if (selector instanceof Array) {
    this.result = []
    for (var i = 0; i < selector.length; i++) {
      var res = this.page.evaluate(function(selector, toString) {
        var res = [];
        var nodes = document.querySelectorAll(selector)
        for (var i = 0; i < nodes.length; i++) {
          res.push(toString(nodes[i]))
        }
        return res
      }, selector[i], toString)
      this.result = this.result.concat(res)
    }
  }
  this.next()
}

/**
Saves the previous result as name in the x.data bundle
*/
X.prototype._save = function _save(name) {
  this.data[name] = this.result
  this.next()
}

/**
Example:
x.data.name = ["John", "Peter"]
x.data.id = [1,2]
after
collapse("names", "ids")
x.result would be:
[{"name", "John", "id": 1}, {"name": "Peter", "id: 2"}]

to rename the object keys:
collapse({"firstName":"name", "identifier": "id"})
would change the keys in each object to those

if the sizes of the input arrays are not equal a warning will be logged
*/
X.prototype._collapse = function _collapse(names) {
  if (typeof arguments[0] == 'string') {
    var args = Array.prototype.slice.call(arguments)
    // convert the list of names to an object with no aliases
    names = {}
    args.forEach(function (x) { names[x] = x })
  }
  var length = -1
  for (var key in names) {
    if (names.hasOwnProperty(key)) {
      if (!this.data[names[key]]) {
        this.warn("data object "+names[key]+" doesn't exist (missing save?)")
        continue
      }
      var l = this.data[key].length;
      if (length == -1) length = l
      if (length != l) this.warn("lengths don't match",l+"!="+length)
      length = l < length ? l : length
    }
  }
  // create the objects
  this.log("length", length)
  var res = [];
  for (var i = 0; i < length; i++) {
    var obj = {}
    for (var key in names) {
      if (names.hasOwnProperty(key)) {
        obj[key] = this.data[names[key]][i]
      }
    }
    res.push(obj)
  }
  this.result = res
  // cleanup (maybe we should not do this?)
  for (var key in names) {
    if (names.hasOwnProperty(key)) {
      this.data[names[key]] = undefined
    }
  }
  this.next()
}

X.prototype._evaluate = function _evaluate() {
  this.result = this.page.evaluate.apply(this.page, arguments)
  this.next()
}

X.prototype._result = function _result(func) {
  func(this.result)
  this.next()
}

X.prototype._render = function _render(file) {
  file = file || 'render.png'
  this.log("rendering to",file)
  this.page.render(file)
  this.next()
}

X.prototype._set = function _set(obj, prop) {
  if (typeof arguments[0] == 'string') {
    var selector = arguments[0],
        value = arguments[1],
        prop = arguments[2]
    var obj = {}
    obj[selector] = value
    this._set(obj, prop)
    return
  }

  prop = prop || 'value'
  this.page.evaluate(function(obj, prop) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        document.querySelector(key).setAttribute(prop, obj[key])
      }
    }
    //document.querySelector(sel).setAttribute(prop, val)
  }, obj, prop)
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


X.prototype._switchToMainFrame = function _switchToMainFrame() {
  this.page.switchToMainFrame()
  this.next()
}

X.prototype._switchToFrame = function _switchToFrame(x) {
  this.page.switchToFrame(x)
  this.next()
}


X.prototype._then = function _then(func) {
  var args = Array.prototype.slice.call(arguments).splice(1);
  func.apply(null, args)
  this.next()
}


module.exports = new X()
