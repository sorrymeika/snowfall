import { Observer, readonlyObserver } from "../Observer";
import { asap } from "../../utils";

export default function compute() {
    const [observers, isArray] = Array.isArray(arguments[0])
        ? [arguments[0], true]
        : [[].slice.call(arguments), false];

    const [observer, setObserver] = readonlyObserver(new Observer());
    const args = () => observers.map((item) => item.get());
    const calc = observers.pop();
    const computed = isArray
        ? () => calc(args())
        : () => calc(...args());

    let taskId;
    const compute = () => {
        if (taskId) return;
        taskId = asap(() => {
            taskId = null;
            setObserver(computed());
        });
    };
    observers.forEach((item) => item.observe(compute));
    observer.on('destroy', () =>
        observers.forEach((item) =>
            item.unobserve(compute)
        )
    );
    setObserver(computed());
    return observer;
}