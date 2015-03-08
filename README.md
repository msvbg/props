# Props

> A JavaScript DSL written with innocent abuse of ES6 proxies.

```
import Props from 'Props';

let program = (new Props) .[1] .plus .$2;
console.log(program(5)) // => 6
```

## FAQ
* Is this legal?
Proxy abuse is currently legal in most states, with the notable exception of the Republic of Nauru. Nauruans, please be careful.

* Is this fast?
Props uses the new quantum entanglement features of ES6 to achieve faster-than-light speeds in ideal conditions. Big companies have been known to use it for Big Data crunching.

* Seriously though, when would I use this?
When your boss reads the previous paragraph and forces you to.

## License

MIT © [Martin Svanberg](http://blog.martinsvanberg.com)
