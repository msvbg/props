'use strict';

import '6to5/polyfill';
import _ from 'lodash';
import Reflect from 'harmony-reflect';

const TOKEN_NUMBER = Symbol('number');
const TOKEN_IDENTIFIER = Symbol('identifier');
const TOKEN_ARGUMENT = Symbol('argument');

const TOKEN_KEYWORD_PLUS = Symbol('keyword_plus');
const TOKEN_KEYWORD_MINUS = Symbol('keyword_minus');
const TOKEN_KEYWORD_MULTIPLY = Symbol('keyword_multiply');
const TOKEN_KEYWORD_DIVIDE = Symbol('keyword_divide');
const TOKEN_KEYWORD_LET = Symbol('keyword_let');
const TOKEN_KEYWORD_IN = Symbol('keyword_in');
const TOKEN_KEYWORD_EQ = Symbol('keyword_eq');
const TOKEN_KEYWORD_IF = Symbol('keyword_if');
const TOKEN_KEYWORD_THEN = Symbol('keyword_then');
const TOKEN_KEYWORD_ELSE = Symbol('keyword_else');

const KEYWORDS = {
    plus: TOKEN_KEYWORD_PLUS,
    minus: TOKEN_KEYWORD_MINUS,
    multiply: TOKEN_KEYWORD_MULTIPLY,
    divide: TOKEN_KEYWORD_DIVIDE,
    let: TOKEN_KEYWORD_LET,
    in: TOKEN_KEYWORD_IN,
    eq: TOKEN_KEYWORD_EQ,
    if: TOKEN_KEYWORD_IF,
    then: TOKEN_KEYWORD_THEN,
    else: TOKEN_KEYWORD_ELSE
};

const PARSER_NUMBER = Symbol('parser_number');
const PARSER_ARGUMENT = Symbol('parser_argument');
const PARSER_PLUS = Symbol('parser_plus');
const PARSER_MINUS = Symbol('parser_minus');
const PARSER_MULTIPLY = Symbol('parser_multiply');
const PARSER_DIVIDE = Symbol('parser_divide');
const PARSER_LET = Symbol('parser_let');
const PARSER_IDENTIFIER = Symbol('parser_identifier');
const PARSER_EQUALITY = Symbol('parser_equality');
const PARSER_IF = Symbol('parser_if');

function Token({ type, value }) {
    this.type = type;
    this.value = value;
}

function run() {
    let tokens = _.takeWhile(arguments, (x) => x instanceof Token);
    let argsPassed = Array.prototype.slice.call(arguments, tokens.length);

    // Count unique occurences of $1, $2, ..., $N in token list
    let numArgs = _.uniq(
        tokens
        .filter((t) => t.type === TOKEN_ARGUMENT)
        .map((t) => t.value)).length;

    //
    // The following line binds
    // 1) an empty environment object as the `this` argument
    // 2) all of the tokens
    // 3) all arguments passed to `run`
    // to the `evaluate` function. If fewer than the required number of
    // arguments are passed, the function will be returned as-is without being
    // invoked.
    // 
    let curried = Function.prototype.bind.apply(evaluate,
        [{}, parse(tokens)].concat(argsPassed));

    if (numArgs !== argsPassed.length) {
        return curried;
    }

    return curried();
}

// The world's tiniest VM
function evaluate(parseTree) {
    let args = Array.prototype.slice.call(arguments, 1);
    let ev = (env, x) => evaluate.apply(env, [x].concat(args));

    if (parseTree.type === PARSER_PLUS) {
        return ev(this, parseTree.a) + ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_MINUS) {
        return ev(this, parseTree.a) - ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_ARGUMENT) {
        return args[parseTree.a - 1];
    } else if (parseTree.type === PARSER_NUMBER) {
        return parseTree.a;
    } else if (parseTree.type === PARSER_IDENTIFIER) {
        return this[parseTree.a];
    } else if (parseTree.type === PARSER_LET) {
        let env = _.cloneDeep(this);
        env[parseTree.a] = ev(this, parseTree.b); 
        return ev(env, parseTree.c);
    } else if (parseTree.type === PARSER_EQUALITY) {
        return ev(this, parseTree.a) === ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_IF) {
        return ev(this, ev(this, parseTree.a) ? parseTree.b : parseTree.c);
    }
}

function parse(tokens) {
    let stack = [];
    parseExpression(tokens, stack);

    return stack.pop();
}

function expect(tokenType, tokens) {
    if (!tokens.length) return (success, fail) => fail();

    if (tokens[0].type === tokenType) {
        return [tokens.slice(1), tokens[0].value];
    } else {
        throw new Error(`Expected ${tokenType.toString()}).`);
    }
}

function accept(tokenType, tokens) {
    if (!tokens.length) return (success, fail) => fail();

    if (tokens[0].type === tokenType) {
        return (success, fail) => success(tokens.slice(1), tokens[0].value);
    } else {
        return (success, fail) => fail();
    }
}

function parserMonad(parser) {
    return function (tokens) {
        let genObj = parser(tokens);
        let send = undefined;
        let result;

        do {
            result = genObj.next(send);
            send = result.value;
        } while (!result.done);

        return result.value;
    };
}

function parseExpression(tokens, stack) {
    if (tokens.length === 0) {
        return tokens;
    }

    return accept(TOKEN_KEYWORD_LET, tokens)(tokens =>
        parserMonad(function *(tokens) {
            let [tokens, identifier] = yield expect(TOKEN_IDENTIFIER, tokens);
            tokens = yield parseConditionalExpr(tokens, stack);
            [tokens] = yield expect(TOKEN_KEYWORD_IN, tokens);
            tokens = yield parseExpression(tokens, stack);

            let inExpr = stack.pop();
            let letExpr = stack.pop();
            stack.push({ type: PARSER_LET,
                a: identifier,
                b: letExpr,
                c: inExpr
            });
            return tokens;
        })(tokens),
    () => parseConditionalExpr(tokens, stack));
}

function parseConditionalExpr(tokens, stack) {
    if (tokens.length === 0) {
        return tokens;
    }

    return accept(TOKEN_KEYWORD_IF, tokens)(tokens =>
        parserMonad(function *(tokens) {
            let tokens = yield parseConditionalExpr(tokens, stack);
            [tokens] = yield expect(TOKEN_KEYWORD_THEN, tokens);
            tokens = yield parseConditionalExpr(tokens, stack);
            [tokens] = yield expect(TOKEN_KEYWORD_ELSE, tokens);
            tokens = yield parseConditionalExpr(tokens, stack);

            let elseExpr = stack.pop();
            let thenExpr = stack.pop();
            let condExpr = stack.pop();
            stack.push({ type: PARSER_IF,
                a: condExpr,
                b: thenExpr,
                c: elseExpr
            });

            return tokens;
        })(tokens),
    () => parseEqualityExpr(tokens, stack));
}

function parseEqualityExpr(tokens, stack) {
    if (tokens.length === 0) {
        return tokens;
    }

    let tokens = parseAdditiveExpr(tokens, stack);

    return accept(TOKEN_KEYWORD_EQ, tokens)(tokens =>
        parserMonad(function *(tokens) {
            let tokens = yield parseEqualityExpr(tokens, stack); 

            let b = stack.pop();
            let a = stack.pop();
            stack.push({ type: PARSER_EQUALITY, a, b });

            return tokens;
        })(tokens)
    , () => tokens);
}

function parseAdditiveExpr(tokens, stack) {
    if (tokens.length === 0) {
        return 0;
    }

    // Shhh! If anyone asks, I didn't write this.
    return accept(TOKEN_NUMBER, tokens)((tokens, number) => {
        stack.push({ type: PARSER_NUMBER, a: number });
        return parseConditionalExpr(tokens, stack);
    }, () =>
    accept(TOKEN_ARGUMENT, tokens)((tokens, argument) => {
        stack.push({ type: PARSER_ARGUMENT, a: argument });
        return parseConditionalExpr(tokens, stack);
    }, () =>
    accept(TOKEN_IDENTIFIER, tokens)((tokens, identifier) => {
        stack.push({ type: PARSER_IDENTIFIER, a: identifier });
        return parseConditionalExpr(tokens, stack);
    }, () =>
    accept(TOKEN_KEYWORD_PLUS, tokens)((tokens) => {
        let tokens = parseConditionalExpr(tokens, stack);
        let b = stack.pop(), a = stack.pop();
        stack.push({ type: PARSER_PLUS, a, b });
        return tokens;
    }, () =>
    accept(TOKEN_KEYWORD_MINUS, tokens)((tokens, identifier) => {
        let tokens = parseConditionalExpr(tokens, stack);
        let b = stack.pop(), a = stack.pop();
        stack.push({ type: PARSER_MINUS, a, b });
        return tokens;
    }, () => tokens)))));
}

function classifyToken(property) {
    let tok = null;

    if (!Object.is(Number(property), NaN)) {
        tok = new Token({ type: TOKEN_NUMBER, value: Number(property) });
    } else if (Object.keys(KEYWORDS).includes(property)) {
        tok = new Token({ type: KEYWORDS[property] });
    } else if (property[0] === '$') {
        tok = new Token({
            type: TOKEN_ARGUMENT,
            value: Number(property.slice(1))
        }); 
    } else {
        tok = new Token({ type: TOKEN_IDENTIFIER, value: property });
    }

    return tok;
}

let handler = {
    get(target, propKey) {
        let token = classifyToken(propKey);
        let newTarget = target.bind(null, token);

        return new Proxy(newTarget, handler);
    }
};

export default Proxy.bind(null, run.bind(null), handler);
