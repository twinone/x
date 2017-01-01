var x = require('../x')

x
.open('http://www.google.com')
.find(['a'], function (node) { return node.getAttribute("href") })
.print()
.go()
