(function() {
    var self = this;
    var Renderer, createExpression;
    Renderer = require("./renderer").Renderer;
    createExpression = function(prototype) {
        var Expression;
        Expression = function(expression) {
            var args = Array.prototype.slice.call(arguments, 1, arguments.length);
            this.expression = expression;
            this.args = args;
            return this;
        };
        Expression.prototype = prototype;
        Expression.prototype.isExpression = true;
        Expression.prototype.toXPath = function(type) {
            var self = this;
            return Renderer.render(self, type);
        };
        Expression.prototype.toString = function() {
            var self = this;
            return self.toXPath();
        };
        Expression.prototype.inspect = function() {
            var self = this;
            return self.toXPath();
        };
        Expression.prototype.current = function() {
            var self = this;
            return self;
        };
        return Expression;
    };
    exports.createExpression = createExpression;
}).call(this);