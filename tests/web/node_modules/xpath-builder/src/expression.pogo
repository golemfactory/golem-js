Renderer = require './renderer'.Renderer

create expression (prototype) =

    Expression (expression, args, ...) =
        this.expression = expression
        this.args = args
        this

    Expression.prototype = prototype
    Expression.prototype.is expression = true
    Expression.prototype.to XPath (type) = Renderer.render(self, type)
    Expression.prototype.to string() = self.to XPath()
    Expression.prototype.inspect() = self.to XPath()
    Expression.prototype.current() = self

    Expression

exports.create expression = create expression
