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
});

/*

    let program = (new Props)
        .let .x .be [5] .in
            .x .plus [10];

    program.run() // => 15

 */
