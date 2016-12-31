var x = require('../x')

x
.open('http://www.google.com')
.find('title')
.result(function(result) {
  console.log("result:", JSON.stringify(result, null, "  "))
})
.go()
