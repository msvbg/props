# Props

> A pure functional, Turing-complete JavaScript DSL written with innocent abuse
of ES6 proxies, generators and other ES6 features that make the code harder to
read.

```js
import Props from 'Props';

let program = (new Props)
    .let .x .$1 .plus .$2 .in
    .let .y .$2 .in
        .x .plus .y;
        
console.log(program(6, 3)) // => 12
```

## FAQ
* Is this legal?
Proxy abuse is currently legal in most states, with the notable exception of the Republic of Nauru. Nauruans, please be careful.

* Is this fast?
Props uses the new quantum entanglement features of ES6 to achieve faster-than-light speeds in ideal conditions. Big companies have been known to use it for Big Data crunching.

## License

MIT © [Martin Svanberg](http://martinsvanberg.com)
