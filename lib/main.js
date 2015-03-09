'use strict';

import '6to5/polyfill';
import _ from 'lodash';
import Reflect from 'harmony-reflect';

const KEYWORDS = [
    'plus', 'minus', 'multiply', 'divide', 'let', 'in',
    'eq', 'neq', 'if', 'then', 'else'
];

const TOKEN_NUMBER = Symbol('number');
const TOKEN_KEYWORD = Symbol('keyword');
const TOKEN_IDENTIFIER = Symbol('identifier');
const TOKEN_ARGUMENT = Symbol('argument');

const PARSER_NUMBER = Symbol();
const PARSER_ARGUMENT = Symbol();
const PARSER_PLUS = Symbol();
const PARSER_MINUS = Symbol();
const PARSER_MULTIPLY = Symbol();
const PARSER_DIVIDE = Symbol();
const PARSER_LET = Symbol();
const PARSER_IDENTIFIER = Symbol();
const PARSER_EQUALITY = Symbol();
const PARSER_NOT_EQUALITY = Symbol();
const PARSER_IF = Symbol();

function Token({ type, value }) {
    this.type = type;
    this.value = value;
}

function run() {
    let tokens = _.takeWhile(arguments, (x) => x instanceof Token);
    let argsPassed = Array.prototype.slice.call(arguments, tokens.length);
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
    } else if (parseTree.type === PARSER_NOT_EQUALITY) {
        return ev(this, parseTree.a) !== ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_IF) {
        return ev(this, ev(this, parseTree.a) ? parseTree.b : parseTree.c);
    }
}

function parse(tokens) {
    let stack = [];
    parseExpression(tokens, stack);

    return stack.pop();
}

function parseExpression(tokens, stack) {
    if (tokens.length === 0) {
        return 0;
    }

    if (tokens[0].type === TOKEN_KEYWORD && tokens[0].value === 'let') {
        if (tokens[1].type !== TOKEN_IDENTIFIER) {
            console.log("Expected name after `let` keyword.");
        }

        let consumed = parseConditionalExpr(tokens.slice(2), stack);
        if (consumed) {
            let b = stack.pop();
            let inExpr = tokens.slice(2 + consumed);
            if (inExpr[0].value !== 'in') {
                console.log("Expected `in` keyword in `let` expression.");
            }
            let inExprConsumed = parseExpression(inExpr.slice(1), stack);
            let c = stack.pop();
            stack.push({ type: PARSER_LET, a: tokens[1].value, b, c });
            return 2 + consumed + inExprConsumed;
        }
    } else {
        return parseConditionalExpr(tokens, stack);
    }
}

function parseConditionalExpr(tokens, stack) {
    if (tokens.length === 0) {
        return 0;
    }

    if (tokens[0].value === 'if') {
        let consumed1 = parseConditionalExpr(tokens.slice(1), stack);

        if (consumed1) {
            let a = stack.pop();
            if (tokens.slice(1 + consumed1)[0].value === 'then') {
                let thenConsumed = parseConditionalExpr(tokens.slice(2 + consumed1), stack);
                if (tokens.slice(2 + consumed1 + thenConsumed)[0].value !== 'else') {
                    console.log("Expected `else` keyword in `if` expression.");
                }
                let b = stack.pop();

                let elseConsumed = parseConditionalExpr(tokens.slice(3 + consumed1 + thenConsumed), stack);

                let c = stack.pop();
                stack.push({ type: PARSER_IF, a, b, c });
                return 3 + consumed1 + thenConsumed + elseConsumed;
            } else {
                console.log("Expected `then` after `if` conditional");
            }
        }
    } else {
        return parseEqualityExpr(tokens, stack);
    }
}

function parseEqualityExpr(tokens, stack) {
    if (tokens.length === 0) {
        return 0;
    }

    let consumed1 = parseAdditiveExpr(tokens, stack);

    if (tokens.slice(consumed1).length === 0) {
        return consumed1;
    }

    if (['eq', 'neq'].includes(tokens.slice(consumed1)[0].value)) {
        let consumed2 = parseEqualityExpr(tokens.slice(consumed1 + 1), stack)
        if (consumed2) {
            let b = stack.pop();
            let a = stack.pop();
            if (tokens.slice(consumed1)[0].value === 'eq') {
                stack.push({ type: PARSER_EQUALITY, a, b });
            } else {
                stack.push({ type: PARSER_NOT_EQUALITY, a, b });
            }
            return 1 + consumed2;
        } else {
            console.log("Parse error");
        }
    }

    return consumed1;
}

function parseAdditiveExpr(tokens, stack) {
    if (tokens.length === 0) {
        return 0;
    }

    if (tokens[0].type === TOKEN_NUMBER) {
        stack.push({ type: PARSER_NUMBER, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_ARGUMENT) {
        stack.push({ type: PARSER_ARGUMENT, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_IDENTIFIER) {
        stack.push({ type: PARSER_IDENTIFIER, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_KEYWORD && ['plus', 'minus'].includes(tokens[0].value)) {
        let tree = parseConditionalExpr(tokens.slice(1), stack)
        if (tree) {
            let b = stack.pop();
            let a = stack.pop();
            if (tokens[0].value === 'plus') {
                stack.push({ type: PARSER_PLUS, a, b });
            } else {
                stack.push({ type: PARSER_MINUS, a, b });
            }
            return 1 + tree;
        } else {
            console.log("Parse error");
        }
    }

    return 0;
}

function classifyToken(property) {
    let tok = null;

    if (!Object.is(Number(property), NaN)) {
        tok = new Token({ type: TOKEN_NUMBER, value: Number(property) });
    } else if (KEYWORDS.includes(property)) {
        tok = new Token({ type: TOKEN_KEYWORD, value: property });
    } else if (property[0] === '$') {
        tok = new Token({ type: TOKEN_ARGUMENT, value: Number(property.slice(1)) }); 
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
