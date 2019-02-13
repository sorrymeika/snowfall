import observable from '../observable';
import { Observer, readonlyObserver } from '../Observer';

export function toPromise(observer) {
    return new Promise((resolve) => {
        if (observer.state.updated) {
            resolve(observer.get());
        } else {
            const once = (val) => {
                observer.unobserve(once);
                resolve(val);
            };
            observer.observe(once);
        }
    });
};

export function next(observer) {
    return new Promise((resolve) => {
        const once = (val) => {
            observer.unobserve(once);
            resolve(val);
        };
        observer.observe(once);
    });
};

export function some(observers) {
    const [observer, setObserver] = readonlyObserver(new Observer());
    let count = 0;
    const states = observers.map((item) => {
        if (item.state.updated) {
            count++;
        }
        return item.get();
    });
    const set = (i, val) => {
        const newStates = [...states];
        newStates.index = i;
        newStates.change = val;
        setObserver(newStates);
    };
    const binders = observers.map((item, i) => {
        const binder = (val) => {
            states[i] = val;
            set(i, val);
        };
        item.observe(binder);
        return binder;
    });
    observer.on('destroy', () => {
        observers.forEach((item, i) => item.unobserve(binders[i]));
    });
    if (count != 0) {
        set(-1, null);
    }
    return observer;
};

export function every(observers) {
    const [observer, setObserver] = readonlyObserver(new Observer());
    const states = [];
    const set = (i, val) => {
        const newStates = [...states];
        newStates.index = i;
        newStates.change = val;
        setObserver(newStates);
    };
    let count = 0;
    const counts = observers.map((item, i) => {
        if (item.state.updated) {
            states[i] = item.get();
            count++;
            return 0;
        } else {
            return 1;
        }
    });
    const binders = observers.map((item, i) => {
        const binder = (val) => {
            states[i] = val;
            if (count === observers.length) {
                set(i, val);
            } else {
                count += counts[i];
                counts[i] = 0;
            }
        };
        item.observe(binder);
        return binder;
    });
    observer.on('destroy', () => {
        observers.forEach((item, i) => item.unobserve(binders[i]));
    });
    if (count === observers.length) {
        set(-1, null);
    }
    return observer;
};

export function once(observers) {
    const observer = observable.every(observers)
        .observe(() => {
            observer.destroy();
        });
    return observer;
};

export function any(observers) {
    const [observer, set] = readonlyObserver(new Observer());
    observers.forEach((item) => {
        item.observe(set);
    });
    observer.on('destroy', () => {
        observers.forEach((item) => item.unobserve(set));
    });
    return observer;
};