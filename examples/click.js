var x = require('../x')

x
.open('http://www.example.com')
.click('a')
.wait() // wait until the page is loaded
.then(function() {
  console.log("now at", x.page.url)
})
.go()
