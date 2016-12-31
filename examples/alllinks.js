var x = require('../x')

x
.open('http://www.google.com')
.find(['a'], function (node) { return node.getAttribute("href") })
.result(function(result) {
  console.log("result:", JSON.stringify(result, null, "  "))
})
.go()
