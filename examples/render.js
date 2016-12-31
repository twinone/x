var x = require('../x')
var args = require('system').args

var url = args[1] || "http://example.com"
var file = args[2] || "render.png"

console.log("Rendering", url, "to", file)

x.open(url).render(file).go()
