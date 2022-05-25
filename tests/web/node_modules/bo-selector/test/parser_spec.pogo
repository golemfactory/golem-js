parser = require("../parser").parser
Node = require("./renderer").Node

describe 'parser'

    parser.yy.create (data) = @new Node (data)

    parses (input) as (output) =
        it "parses #(input) as #(output)"
            parser.parse(input).render().should.equal(output)

    parses (input) =
        parses (input) as (input)

    parses "*"
    parses "a"
    parses "a, b"
    parses "a,b" as "a, b"
    parses "a, b,c" as "a, b, c"
    parses "a.b"
    parses "a.b.c"
    parses "#a"
    parses "#a.b"
    parses ".a #b"
    parses "a[b]"
    parses "a[b][c]"

    parses "a[b = c]"
    parses "a[b= c]" as "a[b = c]"
    parses "a[b =c]" as "a[b = c]"
    parses "a[b=c]" as "a[b = c]"
    parses "a[b = 'c']" as "a[b = c]"
    parses "a[b= 'c']" as "a[b = c]"
    parses "a[b ='c']" as "a[b = c]"
    parses "a[b='c']" as "a[b = c]"
    parses 'a[b = "c"]' as "a[b = c]"
    parses 'a[b= "c"]' as 'a[b = c]'
    parses 'a[b ="c"]' as 'a[b = c]'
    parses 'a[b="c"]' as 'a[b = c]'

    parses "a[b ~= c]"
    parses "a[b~= c]" as "a[b ~= c]"
    parses "a[b ~=c]" as "a[b ~= c]"
    parses "a[b~=c]" as "a[b ~= c]"
    parses "a[b ~= 'c']" as "a[b ~= c]"
    parses "a[b~= 'c']" as "a[b ~= c]"
    parses "a[b ~='c']" as "a[b ~= c]"
    parses "a[b~='c']" as "a[b ~= c]"
    parses 'a[b ~= "c"]' as "a[b ~= c]"
    parses 'a[b~= "c"]' as 'a[b ~= c]'
    parses 'a[b ~="c"]' as 'a[b ~= c]'
    parses 'a[b~="c"]' as 'a[b ~= c]'

    parses "a[b |= c]"
    parses "a[b|= c]" as "a[b |= c]"
    parses "a[b |=c]" as "a[b |= c]"
    parses "a[b|=c]" as "a[b |= c]"
    parses "a[b |= 'c']" as "a[b |= c]"
    parses "a[b|= 'c']" as "a[b |= c]"
    parses "a[b |='c']" as "a[b |= c]"
    parses "a[b|='c']" as "a[b |= c]"
    parses 'a[b |= "c"]' as "a[b |= c]"
    parses 'a[b|= "c"]' as 'a[b |= c]'
    parses 'a[b |="c"]' as 'a[b |= c]'
    parses 'a[b|="c"]' as 'a[b |= c]'

    parses "a[b *= c]"
    parses "a[b*= c]" as "a[b *= c]"
    parses "a[b *=c]" as "a[b *= c]"
    parses "a[b*=c]" as "a[b *= c]"
    parses "a[b *= 'c']" as "a[b *= c]"
    parses "a[b*= 'c']" as "a[b *= c]"
    parses "a[b *='c']" as "a[b *= c]"
    parses "a[b*='c']" as "a[b *= c]"
    parses 'a[b *= "c"]' as "a[b *= c]"
    parses 'a[b*= "c"]' as 'a[b *= c]'
    parses 'a[b *="c"]' as 'a[b *= c]'
    parses 'a[b*="c"]' as 'a[b *= c]'

    parses "a[b ^= c]"
    parses "a[b^= c]" as "a[b ^= c]"
    parses "a[b ^=c]" as "a[b ^= c]"
    parses "a[b^=c]" as "a[b ^= c]"
    parses "a[b ^= 'c']" as "a[b ^= c]"
    parses "a[b^= 'c']" as "a[b ^= c]"
    parses "a[b ^='c']" as "a[b ^= c]"
    parses "a[b^='c']" as "a[b ^= c]"
    parses 'a[b ^= "c"]' as "a[b ^= c]"
    parses 'a[b^= "c"]' as 'a[b ^= c]'
    parses 'a[b ^="c"]' as 'a[b ^= c]'
    parses 'a[b^="c"]' as 'a[b ^= c]'

    parses "a[b $= c]"
    parses "a[b$= c]" as "a[b $= c]"
    parses "a[b $=c]" as "a[b $= c]"
    parses "a[b$=c]" as "a[b $= c]"
    parses "a[b $= 'c']" as "a[b $= c]"
    parses "a[b$= 'c']" as "a[b $= c]"
    parses "a[b $='c']" as "a[b $= c]"
    parses "a[b$='c']" as "a[b $= c]"
    parses 'a[b $= "c"]' as "a[b $= c]"
    parses 'a[b$= "c"]' as 'a[b $= c]'
    parses 'a[b $="c"]' as 'a[b $= c]'
    parses 'a[b$="c"]' as 'a[b $= c]'

    parses "a b"

    parses "a > b"
    parses "a> b" as "a > b"
    parses "a >b" as "a > b"
    parses "a>b" as "a > b"
    parses "a>b >c" as "a > b > c"
    parses "a > b > c d"

    parses "> a" as "> a"
    parses ">a" as "> a"
    parses ">a:not(>b)" as "> a:not(> b)"
    parses "> a > b" as "> a > b"

    parses "a ~ b"
    parses "a~ b" as "a ~ b"
    parses "a ~b" as "a ~ b"
    parses "a~b" as "a ~ b"

    parses "a + b"
    parses "a+ b" as "a + b"
    parses "a +b" as "a + b"
    parses "a+b" as "a + b"

    parses "*:a"
    parses ":a"
    parses ":a-b"
    parses "a:b"
    parses "a:b:c"
    parses ":a(b)"
    parses ":a-b(c)"
    parses "a:b(c)"
    parses "a:b(c > d)"

    parses ":has(> a)" as ":has(> a)"
    parses ":not(:not(b))" as ":not(:not(b))"

    parses "a:nth-child(123)" as "a:nth-child(123)"
    parses "a:first-child()" as "a:first-child()"
    parses ":first-child()" as ":first-child()"

    parses ":nth-of-type(2n)"
    parses ":nth-of-type(23n)"
    parses ":nth-of-type(2n+3)"
    parses ":nth-of-type(n+3)"
    parses ":nth-of-type(-n+3)" as ":nth-of-type(-1n+3)"
    parses ":nth-of-type(-2n)" as ":nth-of-type(-2n)"

    parses ":nth-last-of-type(2n)"
    parses ":nth-last-of-type(23n)"
    parses ":nth-last-of-type(2n+3)"
    parses ":nth-last-of-type(n+3)"
    parses ":nth-last-of-type(-n+3)" as ":nth-last-of-type(-1n+3)"
    parses ":nth-last-of-type(-2n)" as ":nth-last-of-type(-2n)"

    parses ":nth-of-type(odd)" as ":nth-of-type(<odd>)"
    parses ":nth-last-of-type(odd)" as ":nth-last-of-type(<odd>)"
    parses ":nth-of-type(even)" as ":nth-of-type(<even>)"
    parses ":nth-last-of-type(even)" as ":nth-last-of-type(<even>)"

    parses "a[b = c], c[d]:e:f(g *:h:i[j]:k), :l > m[n ~= o][p = 'q'].r.s" as (
        "a[b = c], c[d]:e:f(g *:h:i[j]:k), :l > m[n ~= o][p = q].r.s"
    )
