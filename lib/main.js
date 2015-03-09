'use strict';

import '6to5/polyfill';
import _ from 'lodash';
import Reflect from 'harmony-reflect';

const keywords = [
    'plus', 'minus', 'multiply', 'divide', 'let', 'in',
    'eq', 'neq', 'if', 'then', 'else'
];

const TOKEN_NUMBER = Symbol('number');
const TOKEN_KEYWORD = Symbol('keyword');
const TOKEN_IDENTIFIER = Symbol('identifier');
const TOKEN_ARGUMENT = Symbol('argument');

const PARSER_NUMBER_EXPR = Symbol();
const PARSER_ARGUMENT_EXPR = Symbol();
const PARSER_PLUS_EXPR = Symbol();
const PARSER_MINUS_EXPR = Symbol();
const PARSER_MULTIPLY_EXPR = Symbol();
const PARSER_DIVIDE_EXPR = Symbol();
const PARSER_LET_EXPR = Symbol();
const PARSER_IDENTIFIER_EXPR = Symbol();
const PARSER_EQUALITY_EXPR = Symbol();
const PARSER_NOT_EQUALITY_EXPR = Symbol();
const PARSER_IF_EXPR = Symbol();

const PASS_THROUGH_PROPERTIES = [
    '__esModule',
    'default',
    'tokens',
    'inspect'
];

function Token({ type, value }) {
    this.type = type;
    this.value = value;
}

let handler = {
    get(target, propKey, receiver) {
        if (PASS_THROUGH_PROPERTIES.includes(propKey)) {
            return Reflect.get(target, propKey);
        }

        let tok = null;

        if (!Object.is(Number(propKey), NaN)) {
            tok = new Token({ type: TOKEN_NUMBER, value: Number(propKey) });
        } else if (keywords.includes(propKey)) {
            tok = new Token({ type: TOKEN_KEYWORD, value: propKey });
        } else if (propKey[0] === '$') {
            tok = new Token({ type: TOKEN_ARGUMENT, value: Number(propKey.slice(1)) }); 
        } else {
            tok = new Token({ type: TOKEN_IDENTIFIER, value: propKey });
        }

        return new Proxy(target.bind(null, tok), handler);
    }
};
let Props = Proxy.bind(null, run.bind(null), handler);

function run() {
    let tokens = _.takeWhile(arguments, (x) => x instanceof Token);
    let argsPassed = Array.prototype.slice.call(arguments, tokens.length);
    let numArgs = _.uniq(
        tokens
        .filter((t) => t.type === TOKEN_ARGUMENT)
        .map((t) => t.value)).length;

    let curried = Function.prototype.bind.apply(
        evaluate, [{}, parse(tokens)].concat(argsPassed));

    if (numArgs !== argsPassed.length) {
        return curried;
    }

    return curried();
}

function evaluate(parseTree) {
    let args = Array.prototype.slice.call(arguments, 1);
    let ev = (env, x) => evaluate.apply(env, [x].concat(args));

    if (parseTree.type === PARSER_PLUS_EXPR) {
        return ev(this, parseTree.a) + ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_MINUS_EXPR) {
        return ev(this, parseTree.a) - ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_ARGUMENT_EXPR) {
        return args[parseTree.a - 1];
    } else if (parseTree.type === PARSER_NUMBER_EXPR) {
        return parseTree.a;
    } else if (parseTree.type === PARSER_IDENTIFIER_EXPR) {
        return this[parseTree.a];
    } else if (parseTree.type === PARSER_LET_EXPR) {
        let env = _.cloneDeep(this);
        env[parseTree.a] = ev(this, parseTree.b); 
        return ev(env, parseTree.c);
    } else if (parseTree.type === PARSER_EQUALITY_EXPR) {
        return ev(this, parseTree.a) === ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_NOT_EQUALITY_EXPR) {
        return ev(this, parseTree.a) !== ev(this, parseTree.b);
    } else if (parseTree.type === PARSER_IF_EXPR) {
        return ev(this, ev(this, parseTree.a) ? parseTree.b : parseTree.c);
    }
}

function parse(tokens) {
    let stack = [];
    parseExpression(tokens, stack);

    function log(x) {
        let str = "";

        if (x.type === PARSER_NUMBER_EXPR) {
            str += x.a;
        } else if (x.type === PARSER_PLUS_EXPR) {
            str += `+(${log(x.a)}, ${log(x.b)})`;
        } else if (x.type === PARSER_MINUS_EXPR) {
            str += `-(${log(x.a)}, ${log(x.b)})`;
        } else if (x.type === PARSER_ARGUMENT_EXPR) {
            str += '$' + x.a;
        } else if (x.type === PARSER_LET_EXPR) {
            str += 'let ' + x.a + ' ' + log(x.b) + ' in ' + log(x.c);
        } else if (x.type === PARSER_IDENTIFIER_EXPR) {
            str += x.a;
        } else if (x.type === PARSER_EQUALITY_EXPR) {
            str += `${log(x.a)} === ${log(x.b)}`;
        } else if (x.type === PARSER_NOT_EQUALITY_EXPR) {
            str += `${log(x.a)} !== ${log(x.b)}`;
        } else if (x.type === PARSER_IF_EXPR) {
            str += `if ${log(x.a)} then ${log(x.b)} else ${log(x.c)}`;
        } else if (_.isArray(x)) {
            str += x.map(log).join('\n');
        }

        return str;
    }

    console.log(log(stack));

    return stack[0];
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
            stack.push({ type: PARSER_LET_EXPR, a: tokens[1].value, b, c });
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
                stack.push({ type: PARSER_IF_EXPR, a, b, c });
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
                stack.push({ type: PARSER_EQUALITY_EXPR, a, b });
            } else {
                stack.push({ type: PARSER_NOT_EQUALITY_EXPR, a, b });
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
        stack.push({ type: PARSER_NUMBER_EXPR, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_ARGUMENT) {
        stack.push({ type: PARSER_ARGUMENT_EXPR, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_IDENTIFIER) {
        stack.push({ type: PARSER_IDENTIFIER_EXPR, a: tokens[0].value });

        return 1 + parseConditionalExpr(tokens.slice(1), stack);
    } else if (tokens[0].type === TOKEN_KEYWORD && ['plus', 'minus'].includes(tokens[0].value)) {
        let tree = parseConditionalExpr(tokens.slice(1), stack)
        if (tree) {
            let b = stack.pop();
            let a = stack.pop();
            if (tokens[0].value === 'plus') {
                stack.push({ type: PARSER_PLUS_EXPR, a, b });
            } else {
                stack.push({ type: PARSER_MINUS_EXPR, a, b });
            }
            return 1 + tree;
        } else {
            console.log("Parse error");
        }
    }

    return 0;
}

export default Props;
