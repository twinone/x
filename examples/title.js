var x = require('../x')

x
.open('http://www.google.com')
.find('title').save('title')
.print()
.go()
