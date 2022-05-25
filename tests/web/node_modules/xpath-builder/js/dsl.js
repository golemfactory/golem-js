(function() {
    var self = this;
    var expression, Literal, topLevelMethods, expressionLevelMethods, literals, TopLevel, ExpressionLevel, method, Expression, Union;
    expression = require("./expression");
    Literal = require("./literal").Literal;
    topLevelMethods = {
        current: function() {
            var self = this;
            return new Expression("thisNode");
        },
        name: function() {
            var self = this;
            return new Expression("nodeName", self.current());
        },
        descendant: function() {
            var self = this;
            var elementNames = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("descendant", self.current(), literals(elementNames));
        },
        child: function() {
            var self = this;
            var elementNames = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("child", self.current(), literals(elementNames));
        },
        axis: function(name, tagName) {
            var self = this;
            return new Expression("axis", self.current(), new Literal(name), new Literal(tagName || "*"));
        },
        nextSibling: function() {
            var self = this;
            var names = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("nextSibling", self.current(), literals(names));
        },
        previousSibling: function() {
            var self = this;
            var names = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("previousSibling", self.current(), literals(names));
        },
        anywhere: function() {
            var self = this;
            var names = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("anywhere", literals(names));
        },
        attr: function(name) {
            var self = this;
            return new Expression("attribute", self.current(), new Literal(name));
        },
        contains: function(expression) {
            var self = this;
            return new Expression("contains", self.current(), expression);
        },
        startsWith: function(expression) {
            var self = this;
            return new Expression("startsWith", self.current(), expression);
        },
        endsWith: function(expression) {
            var self = this;
            return new Expression("endsWith", self.current(), expression);
        },
        text: function() {
            var self = this;
            return new Expression("text", self.current());
        },
        string: function() {
            var self = this;
            return new Expression("stringFunction", self.current());
        },
        substring: function(expressionA, expressionB) {
            var self = this;
            var expressions;
            expressions = [ expressionA ];
            if (expressionB) {
                expressions.push(expressionB);
            }
            return new Expression("substringFunction", self.current(), expressions);
        },
        stringLength: function() {
            var self = this;
            return new Expression("stringLengthFunction", self.current());
        },
        literal: function(string) {
            var self = this;
            return new Literal(string);
        },
        concat: function() {
            var self = this;
            var expressions = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("concatFunction", expressions);
        },
        nthChild: function(n) {
            var self = this;
            return new Expression("nthChild", n);
        },
        nthLastChild: function(n) {
            var self = this;
            return new Expression("nthLastChild", n);
        },
        firstChild: function() {
            var self = this;
            return new Expression("firstChild");
        },
        lastChild: function() {
            var self = this;
            return new Expression("lastChild");
        },
        onlyChild: function() {
            var self = this;
            return new Expression("onlyChild");
        },
        onlyOfType: function() {
            var self = this;
            return new Expression("onlyOfType");
        },
        firstOfType: function() {
            var self = this;
            return new Expression("nthOfType", 1);
        },
        lastOfType: function() {
            var self = this;
            return new Expression("lastOfType");
        },
        nthOfType: function(n) {
            var self = this;
            return new Expression("nthOfType", n);
        },
        nthLastOfType: function(n) {
            var self = this;
            return new Expression("nthLastOfType", n);
        },
        nthOfTypeMod: function(m, n) {
            var self = this;
            return new Expression("nthOfTypeMod", m, n || 0);
        },
        nthOfTypeOdd: function() {
            var self = this;
            return new Expression("nthOfTypeOdd");
        },
        nthOfTypeEven: function() {
            var self = this;
            return new Expression("nthOfTypeEven");
        },
        nthLastOfTypeMod: function(m, n) {
            var self = this;
            return new Expression("nthLastOfTypeMod", m, n || 0);
        },
        nthLastOfTypeOdd: function() {
            var self = this;
            return new Expression("nthLastOfTypeOdd");
        },
        nthLastOfTypeEven: function() {
            var self = this;
            return new Expression("nthLastOfTypeEven");
        },
        empty: function() {
            var self = this;
            return new Expression("empty");
        }
    };
    expressionLevelMethods = {
        where: function(expression) {
            var self = this;
            return new Expression("where", self.current(), expression);
        },
        oneOf: function() {
            var self = this;
            var expressions = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Expression("oneOf", self.current(), expressions);
        },
        equals: function(expression) {
            var self = this;
            return new Expression("equality", self.current(), expression);
        },
        is: function(expression) {
            var self = this;
            return new Expression("is", self.current(), expression);
        },
        or: function(expression) {
            var self = this;
            return new Expression("or", self.current(), expression);
        },
        and: function(expression) {
            var self = this;
            return new Expression("and", self.current(), expression);
        },
        union: function() {
            var self = this;
            var expressions = Array.prototype.slice.call(arguments, 0, arguments.length);
            return new Union([ self ].concat(expressions));
        },
        inverse: function() {
            var self = this;
            return new Expression("inverse", self.current());
        },
        stringLiteral: function() {
            var self = this;
            return new Expression("stringLiteral", self);
        },
        normalize: function() {
            var self = this;
            return new Expression("normalizedSpace", self.current());
        },
        n: function() {
            var self = this;
            return self.normalize();
        },
        add: function(number) {
            var self = this;
            return new Expression("addition", self.current(), number);
        },
        subtract: function(number) {
            var self = this;
            return new Expression("subtraction", self.current(), number);
        },
        count: function() {
            var self = this;
            return new Expression("countFunction", self.current());
        }
    };
    literals = function(items) {
        return items.map(function(item) {
            return new Literal(item);
        });
    };
    TopLevel = function() {
        return this;
    };
    TopLevel.prototype = topLevelMethods;
    ExpressionLevel = function() {
        return this;
    };
    ExpressionLevel.prototype = new TopLevel();
    for (method in expressionLevelMethods) {
        (function(method) {
            ExpressionLevel.prototype[method] = expressionLevelMethods[method];
        })(method);
    }
    Expression = expression.createExpression(ExpressionLevel.prototype);
    Union = function(expressions) {
        this.expression = "union";
        this.args = expressions;
        return this;
    };
    Union.prototype = Expression.prototype;
    exports.dsl = function() {
        var self = this;
        return new TopLevel();
    };
}).call(this);