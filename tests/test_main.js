'use strict';

import Props from '../lib/main.js';
import assert from 'assert';

describe('Props', function () {
    it('plus adds a number to another number', function () {
        let program = (new Props)
            .$2 .plus [2] .plus . $1;

        assert.strictEqual(program(7, 2), 11);
    });

    it('minus subtracts a number from another number', function () {
        let program = (new Props)
            .$1 .minus [5];

        assert.strictEqual(program(10), 5);
    });

    it('automatically curries functions', function () {
        let program = (new Props)
            .$1 .plus .$2;

        let curried = program(1);
        assert.strictEqual(curried(9), 10);
    });

    it('supports let bindings', function () {
        let program = (new Props)
            .let .x .$1 .in
            .let .y .$2 .in
                .x .plus .y;
        
        assert.strictEqual(program(6, 3), 9);
    });

    it('allows expressions in let bindings', function () {
        let program = (new Props)
            .let .x .$1 .plus .$2 .in
            .let .y .$2 .in
                .x .plus .y;
        
        assert.strictEqual(program(6, 3), 12);
    });

    it('supports comparison operators', function () {
        let program = (new Props) [5] .eq [5];

        assert.strictEqual(program(), true);
    });

    it('supports if-then-else expressions', function () {
        let program = (new Props)
            .if .$1 .eq .$2 .then
                [1]
            .else
                [0];

        assert.strictEqual(program(3, 3), 1);
        assert.strictEqual(program(2, 3), 0);
    });

    it('supports multiple programs', function () {
        let add = (new Props) .$1 .plus .$2;
        let subtract = (new Props) .$1 .minus .$2;

        assert.strictEqual(add(5, subtract(3, 2)), 6);
    });
});